import { z } from "zod";

// Zod 스키마 일급 컬렉션
export class NaverSchemas {
  // 검색어 리스트 스키마 (1-5개 제한)
  static readonly KeywordList = z.array(z.string()).min(1).max(5);
  
  // 파라미터 리스트 스키마 (1개 이상 제한)
  static readonly ParamList = z.array(z.string()).min(1);
  
  // 검색어 그룹 스키마
  static readonly KeywordGroup = z.object({
    groupName: z.string(),
    keywords: this.KeywordList
  });
  
  // 카테고리 스키마
  static readonly Category = z.object({
    name: z.string(),
    param: this.ParamList
  });
  
  // 키워드 스키마
  static readonly Keyword = z.object({
    name: z.string(),
    param: this.KeywordList
  });
  
  // 검색어 그룹 배열 스키마 (1-5개 제한)
  static readonly KeywordGroups = z.array(this.KeywordGroup).min(1).max(5);
  
  // 카테고리 배열 스키마 (1-3개 제한)
  static readonly Categories = z.array(this.Category).min(1).max(3);
  
  // 키워드 배열 스키마 (1-3개 제한)
  static readonly Keywords = z.array(this.Keyword).min(1).max(3);
}

// 공통 기본 타입 정의
export type TimeUnit = 'date' | 'week' | 'month';
export type Device = 'pc' | 'mo' | '';
export type Gender = 'f' | 'm' | '';
export type AgeGroup = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11';

// 공통 필터 옵션 타입
export interface FilterOptions {
  device?: Device;
  gender?: Gender;
  age?: AgeGroup[];
}

// 공통 기간 파라미터 타입
export interface DateRangeParams {
  startDate: string;   // 조회 기간 시작 날짜(yyyy-mm-dd)
  endDate: string;     // 조회 기간 종료 날짜(yyyy-mm-dd)
  timeUnit: TimeUnit;  // 시간 단위
}

// 네이버 데이터랩 검색어 트렌드 파라미터 타입
export interface NaverSearchTrendParams extends DateRangeParams, FilterOptions {
  keywordGroups: Array<{
    groupName: string;  // 검색어 그룹명
    keywords: string[]; // 검색어 그룹에 해당하는 검색어 목록
  }>;
}

// 네이버 쇼핑인사이트 분야별 트렌드 파라미터 타입
export interface NaverShoppingCategoryTrendParams extends DateRangeParams, FilterOptions {
  category: Array<{
    name: string;     // 분야 이름
    param: string[];  // 분야 코드
  }>;
}

// 네이버 쇼핑인사이트 키워드별 트렌드 파라미터 타입
export interface NaverShoppingKeywordTrendParams extends DateRangeParams, FilterOptions {
  category: string;    // 쇼핑 분야 코드
  keyword: Array<{
    name: string;      // 키워드 이름
    param: string[];   // 검색어 목록
  }>;
}

// API 공통 응답 데이터 타입
export interface PeriodRatioData {
  period: string;
  ratio: number;
}

// 네이버 API 공통 응답 타입
export interface NaverApiBaseResponse {
  startDate: string;
  endDate: string;
  timeUnit: string;
}

// 네이버 검색어 트렌드 API 응답 타입
export interface NaverSearchTrendResponse extends NaverApiBaseResponse {
  results: Array<{
    title: string;
    data: PeriodRatioData[];
  }>;
}

// 네이버 쇼핑인사이트 API 응답 타입
export interface NaverShoppingTrendResponse extends NaverApiBaseResponse {
  results: Array<{
    title: string;
    data: PeriodRatioData[];
  }>;
}

// 포맷팅된 결과 공통 타입
export interface FormattedResultBase {
  title: string;
  startDate: string;
  endDate: string;
  timeUnit: string;
}

// 포맷팅된 검색어 트렌드 결과 타입
export interface FormattedNaverSearchTrendResult extends FormattedResultBase {
  data: Array<{
    period: string;
    keywords: Array<{
      keyword: string;
      ratio: number;
    }>;
  }>;
}

// 포맷팅된 쇼핑인사이트 결과 타입
export interface FormattedNaverShoppingTrendResult extends FormattedResultBase {
  data: Array<{
    period: string;
    categories: Array<{
      category: string;
      ratio: number;
    }>;
  }>;
}

// API 요청 구성을 위한 인터페이스
export interface NaverApiRequestParams {
  startDate: string;
  endDate: string;
  timeUnit: TimeUnit;
  [key: string]: any;
} 