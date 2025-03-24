import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initData } from './initData.js';

// ESM에서 __dirname 구현
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 데이터베이스 경로
const dbPath = path.join(__dirname, '../../data/categories.db');

// 데이터베이스 디렉토리 확인 및 생성
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// 데이터베이스 연결
const db = new Database(dbPath);

// 카테고리 테이블 생성
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    cat_id TEXT PRIMARY KEY,
    major_category TEXT NOT NULL,
    middle_category TEXT,
    minor_category TEXT,
    detailed_category TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// 임베딩 테이블 생성 (유사도 검색을 위한 임베딩 저장)
db.exec(`
  CREATE TABLE IF NOT EXISTS category_embeddings (
    cat_id TEXT PRIMARY KEY,
    embedding BLOB NOT NULL,
    FOREIGN KEY (cat_id) REFERENCES categories (cat_id)
  )
`);

// 샘플 데이터 삽입 (실제 사용시 적절한 카테고리 데이터로 변경 필요)
const insertCategory = db.prepare(`
  INSERT OR REPLACE INTO categories (cat_id, major_category, middle_category, minor_category, detailed_category)
  VALUES (?, ?, ?, ?, ?)
`);

// 트랜잭션으로 샘플 데이터 삽입
const insertCategories = db.transaction((categories) => {
  for (const category of categories) {
    insertCategory.run(category.cat_id, category.major_category, category.middle_category, category.minor_category, category.detailed_category);
  }
});

// 데이터 삽입 실행
insertCategories(initData);

console.log('카테고리 데이터베이스 초기화 완료');

// 데이터베이스 연결 닫기
db.close(); 