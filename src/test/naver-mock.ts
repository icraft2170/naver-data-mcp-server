import { NaverSearchTrendResponse, NaverShoppingTrendResponse } from '../types/naverTypes.js';
import { formatSearchTrendResult, formatShoppingTrendResult } from '../functions/naver.js';

console.log('네이버 API 응답 포맷팅 테스트 파일이 로드되었습니다.');

/**
 * 네이버 검색어 트렌드 API 응답을 모킹하는 함수
 */
function mockNaverSearchTrendResponse(): NaverSearchTrendResponse {
  return {
    startDate: '2023-01-01',
    endDate: '2023-12-31',
    timeUnit: 'month',
    results: [
      {
        title: '스마트폰',
        data: [
          { period: '2023-01', ratio: 100.0 },
          { period: '2023-02', ratio: 95.6 },
          { period: '2023-03', ratio: 93.2 }
        ]
      },
      {
        title: '노트북',
        data: [
          { period: '2023-01', ratio: 80.0 },
          { period: '2023-02', ratio: 85.6 },
          { period: '2023-03', ratio: 87.2 }
        ]
      }
    ]
  };
}

/**
 * 네이버 쇼핑인사이트 분야별 트렌드 API 응답을 모킹하는 함수
 */
function mockNaverShoppingCategoryTrendResponse(): NaverShoppingTrendResponse {
  return {
    startDate: '2023-01-01',
    endDate: '2023-12-31',
    timeUnit: 'month',
    results: [
      {
        title: '스마트폰',
        data: [
          { period: '2023-01', ratio: 100.0 },
          { period: '2023-02', ratio: 95.6 },
          { period: '2023-03', ratio: 93.2 }
        ]
      },
      {
        title: '노트북',
        data: [
          { period: '2023-01', ratio: 80.0 },
          { period: '2023-02', ratio: 85.6 },
          { period: '2023-03', ratio: 87.2 }
        ]
      }
    ]
  };
}

/**
 * 네이버 쇼핑인사이트 키워드별 트렌드 API 응답을 모킹하는 함수
 */
function mockNaverShoppingKeywordTrendResponse(): NaverShoppingTrendResponse {
  return {
    startDate: '2023-01-01',
    endDate: '2023-12-31',
    timeUnit: 'month',
    results: [
      {
        title: '아이폰',
        data: [
          { period: '2023-01', ratio: 100.0 },
          { period: '2023-02', ratio: 95.6 },
          { period: '2023-03', ratio: 93.2 }
        ]
      },
      {
        title: '삼성',
        data: [
          { period: '2023-01', ratio: 80.0 },
          { period: '2023-02', ratio: 85.6 },
          { period: '2023-03', ratio: 87.2 }
        ]
      }
    ]
  };
}

/**
 * 모킹된 API 응답에 대한 포맷팅 테스트를 실행하는 함수
 */
function testFormatting() {
  console.log('--- 모킹 데이터 포맷팅 테스트 시작 ---');
  
  // 1. 검색어 트렌드 데이터 포맷팅 테스트
  console.log('\n1. 검색어 트렌드 데이터 포맷팅 테스트');
  try {
    const searchTrendResponse = mockNaverSearchTrendResponse();
    console.log('모킹 데이터:', JSON.stringify(searchTrendResponse, null, 2));
    const formattedSearchTrend = formatSearchTrendResult(searchTrendResponse);
    console.log('포맷팅 결과:', JSON.stringify(formattedSearchTrend, null, 2));
  } catch (error: any) {
    console.error('검색어 트렌드 포맷팅 오류:', error.message);
    console.error(error.stack);
  }
  
  // 2. 쇼핑인사이트 분야별 트렌드 데이터 포맷팅 테스트
  console.log('\n2. 쇼핑인사이트 분야별 트렌드 데이터 포맷팅 테스트');
  try {
    const categoryTrendResponse = mockNaverShoppingCategoryTrendResponse();
    console.log('모킹 데이터:', JSON.stringify(categoryTrendResponse, null, 2));
    const formattedCategoryTrend = formatShoppingTrendResult(categoryTrendResponse);
    console.log('포맷팅 결과:', JSON.stringify(formattedCategoryTrend, null, 2));
  } catch (error: any) {
    console.error('쇼핑인사이트 분야별 트렌드 포맷팅 오류:', error.message);
    console.error(error.stack);
  }
  
  // 3. 쇼핑인사이트 키워드별 트렌드 데이터 포맷팅 테스트
  console.log('\n3. 쇼핑인사이트 키워드별 트렌드 데이터 포맷팅 테스트');
  try {
    const keywordTrendResponse = mockNaverShoppingKeywordTrendResponse();
    console.log('모킹 데이터:', JSON.stringify(keywordTrendResponse, null, 2));
    const formattedKeywordTrend = formatShoppingTrendResult(keywordTrendResponse);
    console.log('포맷팅 결과:', JSON.stringify(formattedKeywordTrend, null, 2));
  } catch (error: any) {
    console.error('쇼핑인사이트 키워드별 트렌드 포맷팅 오류:', error.message);
    console.error(error.stack);
  }
  
  console.log('\n--- 모킹 데이터 포맷팅 테스트 완료 ---');
}

// 테스트 실행
testFormatting(); 