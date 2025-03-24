import { 
    FormattedNaverSearchTrendResult, 
    FormattedNaverShoppingTrendResult 
} from '../types/naverTypes.js';

/**
 * 결과 데이터를 텍스트로 포맷팅하는 함수
 * @param result 포맷팅된 결과 데이터
 * @param category 선택적 카테고리 정보 (쇼핑 키워드 트렌드에만 사용)
 * @returns 포맷팅된 결과 텍스트
 */
export const formatResultText = (result: FormattedNaverSearchTrendResult | FormattedNaverShoppingTrendResult, category?: string): string => {
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