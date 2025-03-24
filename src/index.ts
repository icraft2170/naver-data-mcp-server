#!/usr/bin/env node

import 'dotenv/config';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { 
  fetchNaverSearchTrend, 
  formatSearchTrendResult, 
  fetchNaverShoppingCategoryTrend, 
  fetchNaverShoppingKeywordTrend, 
  formatShoppingTrendResult 
} from './functions/naver.js';
import { 
  NaverSearchTrendParams, 
  NaverShoppingCategoryTrendParams, 
  NaverShoppingKeywordTrendParams,
  FormattedNaverSearchTrendResult,
  FormattedNaverShoppingTrendResult
} from './types/naverTypes.js';
import { 
  searchSimilarCategories, 
  generateAllCategoryEmbeddings, 
  initDatabase, 
  initEmbeddingPipeline,
  Category
} from './services/categorySearch.js';


// MCP SDK의 타입 정의
interface RequestHandlerExtra {
  [key: string]: unknown;
}

// 환경 변수 유효성 검사
if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
  console.error('Error: NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

// 공통으로 사용되는 ZOD 스키마 정의
const timeUnitSchema = z.enum(["date", "week", "month"]);
const deviceSchema = z.enum(["pc", "mo", ""]).optional();
const genderSchema = z.enum(["f", "m", ""]).optional();
const agesSchema = z.array(z.enum(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"])).optional();
const dateRangeSchema = {
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식이어야 합니다"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식이어야 합니다"),
  timeUnit: timeUnitSchema
};

// MCP 응답 타입 정의
interface McpResponse {
  content: Array<{
    type: "text";
    text: string;
    meta?: { format: string };
  }>;
  [key: string]: unknown; // 인덱스 시그니처 추가
}

// 카테고리 검색 결과 응답 인터페이스
interface CategorySearchResponse {
  query: string;
  results: Category[];
}

/**
 * 결과 데이터를 텍스트로 포맷팅하는 함수
 * @param result 포맷팅된 결과 데이터
 * @param category 선택적 카테고리 정보 (쇼핑 키워드 트렌드에만 사용)
 * @returns 포맷팅된 결과 텍스트
 */
const formatResultText = (result: FormattedNaverSearchTrendResult | FormattedNaverShoppingTrendResult, category?: string): string => {
  // 제목 및 기간 정보
  let resultText = `
${result.title} (${result.startDate} ~ ${result.endDate})`;

  // 카테고리 정보 (필요한 경우만)
  if (category) {
    resultText += `\n분야: ${category}`;
  }

  // 시간 단위
  resultText += `\n시간 단위: ${result.timeUnit === 'date' ? '일간' : result.timeUnit === 'week' ? '주간' : '월간'}\n\n`;

  // 데이터 정보
  if ('keywords' in result.data[0]) {
    // 검색어 트렌드 결과
    const searchResult = result as FormattedNaverSearchTrendResult;
    resultText += searchResult.data.map(item => {
      return `[${item.period}] ${item.keywords.map(k => `${k.keyword}: ${k.ratio.toFixed(2)}`).join(', ')}`;
    }).join('\n');
  } else {
    // 쇼핑인사이트 결과
    const shoppingResult = result as FormattedNaverShoppingTrendResult;
    resultText += shoppingResult.data.map(item => {
      return `[${item.period}] ${item.categories.map(c => `${c.category}: ${c.ratio.toFixed(2)}`).join(', ')}`;
    }).join('\n');
  }

  return resultText;
};

/**
 * MCP 응답 생성 함수
 * @param formattedResult 포맷팅된 결과 데이터
 * @param category 선택적 카테고리 정보
 * @returns MCP 응답 객체
 */
const createMcpResponse = (formattedResult: FormattedNaverSearchTrendResult | FormattedNaverShoppingTrendResult, category?: string): McpResponse => {
  const resultText = formatResultText(formattedResult, category);
  
  return {
    content: [
      { type: "text", text: resultText },
      { 
        type: "text", 
        text: JSON.stringify(formattedResult, null, 2),
        meta: { format: "json" } 
      }
    ]
  };
};

/**
 * API 호출 중 오류 발생 시 응답 생성 함수
 * @param error 발생한 오류
 * @returns 오류 응답 객체
 */
const createErrorResponse = (error: any): McpResponse => {
  return {
    content: [{ 
      type: "text", 
      text: JSON.stringify({
        error: error.message,
        details: error.response?.data || "네이버 API 호출 중 오류가 발생했습니다"
      }, null, 2) 
    }]
  };
};

async function main() {
    
    // Create MCP server
    const server = new McpServer({
        name: "네이버 데이터랩",
        version: "1.0.0"
    });

    // 데이터베이스 및 임베딩 모델 초기화
    try {
        initDatabase();
        await initEmbeddingPipeline();
        await generateAllCategoryEmbeddings();
    } catch (error) {
        console.error('카테고리 검색 초기화 오류:', error);
    }

    // 네이버 데이터랩 검색어 트렌드 API
    server.tool(
        "getNaverSearchTrend",
        `Retrieves search trend data from Naver DataLab API. Allows querying search volume trends for specific keywords over time.

Parameters:
- startDate (required): Start date in YYYY-MM-DD format (available from 2016-01-01)
- endDate (required): End date in YYYY-MM-DD format
- timeUnit (required): Time unit for data aggregation ("date", "week", or "month")
- keywordGroups (required): Array of keyword groups to compare (max 5 groups)
  - groupName: Name of the keyword group
  - keywords: Array of keywords to track (max 20 keywords per group, each keyword must be 5 characters or less)
- device (optional): Device type filter ("pc" for desktop, "mo" for mobile, or empty for all)
- gender (optional): Gender filter ("f" for female, "m" for male, or empty for all)
- age (optional): Array of age group codes from "1" to "11"

Note: Each keyword in the keywords array must be 5 characters or less. For example, "운동화" is allowed but "하이브리드 운동화" is not.`,
        {
            ...dateRangeSchema,
            keywordGroups: z.array(
                z.object({
                    groupName: z.string().describe("Name of the keyword group"),
                    keywords: z.array(z.string().min(1).max(5).refine(
                        (val) => val.length <= 5,
                        { message: "검색어는 최대 5자까지만 가능합니다." }
                    )).describe("Array of keywords (max 20) to track in this group, each keyword must be 5 characters or less")
                })
            ).min(1).max(5).describe("Array of keyword groups (max 5) to compare trends"),
            device: deviceSchema.describe("Device type filter: 'pc' for desktop, 'mo' for mobile, or empty for all"),
            gender: genderSchema.describe("Gender filter: 'f' for female, 'm' for male, or empty for all"),
            age: agesSchema.describe("Age group filter: Array of age codes from '1' to '11'")
        },
        async (params: NaverSearchTrendParams, _extra: RequestHandlerExtra): Promise<McpResponse> => {
            try {
                // 네이버 데이터랩 API 호출
                const response = await fetchNaverSearchTrend(params);
                
                // 결과 포맷팅
                const formattedResult = formatSearchTrendResult(response);
                
                // 응답 생성
                return createMcpResponse(formattedResult);
            } catch (error: any) {
                return createErrorResponse(error);
            }
        }
    );

    // 네이버 쇼핑인사이트 분야별 트렌드 API
    server.tool(
        "getNaverShoppingCategoryTrend",
        `Retrieves shopping category trend data from Naver Shopping Insights API. Allows comparing search volume trends across different shopping categories.

Parameters:
- startDate (required): Start date in YYYY-MM-DD format (available from 2017-08-01)
- endDate (required): End date in YYYY-MM-DD format
- timeUnit (required): Time unit for data aggregation ("date", "week", or "month")
- category (required): Array of shopping categories to compare (max 3 categories)
  - name: Name of the shopping category
  - param: Array of category codes from Naver Shopping (cat_id parameter from shopping.naver.com)
- device (optional): Device type filter ("pc" for desktop, "mo" for mobile, or empty for all)
- gender (optional): Gender filter ("f" for female, "m" for male, or empty for all)
- ages (optional): Array of age group codes from "1" to "11"`,
        {
            ...dateRangeSchema,
            category: z.array(
                z.object({
                    name: z.string().describe("Name of the shopping category"),
                    param: z.array(z.string().min(1)).describe("Array of category codes from Naver Shopping")
                })
            ).min(1).max(3).describe("Array of shopping categories (max 3) to compare trends"),
            device: deviceSchema.describe("Device type filter: 'pc' for desktop, 'mo' for mobile, or empty for all"),
            gender: genderSchema.describe("Gender filter: 'f' for female, 'm' for male, or empty for all"),
            ages: agesSchema.describe("Age group filter: Array of age codes from '1' to '11'")
        },
        async (params: NaverShoppingCategoryTrendParams, _extra: RequestHandlerExtra): Promise<McpResponse> => {
            try {
                // 네이버 쇼핑인사이트 API 호출
                const response = await fetchNaverShoppingCategoryTrend(params);
                
                // 결과 포맷팅
                const formattedResult = formatShoppingTrendResult(response);
                
                // 응답 생성
                return createMcpResponse(formattedResult);
            } catch (error: any) {
                return createErrorResponse(error);
            }
        }
    );

    // 네이버 쇼핑인사이트 키워드별 트렌드 API
    server.tool(
        "getNaverShoppingKeywordTrend",
        `Retrieves keyword trend data within a specific shopping category from Naver Shopping Insights API. Allows comparing search volume trends for specific keywords in a category.

Parameters:
- startDate (required): Start date in YYYY-MM-DD format (available from 2017-08-01)
- endDate (required): End date in YYYY-MM-DD format
- timeUnit (required): Time unit for data aggregation ("date", "week", or "month")
- category (required): Shopping category code from Naver Shopping (cat_id parameter from shopping.naver.com)
- keyword (required): Array of keyword groups to compare (max 3 groups)
  - name: Name of the keyword group
  - param: Array of keywords to track (max 5 keywords per group)
- device (optional): Device type filter ("pc" for desktop, "mo" for mobile, or empty for all)
- gender (optional): Gender filter ("f" for female, "m" for male, or empty for all)
- ages (optional): Array of age group codes from "1" to "11"`,
        {
            ...dateRangeSchema,
            category: z.string().describe("Shopping category code from Naver Shopping"),
            keyword: z.array(
                z.object({
                    name: z.string().describe("Name of the keyword group"),
                    param: z.array(z.string().min(1).max(5)).describe("Array of keywords (max 5) to track in this group")
                })
            ).min(1).max(3).describe("Array of keyword groups (max 3) to compare trends"),
            device: deviceSchema.describe("Device type filter: 'pc' for desktop, 'mo' for mobile, or empty for all"),
            gender: genderSchema.describe("Gender filter: 'f' for female, 'm' for male, or empty for all"),
            ages: agesSchema.describe("Age group filter: Array of age codes from '1' to '11'")
        },
        async (params: NaverShoppingKeywordTrendParams, _extra: RequestHandlerExtra): Promise<McpResponse> => {
            try {
                // 네이버 쇼핑인사이트 API 호출
                const response = await fetchNaverShoppingKeywordTrend(params);
                
                // 결과 포맷팅
                const formattedResult = formatShoppingTrendResult(response);
                
                // 응답 생성
                return createMcpResponse(formattedResult, params.category);
            } catch (error: any) {
                return createErrorResponse(error);
            }
        }
    );

    // 카테고리 검색 API
    server.tool(
        "searchShoppingCategory",
        `Search for shopping categories using natural language queries. Returns the most similar categories based on semantic similarity.

Parameters:
- query (required): Natural language query to search for categories (e.g., "men's running shoes", "smartphone accessories")
- limit (optional): Maximum number of results to return (default: 5)`,
        {
            query: z.string().min(1).describe("Natural language query to search for shopping categories"),
            limit: z.number().min(1).max(20).optional().describe("Maximum number of results to return (1-20)")
        },
        async (params: { query: string; limit?: number }, _extra: RequestHandlerExtra): Promise<McpResponse> => {
            try {
                const limit = params.limit || 5;
                const results = await searchSimilarCategories(params.query, limit);
                
                const response: CategorySearchResponse = {
                    query: params.query,
                    results
                };
                
                return {
                    content: [
                        { 
                            type: "text", 
                            text: `"${params.query}" 검색 결과:\n\n${results.map(r => 
                                `카테고리 ID: ${r.cat_id}\n` +
                                `카테고리: ${r.full_category_path}\n` +
                                `유사도: ${(r.similarity! * 100).toFixed(2)}%`
                            ).join('\n\n')}`
                        },
                        { 
                            type: "text", 
                            text: JSON.stringify(response, null, 2),
                            meta: { format: "json" } 
                        }
                    ]
                };
            } catch (error: any) {
                return createErrorResponse(error);
            }
        }
    );

    // Start message exchange through stdin/stdout
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('네이버 데이터랩 MCP 서버가 시작되었습니다.');
}

main().catch((err) => {
    console.error('서버 실행 중 오류 발생:', err);
    process.exit(1);
}); 