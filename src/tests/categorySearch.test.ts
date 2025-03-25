import { searchSimilarCategories } from '../services/categorySearch.js';

/**
 * 카테고리 검색 테스트 모듈
 * 
 * 다양한 검색어를 사용하여 카테고리 검색 기능을 테스트합니다.
 * 각 검색어에 대해 검색 결과와 유사도를 출력하여 기능 확인을 수행합니다.
 */
console.log('==== 카테고리 검색 테스트 시작 ====\n');

// 검색어 테스트
const searchQueries = [
    '스마트폰',
    '노트북',
    '티셔츠',
    '소파',
    '사과',
    '액자',
    '요리책'
];

// 카테고리명 테스트
const categoryQueries = [
    '패션의류',
    '디지털가전',
    '가구인테리어',
    '식품',
    '스포츠'
];

// 검색어 테스트 실행
console.log('==== 검색어 테스트 ====\n');
searchQueries.forEach(query => {
    console.log(`[검색어: "${query}"] 검색 중...`);
    const results = searchSimilarCategories(query, 3);
    console.log('검색 결과 (상위 3개):');
    results.forEach((result, index) => {
        console.log(`  ${index + 1}. cat_id: ${result.cat_id}`);
        console.log(`     카테고리: ${result.full_category_path}`);
        console.log(`     유사도: ${result.similarity.toFixed(2)}%`);
    });
    console.log('');
});

// 카테고리명 테스트 실행
console.log('==== 카테고리명 검색 테스트 ====\n');
categoryQueries.forEach(query => {
    console.log(`[카테고리명: "${query}"] 검색 중...`);
    const results = searchSimilarCategories(query, 3);
    console.log('검색 결과 (상위 3개):');
    results.forEach((result, index) => {
        console.log(`  ${index + 1}. cat_id: ${result.cat_id}`);
        console.log(`     카테고리: ${result.full_category_path}`);
        console.log(`     유사도: ${result.similarity.toFixed(2)}%`);
    });
    console.log('');
});

console.log('==== 카테고리 검색 테스트 완료 ====\n'); 