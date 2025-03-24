#!/usr/bin/env node

import 'dotenv/config';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { 
    fetchNaverSearchTrend, 
    fetchNaverShoppingCategoryTrend, 
    fetchNaverShoppingKeywordTrend,
    formatSearchTrendResult,
    formatShoppingTrendResult
} from './functions/naver.js';
import { searchSimilarCategories } from './services/categorySearch.js';
import { initDatabase, generateAllCategoryEmbeddings } from './services/categorySearch.js';
import { 
    NaverSearchTrendParams, 
    NaverShoppingCategoryTrendParams, 
    NaverShoppingKeywordTrendParams, 
    FormattedNaverSearchTrendResult, 
    FormattedNaverShoppingTrendResult, 
    CategorySearchResponse,
    Category
} from './types/naverTypes';

// Node 버전 체크
const requiredVersion = 18;
const currentVersion = parseInt(process.version.slice(1).split('.')[0]);

if (currentVersion < requiredVersion) {
    console.error(JSON.stringify({
        type: 'warning',
        message: `권장 Node 버전은 18.0.0 이상입니다. 현재 버전: ${process.version}. 일부 기능이 제대로 작동하지 않을 수 있습니다.`
    }));
    // 경고만 표시하고 계속 실행
}

// MCP SDK의 타입 정의
interface RequestHandlerExtra {
    [key: string]: unknown;
}

// Express 서버 타입 정의
let expressApp: any;
let httpServer: any;

// 도구 핸들러를 저장하는 맵
const toolHandlers = new Map<string, any>();

// 환경 변수 유효성 검사
if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
    console.error(JSON.stringify({
        type: 'error',
        message: 'NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET 환경 변수가 설정되지 않았습니다.'
    }));
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
    [key: string]: unknown;
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

    // 데이터가 없을 경우 처리
    if (!result.data || result.data.length === 0) {
        return resultText + "데이터가 없습니다.";
    }

    // 첫 번째 데이터 항목이 있는지 확인
    if (!result.data[0]) {
        return resultText + "데이터가 없습니다.";
    }

    // 데이터 정보
    try {
        if (result.data[0] && 'keywords' in result.data[0] && Array.isArray(result.data[0].keywords)) {
            // 검색어 트렌드 결과
            const searchResult = result as FormattedNaverSearchTrendResult;
            resultText += searchResult.data.map(item => {
                if (!item || !item.keywords || !Array.isArray(item.keywords)) {
                    return `[${item?.period || '날짜 정보 없음'}] 데이터 없음`;
                }
                return `[${item.period}] ${item.keywords.map(k => `${k.keyword}: ${k.ratio.toFixed(2)}`).join(', ')}`;
            }).join('\n');
        } else if (result.data[0] && 'categories' in result.data[0] && Array.isArray(result.data[0].categories)) {
            // 쇼핑인사이트 결과
            const shoppingResult = result as FormattedNaverShoppingTrendResult;
            resultText += shoppingResult.data.map(item => {
                if (!item || !item.categories || !Array.isArray(item.categories)) {
                    return `[${item?.period || '날짜 정보 없음'}] 데이터 없음`;
                }
                return `[${item.period}] ${item.categories.map(c => `${c.category}: ${c.ratio.toFixed(2)}`).join(', ')}`;
            }).join('\n');
        } else {
            // 데이터 구조가 예상과 다른 경우
            resultText += "데이터 형식이 예상과 다릅니다.";
        }
    } catch (error) {
        // 처리 중 오류 발생 시
        console.error('결과 포맷팅 중 오류 발생:', error);
        resultText += "결과 처리 중 오류가 발생했습니다.";
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

// 종료 시 리소스 정리 함수
const cleanup = () => {
    if (httpServer) {
        console.error(JSON.stringify({
            type: 'info',
            message: 'HTTP 서버를 종료합니다.'
        }));
        httpServer.close();
    }
};

// 종료 시그널 처리
process.on('SIGINT', () => {
    console.error(JSON.stringify({
        type: 'info',
        message: 'SIGINT 시그널을 받았습니다. 종료합니다.'
    }));
    cleanup();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.error(JSON.stringify({
        type: 'info',
        message: 'SIGTERM 시그널을 받았습니다. 종료합니다.'
    }));
    cleanup();
    process.exit(0);
});

async function main() {
    try {
        // Create MCP server
        const server = new McpServer({
            name: "네이버 데이터랩",
            version: "1.0.0",
            port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
            host: process.env.HOST || 'localhost'
        });

        // HTTP 서버 설정 (Express 사용)
        try {
            const express = await import('express');
            expressApp = express.default();
            expressApp.use(express.json());

            // 모든 도구 등록
            // 이 부분은 아래 server.tool() 호출 이후에 정의된 핸들러를 사용하기 위한 저장소입니다.
            
            // HTTP 요청 처리
            expressApp.post('/', async (req: any, res: any) => {
                try {
                    // 에러 응답 생성 헬퍼 함수
                    const createErrorResponse = (id: any, code: number, message: string) => {
                        return {
                            jsonrpc: '2.0',
                            error: { code, message },
                            id
                        };
                    };

                    const request = req.body;
                    
                    if (!request || !request.method || !request.jsonrpc || !request.params) {
                        return res.status(400).json(createErrorResponse(request?.id, -32600, "유효하지 않은 JSON-RPC 요청"));
                    }
                    
                    const { id, method, params } = request;

                    // callTool 메서드 처리
                    if (method === 'callTool') {
                        const { name, parameters } = params;
                        
                        // 도구 이름으로 해당 도구 찾기
                        if (!toolHandlers.has(name)) {
                            return res.status(404).json(createErrorResponse(id, -32601, `도구 '${name}'를 찾을 수 없습니다.`));
                        }

                        try {
                            // 도구 실행
                            const handler = toolHandlers.get(name);
                            const result = await handler(parameters, {});
                            return res.json({
                                jsonrpc: '2.0',
                                result,
                                id
                            });
                        } catch (error: any) {
                            return res.json(createErrorResponse(id, -32000, error.message));
                        }
                    } else {
                        // 지원하지 않는 메서드
                        return res.json(createErrorResponse(id, -32601, `메서드 '${method}'는 지원되지 않습니다.`));
                    }
                } catch (error: any) {
                    res.status(500).json({
                        jsonrpc: '2.0',
                        error: {
                            code: -32000,
                            message: `서버 오류: ${error.message}`
                        },
                        id: req.body?.id
                    });
                }
            });

            // 서버 시작
            const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
            httpServer = expressApp.listen(port, () => {
                console.error(JSON.stringify({
                    type: 'info',
                    message: `HTTP 서버가 http://localhost:${port} 에서 시작되었습니다.`
                }));
            });
        } catch (error: any) {
            console.error(JSON.stringify({
                type: 'warning',
                message: `HTTP 서버 시작 실패: ${error.message}. StdioServerTransport만 사용합니다.`
            }));
        }

        // 백그라운드에서 데이터베이스 초기화 시작
        console.error(JSON.stringify({
            type: 'info',
            message: '데이터베이스 초기화를 시작합니다...'
        }));
        
        const db = await initDatabase();
        console.error(JSON.stringify({
            type: 'info',
            message: '데이터베이스 초기화가 완료되었습니다.'
        }));
        
        // 임베딩 생성 시작
        generateAllCategoryEmbeddings().then(() => {
            console.error(JSON.stringify({
                type: 'info',
                message: '카테고리 임베딩 생성이 완료되었습니다.'
            }));
        }).catch((error: Error) => {
            console.error(JSON.stringify({
                type: 'error',
                message: '카테고리 임베딩 생성 중 오류 발생',
                error: error.message
            }));
        });

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
            async (params: NaverSearchTrendParams, _extra: RequestHandlerExtra): Promise<McpResponse> => {
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
        toolHandlers.set("getNaverSearchTrend", async (params: NaverSearchTrendParams, _extra: RequestHandlerExtra): Promise<McpResponse> => {
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
            async (params: NaverShoppingCategoryTrendParams, _extra: RequestHandlerExtra): Promise<McpResponse> => {
                try {
                    console.log('getNaverShoppingCategoryTrend 요청 파라미터:', JSON.stringify(params, null, 2));
                    
                    // 네이버 쇼핑인사이트 API 호출
                    const response = await fetchNaverShoppingCategoryTrend(params);
                    
                    console.log('API 응답:', JSON.stringify(response, null, 2));
                    
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
        toolHandlers.set("getNaverShoppingCategoryTrend", async (params: NaverShoppingCategoryTrendParams, _extra: RequestHandlerExtra): Promise<McpResponse> => {
            try {
                console.log('getNaverShoppingCategoryTrend HTTP 요청 파라미터:', JSON.stringify(params, null, 2));
                
                const response = await fetchNaverShoppingCategoryTrend(params);
                
                console.log('API 응답:', JSON.stringify(response, null, 2));
                
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
                    console.log('getNaverShoppingKeywordTrend 요청 파라미터:', JSON.stringify(params, null, 2));
                    
                    // 네이버 쇼핑인사이트 API 호출
                    const response = await fetchNaverShoppingKeywordTrend(params);
                    
                    console.log('API 응답:', JSON.stringify(response, null, 2));
                    
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
        toolHandlers.set("getNaverShoppingKeywordTrend", async (params: NaverShoppingKeywordTrendParams, _extra: RequestHandlerExtra): Promise<McpResponse> => {
            try {
                console.log('getNaverShoppingKeywordTrend HTTP 요청 파라미터:', JSON.stringify(params, null, 2));
                
                const response = await fetchNaverShoppingKeywordTrend(params);
                
                console.log('API 응답:', JSON.stringify(response, null, 2));
                
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

        // HTTP 서버를 위해 핸들러 저장
        toolHandlers.set("searchShoppingCategory", async (params: { query: string; limit?: number }, _extra: RequestHandlerExtra): Promise<McpResponse> => {
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
        });

        // Start message exchange through stdin/stdout
        const transport = new StdioServerTransport();
        await server.connect(transport);

        console.error(JSON.stringify({
            type: 'info',
            message: '네이버 데이터랩 MCP 서버가 시작되었습니다.'
        }));
    } catch (error: any) {
        console.error(JSON.stringify({
            type: 'error',
            message: '서버 실행 중 오류 발생',
            error: error.message
        }));
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(JSON.stringify({
        type: 'error',
        message: '서버 실행 중 오류 발생',
        error: err.message
    }));
    process.exit(1); 
}); 