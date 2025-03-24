import fetch from 'node-fetch';
import { 
  NaverSearchTrendParams, 
  NaverSearchTrendResponse,
  NaverShoppingCategoryTrendParams,
  NaverShoppingKeywordTrendParams,
  NaverShoppingTrendResponse,
  FormattedNaverSearchTrendResult,
  FormattedNaverShoppingTrendResult,
  NaverApiRequestParams,
  PeriodRatioData
} from '../types/naverTypes.js';

// 네이버 API 호출을 위한 공통 헤더
const getNaverApiHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID || '',
  'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET || ''
});

/**
 * API 요청 파라미터를 가공하는 공통 함수
 * @param params API 요청 파라미터
 * @returns 가공된 요청 파라미터
 */
const processRequestParams = <T extends NaverApiRequestParams>(params: T): Record<string, any> => {
  return {
    startDate: params.startDate,
    endDate: params.endDate,
    timeUnit: params.timeUnit,
    ...(params.device && { device: params.device }),
    ...(params.gender && { gender: params.gender }),
    ...(params.age && params.age.length > 0 && { age: params.age }),
    ...Object.entries(params)
      .filter(([key]) => !['startDate', 'endDate', 'timeUnit', 'device', 'gender', 'age'].includes(key))
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})
  };
};

/**
 * 네이버 API 호출을 위한 공통 함수
 * @param apiUrl API 엔드포인트 URL
 * @param params 요청 파라미터
 * @returns API 응답 데이터
 */
const callNaverApi = async <T, R>(
  apiUrl: string, 
  params: T, 
  errorPrefix: string
): Promise<R> => {
  // 최대 재시도 횟수
  const maxRetries = 3;
  // 요청 타임아웃 (밀리초)
  const timeoutMs = 10000;
  // 재시도 간격 (밀리초)
  const retryDelay = 1000;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const headers = getNaverApiHeaders();
      const requestParams = processRequestParams(params as any);
      
      console.log(`API 요청 파라미터: ${JSON.stringify(requestParams)}`);
      
      // fetch 요청
      const fetchOptions: any = {
        method: 'POST',
        headers,
        body: JSON.stringify(requestParams)
      };
      
      // 타임아웃 설정 (AbortController가 지원되는 환경에서만)
      let timeoutId: NodeJS.Timeout | undefined;
      if (typeof AbortController !== 'undefined') {
        try {
          const controller = new AbortController();
          timeoutId = setTimeout(() => controller.abort(), timeoutMs);
          fetchOptions.signal = controller.signal;
        } catch (e) {
          console.error('AbortController를 사용할 수 없습니다:', e);
        }
      }
      
      // 요청 실행
      const response = await fetch(apiUrl, fetchOptions);
      
      // 타임아웃 해제
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: response.statusText };
        }
        
        throw new Error(`${errorPrefix} 오류: ${response.status} - ${JSON.stringify(errorData)}`);
      }
      
      // 응답 내용 가져오기
      const rawText = await response.text();
      
      let data: R;
      try {
        data = JSON.parse(rawText) as R;
      } catch (e) {
        console.error(`JSON 파싱 오류:`, e, `원본 텍스트:`, rawText);
        throw new Error(`${errorPrefix} 응답을 JSON으로 파싱할 수 없습니다.`);
      }
      
      // 응답 유효성 검사
      if (!data || typeof data !== 'object') {
        console.error(`API 응답이 유효하지 않습니다:`, data);
        throw new Error(`${errorPrefix} 응답이 유효하지 않습니다: ${JSON.stringify(data)}`);
      }
      
      // 응답 로깅
      console.log(`API 응답:`, typeof data, Array.isArray(data) ? 'array' : 'object', Object.keys(data));
      
      // 기본 응답 구조 생성 (비어있는 경우를 위해)
      if (!('results' in data)) {
        console.warn(`API 응답에 results 필드가 없습니다. 빈 배열 추가:`, data);
        (data as any).results = [];
      }
      
      return data;
    } catch (error: any) {
      lastError = error;
      
      // AbortError는 타임아웃 오류
      if (error.name === 'AbortError') {
        console.error(`${errorPrefix} 요청 타임아웃 (시도 ${attempt}/${maxRetries})`);
      } else {
        console.error(`${errorPrefix} 호출 중 오류 발생 (시도 ${attempt}/${maxRetries}):`, error);
      }
      
      // 마지막 시도가 아니면 잠시 대기 후 재시도
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      
      // 모든 재시도 실패 - 기본 구조 반환
      console.error(`${errorPrefix} 모든 재시도 실패, 기본 응답 구조 반환`);
      const basicResponse: any = {
        startDate: '',
        endDate: '',
        timeUnit: 'date',
        results: []
      };
      
      return basicResponse as R;
    }
  }
  
  // 이 코드는 실행되지 않지만 TypeScript 컴파일러를 위해 추가
  const basicResponse: any = {
    startDate: '',
    endDate: '',
    timeUnit: 'date',
    results: []
  };
  
  return basicResponse as R;
};

/**
 * 네이버 데이터랩 검색어 트렌드 API를 호출하는 함수
 * @param params 검색어 트렌드 API 요청 파라미터
 * @returns API 응답 데이터
 */
export const fetchNaverSearchTrend = async (params: NaverSearchTrendParams): Promise<NaverSearchTrendResponse> => {
  const apiUrl = 'https://openapi.naver.com/v1/datalab/search';
  return callNaverApi<NaverSearchTrendParams, NaverSearchTrendResponse>(
    apiUrl, 
    params, 
    '네이버 데이터랩 API'
  );
};

/**
 * 네이버 쇼핑인사이트 분야별 트렌드 API를 호출하는 함수
 * @param params 쇼핑인사이트 분야별 트렌드 API 요청 파라미터
 * @returns API 응답 데이터
 */
export const fetchNaverShoppingCategoryTrend = async (params: NaverShoppingCategoryTrendParams): Promise<NaverShoppingTrendResponse> => {
  const apiUrl = 'https://openapi.naver.com/v1/datalab/shopping/categories';
  return callNaverApi<NaverShoppingCategoryTrendParams, NaverShoppingTrendResponse>(
    apiUrl, 
    params, 
    '네이버 쇼핑인사이트 API'
  );
};

/**
 * 네이버 쇼핑인사이트 키워드별 트렌드 API를 호출하는 함수
 * @param params 쇼핑인사이트 키워드별 트렌드 API 요청 파라미터
 * @returns API 응답 데이터
 */
export const fetchNaverShoppingKeywordTrend = async (params: NaverShoppingKeywordTrendParams): Promise<NaverShoppingTrendResponse> => {
  const apiUrl = 'https://openapi.naver.com/v1/datalab/shopping/category/keywords';
  
  // 키워드 파라미터 배열에서 각 param에 첫 번째 요소만 남기도록 수정
  const modifiedParams = {
    ...params,
    keyword: params.keyword.map(item => ({
      name: item.name,
      param: item.param.slice(0, 1) // 첫 번째 요소만 유지
    }))
  };
  
  return callNaverApi<NaverShoppingKeywordTrendParams, NaverShoppingTrendResponse>(
    apiUrl, 
    modifiedParams, 
    '네이버 쇼핑인사이트 API'
  );
};

/**
 * 기간별 데이터를 재구성하는 공통 함수
 * @param results API 응답 결과
 * @param nameKey 이름 키 (keyword 또는 category)
 * @returns 기간별로 재구성된 데이터
 */
const reorganizePeriodData = <T extends 'keyword' | 'category'>(
  results: Array<{ title: string; data: PeriodRatioData[] }>,
  nameKey: T
): Array<{
  period: string;
  [key: string]: any; // 동적 키를 허용하는 인덱스 시그니처
}> => {
  // 방어 코드: 결과가 없을 경우 빈 배열 반환
  if (!results || !Array.isArray(results) || results.length === 0) {
    return [];
  }
  
  // 타입에 맞는 데이터 구조 정의
  type ItemType = T extends 'keyword' 
    ? { keyword: string; ratio: number } 
    : { category: string; ratio: number };
  
  const periodMap = new Map<string, Array<ItemType>>();
  
  // 결과 데이터 처리
  results.forEach(result => {
    // 방어 코드: 필요한 데이터가 없을 경우 무시
    if (!result || !result.title || !result.data || !Array.isArray(result.data)) {
      return;
    }
    
    const title = result.title;
    
    result.data.forEach(item => {
      // 방어 코드: 데이터가 유효하지 않을 경우 무시
      if (!item || !item.period) {
        return;
      }
      
      const { period, ratio } = item;
      
      if (!periodMap.has(period)) {
        periodMap.set(period, []);
      }
      
      const newItem = {
        [nameKey]: title,
        ratio: ratio || 0 // ratio가 없을 경우 0으로 처리
      } as ItemType;
      
      periodMap.get(period)?.push(newItem);
    });
  });
  
  const periodKey = nameKey === 'keyword' ? 'keywords' : 'categories';
  
  // 결과 반환
  return Array.from(periodMap.entries()).map(([period, items]) => ({
    period,
    [periodKey]: items.sort((a, b) => (b.ratio || 0) - (a.ratio || 0)) // 비율이 없는 경우 0으로 처리하고 높은 순으로 정렬
  })).sort((a, b) => a.period.localeCompare(b.period)); // 기간 오름차순 정렬
};

/**
 * 네이버 데이터랩 검색어 트렌드 결과를 포맷팅하는 함수
 * @param response 네이버 데이터랩 API 응답
 * @returns 포맷팅된 결과 데이터
 */
export const formatSearchTrendResult = (response: NaverSearchTrendResponse): FormattedNaverSearchTrendResult => {
  try {
    // 응답 객체 검증
    if (!response) {
      console.error('검색어 트렌드 API 응답이 없습니다.');
      return {
        title: '네이버 검색어 트렌드',
        startDate: '',
        endDate: '',
        timeUnit: 'date',
        data: []
      };
    }
    
    // 결과가 없는 경우 빈 배열로 초기화하여 오류 방지
    const results = Array.isArray(response.results) ? response.results : [];
    const periodMap = new Map<string, Array<{ keyword: string; ratio: number }>>();
    
    // 결과 데이터 처리
    results.forEach(result => {
      // 방어 코드: 필요한 데이터가 없을 경우 무시
      if (!result || typeof result !== 'object' || !result.title || !Array.isArray(result.data)) {
        return;
      }
      
      const title = result.title;
      
      result.data.forEach(item => {
        // 방어 코드: 데이터가 유효하지 않을 경우 무시
        if (!item || typeof item !== 'object' || !item.period) {
          return;
        }
        
        const { period, ratio } = item;
        
        if (!periodMap.has(period)) {
          periodMap.set(period, []);
        }
        
        periodMap.get(period)?.push({
          keyword: title,
          ratio: Number(ratio) || 0
        });
      });
    });
    
    // 포맷팅된 데이터 구성
    const formattedData = Array.from(periodMap.entries()).map(([period, keywords]) => ({
      period,
      keywords: keywords.sort((a, b) => (b.ratio || 0) - (a.ratio || 0))
    })).sort((a, b) => a.period.localeCompare(b.period));
    
    // 결과 데이터가 비어있는 경우, 기본 구조의 빈 데이터 추가
    if (formattedData.length === 0 && results.length > 0) {
      // API 응답에서 최소한 하나의 타이틀을 가져옴
      const titles = results.map(r => r.title).filter(Boolean);
      
      // 현재 날짜로 기본 데이터 생성
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const period = `${year}-${month}`;
      
      // 각 타이틀에 대한 빈 데이터 생성
      const emptyKeywords = titles.map(title => ({
        keyword: title,
        ratio: 0
      }));
      
      // 비어 있는 경우에도 최소한의 데이터 구조 유지
      if (emptyKeywords.length > 0) {
        formattedData.push({
          period,
          keywords: emptyKeywords
        });
      }
    }
    
    return {
      title: '네이버 검색어 트렌드',
      startDate: response.startDate || '',
      endDate: response.endDate || '',
      timeUnit: response.timeUnit || 'date',
      data: formattedData
    };
  } catch (error) {
    console.error('검색어 트렌드 결과 포맷팅 중 오류 발생:', error);
    // 오류 발생 시 기본 구조의 빈 결과 반환
    return {
      title: '네이버 검색어 트렌드',
      startDate: response?.startDate || '',
      endDate: response?.endDate || '',
      timeUnit: response?.timeUnit || 'date',
      data: []
    };
  }
};

/**
 * 네이버 쇼핑인사이트 트렌드 결과를 포맷팅하는 함수
 * @param response 네이버 쇼핑인사이트 API 응답
 * @returns 포맷팅된 결과 데이터
 */
export const formatShoppingTrendResult = (response: NaverShoppingTrendResponse): FormattedNaverShoppingTrendResult => {
  try {
    // 응답 객체 검증
    if (!response) {
      console.error('쇼핑인사이트 API 응답이 없습니다.');
      return {
        title: '네이버 쇼핑인사이트 트렌드',
        startDate: '',
        endDate: '',
        timeUnit: 'date',
        data: []
      };
    }
    
    // 결과가 없는 경우 빈 배열로 초기화하여 오류 방지
    const results = Array.isArray(response.results) ? response.results : [];
    const periodMap = new Map<string, Array<{ category: string; ratio: number }>>();
    
    // 결과 데이터 처리
    results.forEach(result => {
      // 방어 코드: 필요한 데이터가 없을 경우 무시
      if (!result || typeof result !== 'object' || !result.title || !Array.isArray(result.data)) {
        return;
      }
      
      const title = result.title;
      
      result.data.forEach(item => {
        // 방어 코드: 데이터가 유효하지 않을 경우 무시
        if (!item || typeof item !== 'object' || !item.period) {
          return;
        }
        
        const { period, ratio } = item;
        
        if (!periodMap.has(period)) {
          periodMap.set(period, []);
        }
        
        periodMap.get(period)?.push({
          category: title,
          ratio: Number(ratio) || 0
        });
      });
    });
    
    // 포맷팅된 데이터 구성
    const formattedData = Array.from(periodMap.entries()).map(([period, categories]) => ({
      period,
      categories: categories.sort((a, b) => (b.ratio || 0) - (a.ratio || 0))
    })).sort((a, b) => a.period.localeCompare(b.period));
    
    // 결과 데이터가 비어있는 경우, 기본 구조의 빈 데이터 추가
    if (formattedData.length === 0 && results.length > 0) {
      // API 응답에서 최소한 하나의 타이틀을 가져옴
      const titles = results.map(r => r.title).filter(Boolean);
      
      // 현재 날짜로 기본 데이터 생성
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const period = `${year}-${month}`;
      
      // 각 타이틀에 대한 빈 데이터 생성
      const emptyCategories = titles.map(title => ({
        category: title,
        ratio: 0
      }));
      
      // 비어 있는 경우에도 최소한의 데이터 구조 유지
      if (emptyCategories.length > 0) {
        formattedData.push({
          period,
          categories: emptyCategories
        });
      }
    }
    
    return {
      title: '네이버 쇼핑인사이트 트렌드',
      startDate: response.startDate || '',
      endDate: response.endDate || '',
      timeUnit: response.timeUnit || 'date',
      data: formattedData
    };
  } catch (error) {
    console.error('쇼핑인사이트 트렌드 결과 포맷팅 중 오류 발생:', error);
    // 오류 발생 시 기본 구조의 빈 결과 반환
    return {
      title: '네이버 쇼핑인사이트 트렌드',
      startDate: response?.startDate || '',
      endDate: response?.endDate || '',
      timeUnit: response?.timeUnit || 'date',
      data: []
    };
  }
};