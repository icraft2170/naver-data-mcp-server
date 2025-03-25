import fetch from 'node-fetch';
import { config } from 'dotenv';
import {
  NaverSearchTrendParams,
  NaverShoppingCategoryTrendParams,
  NaverShoppingKeywordTrendParams,
  NaverSearchTrendResponse,
  NaverShoppingTrendResponse
} from '../types/naverTypes.js';

import { z } from 'zod';

config();

const NAVER_API_CLIENT_ID = process.env.NAVER_API_CLIENT_ID;
const NAVER_API_CLIENT_SECRET = process.env.NAVER_API_CLIENT_SECRET;

if (!NAVER_API_CLIENT_ID || !NAVER_API_CLIENT_SECRET) {
  throw new Error('네이버 API 인증 정보가 설정되지 않았습니다.');
}

// 타입 단언으로 환경 변수가 존재함을 보장
const clientId = NAVER_API_CLIENT_ID as string;
const clientSecret = NAVER_API_CLIENT_SECRET as string;

/**
 * 네이버 API 호출 함수
 * @param endpoint API 엔드포인트
 * @param params 요청 파라미터
 * @returns API 응답 데이터
 */
async function callNaverApi<T>(endpoint: string, params: any): Promise<T> {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret
    };

    const options = {
      method: 'POST',
      headers,
      body: JSON.stringify(params)
    };

    const response = await fetch(`https://openapi.naver.com/v1/datalab/${endpoint}`, options);

    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
    }

    return await response.json() as T;
  } catch (error) {
    console.error(JSON.stringify({
      type: 'error',
      message: 'API 호출 중 오류 발생',
      error: error instanceof Error ? error.message : String(error)
    }));
    throw error;
  }
}

// 검색어 트렌드 요청 스키마
export const SearchTrendRequestSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeUnit: z.enum(['date', 'week', 'month']),
  keywordGroups: z.array(z.object({
    groupName: z.string(),
    keywords: z.array(z.string().min(1).max(5).refine(
      (val) => val.length <= 5,
      { message: "검색어는 최대 5자까지만 가능합니다." }
    ))
  })).min(1).max(5),
  device: z.enum(['pc', 'mo', '']).optional(),
  gender: z.enum(['f', 'm', '']).optional(),
  age: z.array(z.enum(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'])).optional()
});

// 쇼핑 카테고리 트렌드 요청 스키마
export const ShoppingCategoryTrendRequestSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeUnit: z.enum(['date', 'week', 'month']),
  category: z.array(z.object({
    name: z.string(),
    param: z.array(z.string().min(1))
  })).min(1).max(3),
  device: z.enum(['pc', 'mo', '']).optional(),
  gender: z.enum(['f', 'm', '']).optional(),
  age: z.array(z.enum(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'])).optional()
});

// 쇼핑 키워드 트렌드 요청 스키마
export const ShoppingKeywordTrendRequestSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeUnit: z.enum(['date', 'week', 'month']),
  category: z.string(),
  keyword: z.array(z.object({
    name: z.string(),
    param: z.array(z.string().min(1)).length(1)
  })).min(1).max(3),
  device: z.enum(['pc', 'mo', '']).optional(),
  gender: z.enum(['f', 'm', '']).optional(),
  age: z.array(z.enum(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'])).optional()
}); 