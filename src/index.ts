#!/usr/bin/env node

import 'dotenv/config';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerMcpTools } from './server/tools.js';
import { startHttpServer, stopHttpServer } from './server/httpServer.js';

// Node 버전 체크
const requiredVersion = 18;
const currentVersion = parseInt(process.version.slice(1).split('.')[0]);

if (currentVersion < requiredVersion) {
    console.error(JSON.stringify({
        type: 'warning',
        message: `권장 Node 버전은 18.0.0 이상입니다. 현재 버전: ${process.version}. 일부 기능이 제대로 작동하지 않을 수 있습니다.`
    }));
}

// 환경 변수 유효성 검사
if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
    console.error(JSON.stringify({
        type: 'error',
        message: 'NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET 환경 변수가 설정되지 않았습니다.'
    }));
    process.exit(1);
}

// 종료 시 리소스 정리 함수
const cleanup = () => {
    stopHttpServer();
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
        // MCP 서버 생성
        const server = new McpServer({
            name: "네이버 데이터랩",
            version: "1.0.0",
            port: process.env.PORT ? parseInt(process.env.PORT) : 3001,
            host: process.env.HOST || 'localhost'
        });

        // HTTP 서버 시작
        try {
            const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;
            await startHttpServer(port);
        } catch (error: any) {
            console.error(JSON.stringify({
                type: 'warning',
                message: `HTTP 서버 시작 실패: ${error.message}. StdioServerTransport만 사용합니다.`
            }));
        }

        // MCP 도구 등록
        registerMcpTools(server);

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