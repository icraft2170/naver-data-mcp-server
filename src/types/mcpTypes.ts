import { z } from 'zod';

// MCP SDK의 타입 정의
export interface RequestHandlerExtra {
    [key: string]: unknown;
}

// MCP 응답 타입 정의
export interface McpResponse {
    content: Array<{
        type: "text";
        text: string;
        meta?: { format: string };
    }>;
    [key: string]: unknown;
}

// 공통으로 사용되는 ZOD 스키마 정의
export const timeUnitSchema = z.enum(["date", "week", "month"]);
export const deviceSchema = z.enum(["pc", "mo", ""]).optional();
export const genderSchema = z.enum(["f", "m", ""]).optional();
export const agesSchema = z.array(z.enum(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"])).optional();
export const dateRangeSchema = {
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식이어야 합니다"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식이어야 합니다"),
    timeUnit: timeUnitSchema
}; 