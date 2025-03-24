import { 
    FormattedNaverSearchTrendResult, 
    FormattedNaverShoppingTrendResult 
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
    formattedResult: FormattedNaverSearchTrendResult | FormattedNaverShoppingTrendResult, 
    category?: string
): McpResponse => {
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