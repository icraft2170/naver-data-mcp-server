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
  try {
    const headers = getNaverApiHeaders();
    const requestParams = processRequestParams(params as any);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestParams)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`${errorPrefix} 오류: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    return await response.json() as R;
  } catch (error) {
    console.error(`${errorPrefix} 호출 중 오류 발생:`, error);
    throw error;
  }
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
  return callNaverApi<NaverShoppingKeywordTrendParams, NaverShoppingTrendResponse>(
    apiUrl, 
    params, 
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
  // 타입에 맞는 데이터 구조 정의
  type ItemType = T extends 'keyword' 
    ? { keyword: string; ratio: number } 
    : { category: string; ratio: number };
  
  const periodMap = new Map<string, Array<ItemType>>();
  
  results.forEach(result => {
    const title = result.title;
    
    result.data.forEach(item => {
      const { period, ratio } = item;
      
      if (!periodMap.has(period)) {
        periodMap.set(period, []);
      }
      
      const newItem = {
        [nameKey]: title,
        ratio
      } as ItemType;
      
      periodMap.get(period)?.push(newItem);
    });
  });
  
  const periodKey = nameKey === 'keyword' ? 'keywords' : 'categories';
  
  return Array.from(periodMap.entries()).map(([period, items]) => ({
    period,
    [periodKey]: items.sort((a, b) => b.ratio - a.ratio) // 비율 높은 순으로 정렬
  })).sort((a, b) => a.period.localeCompare(b.period)); // 기간 오름차순 정렬
};

/**
 * 네이버 데이터랩 검색어 트렌드 결과를 포맷팅하는 함수
 * @param response 네이버 데이터랩 API 응답
 * @returns 포맷팅된 결과 데이터
 */
export const formatSearchTrendResult = (response: NaverSearchTrendResponse): FormattedNaverSearchTrendResult => {
  try {
    const formattedData = reorganizePeriodData(response.results, 'keyword');
    
    return {
      title: '네이버 검색어 트렌드',
      startDate: response.startDate,
      endDate: response.endDate,
      timeUnit: response.timeUnit,
      data: formattedData as FormattedNaverSearchTrendResult['data']
    };
  } catch (error) {
    console.error('검색어 트렌드 결과 포맷팅 중 오류 발생:', error);
    throw error;
  }
};

/**
 * 네이버 쇼핑인사이트 트렌드 결과를 포맷팅하는 함수
 * @param response 네이버 쇼핑인사이트 API 응답
 * @returns 포맷팅된 결과 데이터
 */
export const formatShoppingTrendResult = (response: NaverShoppingTrendResponse): FormattedNaverShoppingTrendResult => {
  try {
    const formattedData = reorganizePeriodData(response.results, 'category');
    
    return {
      title: '네이버 쇼핑인사이트 트렌드',
      startDate: response.startDate,
      endDate: response.endDate,
      timeUnit: response.timeUnit,
      data: formattedData as FormattedNaverShoppingTrendResult['data']
    };
  } catch (error) {
    console.error('쇼핑인사이트 트렌드 결과 포맷팅 중 오류 발생:', error);
    throw error;
  }
};