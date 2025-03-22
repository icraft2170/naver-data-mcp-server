import { z } from 'zod';

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
    param: z.array(z.string().min(1).max(5))
  })).min(1).max(3),
  device: z.enum(['pc', 'mo', '']).optional(),
  gender: z.enum(['f', 'm', '']).optional(),
  age: z.array(z.enum(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'])).optional()
}); 