import { 
    FormattedNaverSearchTrendResult, 
    FormattedNaverShoppingTrendResult,
    CategorySearchResult
} from '../types/naverTypes.js';
import { McpResponse } from '../types/mcpTypes.js';
import { formatResultText } from './formatter.js';

/**
 * MCP 응답 생성 함수
 * @param formattedResult 포맷팅된 결과 데이터
 * @param category 선택적 카테고리 정보
 * @returns MCP 응답 객체
 */
export const createMcpResponse = (
    formattedResult: FormattedNaverSearchTrendResult | FormattedNaverShoppingTrendResult | CategorySearchResult, 
    category?: string
): McpResponse => {
    // 카테고리 검색 결과인 경우 다른 포맷 사용
    if ('query' in formattedResult) {
        return {
            content: [
                { 
                    type: "text", 
                    text: `"${formattedResult.query}" 검색 결과:\n\n${formattedResult.results.map(r => 
                        `카테고리 ID: ${r.cat_id}\n` +
                        `카테고리: ${r.full_category_path}\n` +
                        `유사도: ${(r.similarity * 100).toFixed(2)}%`
                    ).join('\n\n')}`
                },
                { 
                    type: "text", 
                    text: JSON.stringify(formattedResult, null, 2),
                    meta: { format: "json" } 
                }
            ]
        };
    }

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
export const createErrorResponse = (error: any): McpResponse => {
    // 개발 환경에서만 상세 오류 로깅
    if (process.env.NODE_ENV === 'development') {
        console.error('API 오류 상세:', error);
    }

    // USON 관련 오류나 JSON 파싱 오류인 경우 일반적인 오류 메시지 반환
    const isParsingError = error.message?.includes('USON') || 
                          error.message?.includes('JSON') ||
                          error.message?.includes('parsing') ||
                          error.message?.includes('parse');

    // 키워드 길이 제한 오류인 경우
    const isKeywordLengthError = error.message?.includes('too_big') && 
                                error.message?.includes('5 character');

    // Zod 검증 오류인 경우
    const isZodError = error.message?.includes('ZodError') || 
                       error.message?.includes('Invalid input') ||
                       error.message?.includes('Expected object');

    let errorMessage: string;
    if (isParsingError) {
        errorMessage = '데이터 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    } else if (isKeywordLengthError) {
        errorMessage = '검색어는 5자를 초과할 수 없습니다. 더 짧은 검색어를 사용해주세요.';
    } else if (isZodError) {
        errorMessage = '입력하신 데이터 형식이 올바르지 않습니다. 파라미터 형식을 확인해주세요.';
    } else {
        errorMessage = error.message || '알 수 없는 오류가 발생했습니다.';
    }

    return {
        content: [{ 
            type: "text", 
            text: JSON.stringify({
                error: errorMessage,
                details: error.response?.data || "네이버 API 호출 중 오류가 발생했습니다"
            }, null, 2) 
        }]
    };
};

/**
 * JSON-RPC 에러 응답 객체 생성 함수
 * @param id 요청 ID
 * @param code 에러 코드
 * @param message 에러 메시지
 * @returns JSON-RPC 에러 응답 객체
 */
export const createJsonRpcErrorResponse = (id: any, code: number, message: string): any => {
    return {
        jsonrpc: '2.0',
        error: { code, message },
        id
    };
}; 