import 'dotenv/config';
import fetch from 'node-fetch';

interface McpResponse {
    jsonrpc: string;
    id: number;
    result?: any;
    error?: {
        code: number;
        message: string;
    };
}

/**
 * MCP 서버에 도구 호출 요청을 보내는 함수
 * @param toolName 호출할 도구 이름
 * @param params 도구 파라미터
 * @returns 도구 호출 결과
 */
async function callMcpTool(toolName: string, params: any) {
    try {
        // MCP 도구 호출을 위한 요청 데이터 구성
        const requestData = {
            jsonrpc: '2.0',
            id: new Date().getTime(),
            method: 'callTool',
            params: {
                name: toolName,
                parameters: params
            }
        };

        console.log(`[DEBUG] ${toolName} 호출 파라미터:`, JSON.stringify(params, null, 2));

        // 로컬 MCP 서버에 요청
        const response = await fetch('http://localhost:3001', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
        });

        // 응답 처리
        const responseData = await response.json() as McpResponse;

        // 응답 세부 정보 로깅
        console.log(`[RESPONSE] JSON 응답 데이터 구조:`, 
          JSON.stringify({
            hasResult: !!responseData.result,
            hasError: !!responseData.error,
            resultType: responseData.result ? typeof responseData.result : 'N/A',
            errorMessage: responseData.error ? responseData.error.message : 'N/A',
            status: response.status
          }, null, 2)
        );

        if (responseData.error) {
            throw new Error(`MCP 도구 호출 오류: ${responseData.error.message}`);
        }
        
        return responseData.result;
    } catch (error: any) {
        console.error(`도구 호출 중 오류 발생: ${error.message}`);
        throw error;
    }
}

/**
 * 다양한 분야의 쇼핑 카테고리로 트렌드 검색을 테스트하는 함수
 */
async function testMultipleCategories() {
    console.log('\n--- 다양한 분야의 쇼핑 카테고리 트렌드 테스트 ---');
    
    try {
        // 여러 카테고리 검색
        const categories = [
            { query: '스마트폰', limit: 1 },
            { query: '노트북', limit: 1 },
            { query: '헤드폰', limit: 1 }
        ];
        
        const categoryIds = [];
        
        // 각 카테고리 검색 및 ID 추출
        for (const category of categories) {
            const result = await callMcpTool('searchShoppingCategory', category);
            
            if (!result || !result[0] || !result[0].text) {
                console.log(`${category.query} 카테고리 검색 결과가 없습니다.`);
                continue;
            }
            
            const firstResult = result[0].text;
            const match = firstResult.match(/카테고리 ID: (\d+)/);
            if (!match) {
                console.log(`${category.query} 카테고리 ID를 찾을 수 없습니다.`);
                continue;
            }
            
            categoryIds.push({
                name: category.query,
                id: match[1]
            });
        }
        
        console.log('검색된 카테고리:', categoryIds);
        
        // 검색된 카테고리가 2개 이상일 경우에만 카테고리 비교 테스트 진행
        if (categoryIds.length >= 2) {
            const categoryTrendParams = {
                startDate: '2023-01-01',
                endDate: '2023-12-31',
                timeUnit: 'month',
                category: categoryIds.slice(0, 2).map(cat => ({
                    name: cat.name,
                    param: [cat.id]
                }))
            };
            
            const trendResult = await callMcpTool('getNaverShoppingCategoryTrend', categoryTrendParams);
            console.log('다중 카테고리 트렌드 결과:');
            console.log(JSON.stringify(trendResult, null, 2));
        }
        
        return categoryIds;
    } catch (error: any) {
        console.error(`다중 카테고리 테스트 중 오류 발생: ${error.message}`);
        return [];
    }
}

/**
 * MCP 서버 테스트를 실행하는 메인 함수
 */
async function runMcpTest() {
    console.log('--- MCP 서버 테스트 시작 ---');
    
    try {
        // 1. 카테고리 검색 테스트
        console.log('1. 쇼핑 카테고리 검색 테스트');
        const categorySearchParams = {
            query: '스마트폰 케이스',
            limit: 3
        };
        
        const categorySearchResult = await callMcpTool('searchShoppingCategory', categorySearchParams);
        console.log('카테고리 검색 결과:');
        console.log(JSON.stringify(categorySearchResult, null, 2));
        
        // 검색된 카테고리가 있는지 확인
        if (!categorySearchResult.content || !categorySearchResult.content[0] || 
            !categorySearchResult.content[0].text) {
            throw new Error('카테고리 검색 결과가 없습니다.');
        }
        
        // 첫 번째 카테고리 ID 추출
        const firstResult = categorySearchResult.content[0].text;
        const match = firstResult.match(/카테고리 ID: (\d+)/);
        if (!match) {
            throw new Error('카테고리 ID를 찾을 수 없습니다.');
        }
        
        const categoryId = match[1];
        console.log(`첫 번째 카테고리 ID: ${categoryId}`);
        
        // 2. 쇼핑인사이트 분야별 트렌드 테스트
        console.log('\n2. 쇼핑인사이트 분야별 트렌드 테스트');
        const shoppingCategoryTrendParams = {
            startDate: '2023-01-01',
            endDate: '2023-12-31',
            timeUnit: 'month',
            category: [
                {
                    name: '검색된 카테고리',
                    param: [categoryId]
                }
            ]
        };
        
        const categoryTrendResult = await callMcpTool(
            'getNaverShoppingCategoryTrend', 
            shoppingCategoryTrendParams
        );
        console.log('쇼핑인사이트 카테고리 트렌드 결과:');
        console.log(JSON.stringify(categoryTrendResult, null, 2));
        
        // 3. 쇼핑인사이트 키워드별 트렌드 테스트
        console.log('\n3. 쇼핑인사이트 키워드별 트렌드 테스트');
        const shoppingKeywordTrendParams = {
            startDate: '2023-01-01',
            endDate: '2023-12-31',
            timeUnit: 'month',
            category: categoryId,
            keyword: [
                {
                    name: '아이폰',
                    param: ['아이폰']
                }
            ]
        };
        
        const keywordTrendResult = await callMcpTool(
            'getNaverShoppingKeywordTrend', 
            shoppingKeywordTrendParams
        );
        console.log('쇼핑인사이트 키워드 트렌드 결과:');
        console.log(JSON.stringify(keywordTrendResult, null, 2));
        
        // 4. 여러 키워드 비교 테스트
        console.log('\n4. 여러 키워드 비교 테스트');
        const multiKeywordParams = {
            startDate: '2023-01-01',
            endDate: '2023-12-31',
            timeUnit: 'month',
            category: categoryId,
            keyword: [
                { name: '아이폰', param: ['아이폰'] },
                { name: '삼성', param: ['삼성'] },
                { name: '케이스', param: ['케이스'] }
            ]
        };
        
        try {
            const multiKeywordResult = await callMcpTool(
                'getNaverShoppingKeywordTrend', 
                multiKeywordParams
            );
            console.log('여러 키워드 비교 결과:');
            console.log(JSON.stringify(multiKeywordResult, null, 2));
        } catch (error) {
            console.log('여러 키워드 비교 테스트 중 오류 발생:', error);
        }
        
        // 5. 다양한 분야의 카테고리 테스트
        const categoryIds = await testMultipleCategories();
        
        // 6. 디바이스 필터 테스트
        if (categoryIds.length > 0) {
            console.log('\n5. 디바이스 필터 테스트');
            const deviceFilterParams = {
                startDate: '2023-01-01',
                endDate: '2023-12-31',
                timeUnit: 'month',
                category: categoryId,
                keyword: [{ name: '아이폰', param: ['아이폰'] }],
                device: 'mo' // 모바일 디바이스 필터 적용
            };
            
            try {
                const deviceFilterResult = await callMcpTool(
                    'getNaverShoppingKeywordTrend', 
                    deviceFilterParams
                );
                console.log('디바이스 필터 적용 결과:');
                console.log(JSON.stringify(deviceFilterResult, null, 2));
            } catch (error) {
                console.log('디바이스 필터 테스트 중 오류 발생:', error);
            }
        }
        
        console.log('\n--- MCP 서버 테스트 완료 ---');
    } catch (error: any) {
        console.error(`테스트 실행 중 오류 발생: ${error.message}`);
        process.exit(1);
    }
}

// 테스트 실행
runMcpTest(); 