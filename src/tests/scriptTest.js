// ESM import
import { searchSimilarCategories } from '../services/categorySearch.js';

/**
 * 카테고리 검색 테스트 모듈
 * 
 * 다양한 검색어를 사용하여 카테고리 검색 기능을 테스트합니다.
 * 각 검색어에 대해 검색 결과와 유사도를 출력하여 기능 확인을 수행합니다.
 */
const testCategorySearch = async () => {
  try {
    console.log('==== 카테고리 검색 테스트 시작 ====');
    
    // 테스트할 검색어 목록
    const queries = [
      '스마트폰',
      '노트북',
      '티셔츠',
      '소파',
      '사과',
      '액자',
      '요리책'
    ];
    
    // 각 검색어에 대해 검색 실행 및 결과 출력
    for (const query of queries) {
      console.log(`\n[검색어: "${query}"] 검색 중...`);
      
      try {
        const results = await searchSimilarCategories(query, 3);
        
        console.log(`검색 결과 (상위 ${results.length}개):`);
        results.forEach((item, index) => {
          console.log(`  ${index + 1}. cat_id: ${item.cat_id}`);
          console.log(`     카테고리: ${item.full_category_path}`);
          console.log(`     유사도: ${(item.similarity * 100).toFixed(2)}%`);
        });
      } catch (error) {
        console.error(`"${query}" 검색 중 오류 발생:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    // 한글 카테고리명으로 검색
    const categoryNames = [
      '패션의류',
      '디지털가전',
      '가구인테리어',
      '식품',
      '스포츠'
    ];
    
    console.log('\n\n==== 카테고리명 검색 테스트 ====');
    for (const category of categoryNames) {
      console.log(`\n[카테고리명: "${category}"] 검색 중...`);
      
      try {
        const results = await searchSimilarCategories(category, 3);
        
        console.log(`검색 결과 (상위 ${results.length}개):`);
        results.forEach((item, index) => {
          console.log(`  ${index + 1}. cat_id: ${item.cat_id}`);
          console.log(`     카테고리: ${item.full_category_path}`);
          console.log(`     유사도: ${(item.similarity * 100).toFixed(2)}%`);
        });
      } catch (error) {
        console.error(`"${category}" 검색 중 오류 발생:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    console.log('\n==== 카테고리 검색 테스트 완료 ====');
  } catch (error) {
    console.error('카테고리 검색 테스트 실행 중 오류 발생:', error instanceof Error ? error.message : String(error));
  }
};

// 테스트 실행
testCategorySearch(); 