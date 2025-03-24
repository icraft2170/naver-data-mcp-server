import path from 'path';
import { fileURLToPath } from 'url';
import lowdb from 'lowdb';
import FileSync from 'lowdb/adapters/FileSync';

// ESM에서 __dirname 구현
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 데이터베이스 경로
const dbPath = path.join(__dirname, '../../data/categorieson');

// 카테고리 타입 정의
interface Category {
  cat_id: string;
  major_category: string;
  middle_category: string | null;
  minor_category: string | null;
  detailed_category: string | null;
}

// 데이터베이스 스키마 정의
interface DbSchema {
  categories: Category[];
}

// 데이터베이스 어댑터 생성
const adapter = new FileSync<DbSchema>(dbPath);

// 데이터베이스 초기화
const db = lowdb(adapter);

// 기본 데이터 구조 설정
db.defaults({ categories: [] }).write();

// 카테고리 검색 함수
export const searchCategories = (query: string): Category[] => {
  const searchPattern = query.toLowerCase();
  return db
    .get('categories')
    .filter((category: Category) => {
      const majorMatch = category.major_category?.toLowerCase().includes(searchPattern) || false;
      const middleMatch = category.middle_category?.toLowerCase().includes(searchPattern) || false;
      const minorMatch = category.minor_category?.toLowerCase().includes(searchPattern) || false;
      const detailedMatch = category.detailed_category?.toLowerCase().includes(searchPattern) || false;
      return majorMatch || middleMatch || minorMatch || detailedMatch;
    })
    .take(10)
    .value();
};

// 카테고리 ID로 카테고리 정보 조회
export const getCategoryById = (catId: string): Category | null => {
  const category = db
    .get('categories')
    .find({ cat_id: catId })
    .value();
  
  return category || null;
};

// 대분류 카테고리 목록 조회
export const getMajorCategories = (): Array<{ major_category: string }> => {
  const uniqueCategories = new Set<string>();
  
  const categories = db
    .get('categories')
    .value()
    .filter((category: Category) => {
      if (uniqueCategories.has(category.major_category)) {
        return false;
      }
      uniqueCategories.add(category.major_category);
      return true;
    })
    .map((category: Category) => ({ major_category: category.major_category }));
  
  return categories;
};

// 중분류 카테고리 목록 조회
export const getMiddleCategories = (majorCategory: string): Array<{ middle_category: string }> => {
  const uniqueCategories = new Set<string>();
  
  const categories = db
    .get('categories')
    .filter((category: Category) => {
      return category.major_category === majorCategory && 
             category.middle_category !== null && 
             category.middle_category !== undefined;
    })
    .value()
    .filter((category: Category) => {
      if (!category.middle_category || uniqueCategories.has(category.middle_category)) {
        return false;
      }
      uniqueCategories.add(category.middle_category);
      return true;
    })
    .map((category: Category) => ({ middle_category: category.middle_category as string }));
  
  return categories;
};

// 소분류 카테고리 목록 조회
export const getMinorCategories = (majorCategory: string, middleCategory: string): Array<{ minor_category: string }> => {
  const uniqueCategories = new Set<string>();
  
  const categories = db
    .get('categories')
    .filter((category: Category) => {
      return category.major_category === majorCategory && 
             category.middle_category === middleCategory && 
             category.minor_category !== null &&
             category.minor_category !== undefined;
    })
    .value()
    .filter((category: Category) => {
      if (!category.minor_category || uniqueCategories.has(category.minor_category)) {
        return false;
      }
      uniqueCategories.add(category.minor_category);
      return true;
    })
    .map((category: Category) => ({ minor_category: category.minor_category as string }));
  
  return categories;
};

// 세분류 카테고리 목록 조회
export const getDetailedCategories = (
  majorCategory: string,
  middleCategory: string,
  minorCategory: string
): Array<{ detailed_category: string }> => {
  const uniqueCategories = new Set<string>();
  
  const categories = db
    .get('categories')
    .filter((category: Category) => {
      return category.major_category === majorCategory && 
             category.middle_category === middleCategory && 
             category.minor_category === minorCategory &&
             category.detailed_category !== null &&
             category.detailed_category !== undefined;
    })
    .value()
    .filter((category: Category) => {
      if (!category.detailed_category || uniqueCategories.has(category.detailed_category)) {
        return false;
      }
      uniqueCategories.add(category.detailed_category);
      return true;
    })
    .map((category: Category) => ({ detailed_category: category.detailed_category as string }));
  
  return categories;
}; 