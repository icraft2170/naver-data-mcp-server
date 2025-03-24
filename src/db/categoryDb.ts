import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM에서 __dirname 구현
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 데이터베이스 경로
const dbPath = path.join(__dirname, '../../data/categories.db');

// 데이터베이스 연결
const db = new Database(dbPath);

// 카테고리 타입 정의
interface Category {
  cat_id: string;
  major_category: string;
  middle_category: string | null;
  minor_category: string | null;
  detailed_category: string | null;
}

// 카테고리 검색 함수
export const searchCategories = (query: string): Category[] => {
  const searchQuery = db.prepare(`
    SELECT cat_id, major_category, middle_category, minor_category, detailed_category
    FROM categories
    WHERE major_category LIKE ? 
    OR middle_category LIKE ?
    OR minor_category LIKE ?
    OR detailed_category LIKE ?
    LIMIT 10
  `);

  const searchPattern = `%${query}%`;
  return searchQuery.all(searchPattern, searchPattern, searchPattern, searchPattern) as Category[];
};

// 카테고리 ID로 카테고리 정보 조회
export const getCategoryById = (catId: string): Category | null => {
  const query = db.prepare(`
    SELECT cat_id, major_category, middle_category, minor_category, detailed_category
    FROM categories
    WHERE cat_id = ?
  `);
  
  return query.get(catId) as Category || null;
};

// 대분류 카테고리 목록 조회
export const getMajorCategories = (): Array<{ major_category: string }> => {
  const query = db.prepare(`
    SELECT DISTINCT major_category
    FROM categories
    ORDER BY major_category
  `);
  
  return query.all() as Array<{ major_category: string }>;
};

// 중분류 카테고리 목록 조회
export const getMiddleCategories = (majorCategory: string): Array<{ middle_category: string }> => {
  const query = db.prepare(`
    SELECT DISTINCT middle_category
    FROM categories
    WHERE major_category = ?
    AND middle_category IS NOT NULL
    ORDER BY middle_category
  `);
  
  return query.all(majorCategory) as Array<{ middle_category: string }>;
};

// 소분류 카테고리 목록 조회
export const getMinorCategories = (majorCategory: string, middleCategory: string): Array<{ minor_category: string }> => {
  const query = db.prepare(`
    SELECT DISTINCT minor_category
    FROM categories
    WHERE major_category = ?
    AND middle_category = ?
    AND minor_category IS NOT NULL
    ORDER BY minor_category
  `);
  
  return query.all(majorCategory, middleCategory) as Array<{ minor_category: string }>;
};

// 세분류 카테고리 목록 조회
export const getDetailedCategories = (
  majorCategory: string,
  middleCategory: string,
  minorCategory: string
): Array<{ detailed_category: string }> => {
  const query = db.prepare(`
    SELECT DISTINCT detailed_category
    FROM categories
    WHERE major_category = ?
    AND middle_category = ?
    AND minor_category = ?
    AND detailed_category IS NOT NULL
    ORDER BY detailed_category
  `);
  
  return query.all(majorCategory, middleCategory, minorCategory) as Array<{ detailed_category: string }>;
}; 