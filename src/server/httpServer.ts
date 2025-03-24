/**
 * HTTP 서버 관련 기능 
 */
import { createJsonRpcErrorResponse } from '../utils/response.js';

// Express 서버 타입 정의
let expressApp: any;
let httpServer: any;

// 도구 핸들러를 저장하는 맵
const toolHandlers = new Map<string, any>();

/**
 * HTTP 서버 시작 함수
 * @param port 서버 포트
 * @returns HTTP 서버 인스턴스
 */
export const startHttpServer = async (port: number): Promise<any> => {
    try {
        const express = await import('express');
        expressApp = express.default();
        expressApp.use(express.json());
        
        // HTTP 요청 처리
        expressApp.post('/', async (req: any, res: any) => {
            try {
                const request = req.body;
                
                if (!request || !request.method || !request.jsonrpc || !request.params) {
                    return res.status(400).json(createJsonRpcErrorResponse(request?.id, -32600, "유효하지 않은 JSON-RPC 요청"));
                }
                
                const { id, method, params } = request;

                // callTool 메서드 처리
                if (method === 'callTool') {
                    const { name, parameters } = params;
                    
                    // 도구 이름으로 해당 도구 찾기
                    if (!toolHandlers.has(name)) {
                        return res.status(404).json(createJsonRpcErrorResponse(id, -32601, `도구 '${name}'를 찾을 수 없습니다.`));
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
                        return res.json(createJsonRpcErrorResponse(id, -32000, error.message));
                    }
                } else {
                    // 지원하지 않는 메서드
                    return res.json(createJsonRpcErrorResponse(id, -32601, `메서드 '${method}'는 지원되지 않습니다.`));
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
        httpServer = expressApp.listen(port, () => {
            console.error(JSON.stringify({
                type: 'info',
                message: `HTTP 서버가 http://localhost:${port} 에서 시작되었습니다.`
            }));
        });
        
        return httpServer;
    } catch (error: any) {
        console.error(JSON.stringify({
            type: 'warning',
            message: `HTTP 서버 시작 실패: ${error.message}.`
        }));
        throw error;
    }
};

/**
 * 도구 핸들러 등록 함수
 * @param name 도구 이름
 * @param handler 도구 핸들러 함수
 */
export const registerToolHandler = (name: string, handler: any): void => {
    toolHandlers.set(name, handler);
};

/**
 * 서버 종료 함수
 */
export const stopHttpServer = (): void => {
    if (httpServer) {
        console.error(JSON.stringify({
            type: 'info',
            message: 'HTTP 서버를 종료합니다.'
        }));
        httpServer.close();
    }
}; 