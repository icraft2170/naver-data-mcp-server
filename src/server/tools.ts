import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { 
    fetchNaverSearchTrend, 
    fetchNaverShoppingCategoryTrend, 
    fetchNaverShoppingKeywordTrend,
    formatSearchTrendResult,
    formatShoppingTrendResult
} from '../functions/naver.js';
import { searchSimilarCategories } from '../services/categorySearch.js';
import { 
    NaverSearchTrendParams, 
    NaverShoppingCategoryTrendParams, 
    NaverShoppingKeywordTrendParams, 
    CategorySearchResult 
} from '../types/naverTypes.js';
import { 
    timeUnitSchema, 
    deviceSchema, 
    genderSchema, 
    agesSchema, 
    dateRangeSchema,
    RequestHandlerExtra 
} from '../types/mcpTypes.js';
import { createMcpResponse, createErrorResponse } from '../utils/response.js';
import { registerToolHandler } from './httpServer.js';

/**
 * MCP 도구 등록 함수
 * @param server MCP 서버 인스턴스
 */
export const registerMcpTools = (server: McpServer): void => {
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
- age (optional): Array of age group codes from "1" to "11"`,
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
        async (params: NaverSearchTrendParams, _extra: RequestHandlerExtra) => {
            try {
                // 네이버 데이터랩 API 호출
                const response = await fetchNaverSearchTrend(params);
                
                // 결과가 없는 경우 처리
                if (!response || !response.results) {
                    return createErrorResponse(new Error('API 응답에 결과 데이터가 없습니다.'));
                }
                
                // 결과 포맷팅
                const formattedResult = formatSearchTrendResult(response);
                
                // 응답 생성
                return createMcpResponse(formattedResult);
            } catch (error: any) {
                return createErrorResponse(error);
            }
        }
    );

    // HTTP 서버를 위해 핸들러 저장
    registerToolHandler("getNaverSearchTrend", async (params: NaverSearchTrendParams, _extra: RequestHandlerExtra) => {
        try {
            const response = await fetchNaverSearchTrend(params);
            const formattedResult = formatSearchTrendResult(response);
            return createMcpResponse(formattedResult);
        } catch (error: any) {
            return createErrorResponse(error);
        }
    });

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
        async (params: NaverShoppingCategoryTrendParams, _extra: RequestHandlerExtra) => {
            try {
                
                // 네이버 쇼핑인사이트 API 호출
                const response = await fetchNaverShoppingCategoryTrend(params);
                
                
                // 응답 유효성 검사
                if (!response) {
                    return createErrorResponse(new Error('API 응답이 없습니다.'));
                }
                
                // results 필드가 없는 경우 빈 배열로 초기화
                if (!response.results) {
                    response.results = [];
                }
                
                // 결과 포맷팅
                const formattedResult = formatShoppingTrendResult(response);
                
                // 응답 생성
                return createMcpResponse(formattedResult);
            } catch (error: any) {
                console.error('쇼핑 카테고리 트렌드 API 오류:', error);
                return createErrorResponse(error);
            }
        }
    );

    // HTTP 서버를 위해 핸들러 저장
    registerToolHandler("getNaverShoppingCategoryTrend", async (params: NaverShoppingCategoryTrendParams, _extra: RequestHandlerExtra) => {
        try {
            
            const response = await fetchNaverShoppingCategoryTrend(params);
        
            
            // 응답 유효성 검사
            if (!response) {
                return createErrorResponse(new Error('API 응답이 없습니다.'));
            }
            
            // results 필드가 없는 경우 빈 배열로 초기화
            if (!response.results) {
                response.results = [];
            }
            
            const formattedResult = formatShoppingTrendResult(response);
            return createMcpResponse(formattedResult);
        } catch (error: any) {
            console.error('쇼핑 카테고리 트렌드 HTTP API 오류:', error);
            return createErrorResponse(error);
        }
    });

    // 네이버 쇼핑인사이트 키워드별 트렌드 API
    server.tool(
        "getNaverShoppingKeywordTrend",
        `Retrieves shopping keyword trend data from Naver Shopping Insights API. Allows comparing search volume trends for specific keywords within a shopping category.

Parameters:
- startDate (required): Start date in YYYY-MM-DD format (available from 2017-08-01)
- endDate (required): End date in YYYY-MM-DD format
- timeUnit (required): Time unit for data aggregation ("date", "week", or "month")
- category (required): Shopping category code from Naver Shopping (cat_id parameter from shopping.naver.com)
- keyword (required): Array of keyword groups to compare (max 3 groups)
  - name: Name of the keyword group
  - param: Array of keywords to track (max 5 characters per keyword)
- device (optional): Device type filter ("pc" for desktop, "mo" for mobile, or empty for all)
- gender (optional): Gender filter ("f" for female, "m" for male, or empty for all)
- ages (optional): Array of age group codes from "1" to "11"

Note: Each keyword in the param array must be 5 characters or less. If a keyword exceeds 5 characters, only the first 5 characters will be used.`,
        {
            ...dateRangeSchema,
            category: z.string().describe("Shopping category code from Naver Shopping"),
            keyword: z.array(
                z.object({
                    name: z.string().describe("Name of the keyword group"),
                    param: z.array(
                        z.string()
                            .min(1)
                            .max(5)
                            .refine(
                                (val) => val.length <= 5,
                                { message: "검색어는 최대 5자까지만 가능합니다." }
                            )
                    ).describe("Array of keywords (max 5 characters per keyword) to track in this group")
                })
            ).min(1).max(3).describe("Array of keyword groups (max 3) to compare trends"),
            device: deviceSchema.describe("Device type filter: 'pc' for desktop, 'mo' for mobile, or empty for all"),
            gender: genderSchema.describe("Gender filter: 'f' for female, 'm' for male, or empty for all"),
            ages: agesSchema.describe("Age group filter: Array of age codes from '1' to '11'")
        },
        async (params: NaverShoppingKeywordTrendParams, _extra: RequestHandlerExtra) => {
            try {
                
                // 네이버 쇼핑인사이트 API 호출
                const response = await fetchNaverShoppingKeywordTrend(params);
                
                
                // 응답 유효성 검사
                if (!response) {
                    return createErrorResponse(new Error('API 응답이 없습니다.'));
                }
                
                // results 필드가 없는 경우 빈 배열로 초기화
                if (!response.results) {
                    response.results = [];
                }
                
                // 결과 포맷팅
                const formattedResult = formatShoppingTrendResult(response);
                
                // 응답 생성
                return createMcpResponse(formattedResult, params.category);
            } catch (error: any) {
                console.error('쇼핑 키워드 트렌드 API 오류:', error);
                return createErrorResponse(error);
            }
        }
    );

    // HTTP 서버를 위해 핸들러 저장
    registerToolHandler("getNaverShoppingKeywordTrend", async (params: NaverShoppingKeywordTrendParams, _extra: RequestHandlerExtra) => {
        try {
            
            const response = await fetchNaverShoppingKeywordTrend(params);
            
            
            // 응답 유효성 검사
            if (!response) {
                return createErrorResponse(new Error('API 응답이 없습니다.'));
            }
            
            // results 필드가 없는 경우 빈 배열로 초기화
            if (!response.results) {
                response.results = [];
            }
            
            const formattedResult = formatShoppingTrendResult(response);
            return createMcpResponse(formattedResult, params.category);
        } catch (error: any) {
            console.error('쇼핑 키워드 트렌드 HTTP API 오류:', error);
            return createErrorResponse(error);
        }
    });

    // 쇼핑 카테고리 검색 도구
    server.tool(
        "searchShoppingCategory",
        `Searches for shopping categories based on a query string.

Parameters:
- query (required): Search query string
- limit (optional): Maximum number of results to return (default: 5)`,
        {
            query: z.string().describe("Search query string"),
            limit: z.number().min(1).max(10).default(5).describe("Maximum number of results to return")
        },
        async (params: { query: string; limit: number }, _extra: RequestHandlerExtra) => {
            try {
                const results = await searchSimilarCategories(params.query, params.limit);
                return createMcpResponse({
                    title: "쇼핑 카테고리 검색 결과",
                    query: params.query,
                    results
                });
            } catch (error: any) {
                return createErrorResponse(error);
            }
        }
    );

    // HTTP 서버를 위해 핸들러 저장
    registerToolHandler("searchShoppingCategory", async (params: { query: string; limit: number }, _extra: RequestHandlerExtra) => {
        try {
            const results = await searchSimilarCategories(params.query, params.limit);
            return createMcpResponse({
                title: "쇼핑 카테고리 검색 결과",
                query: params.query,
                results
            });
        } catch (error: any) {
            return createErrorResponse(error);
        }
    });
}; 