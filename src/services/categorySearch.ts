import betterSqlite3, { Database } from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pipeline } from '@xenova/transformers';
import fs from 'fs';

// ESM에서 __dirname 사용을 위한 workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 데이터베이스 경로 설정
const DB_PATH = join(__dirname, '../../data/categories.db');

// 데이터베이스 디렉토리 생성
const dbDir = dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// 임베딩 모델 캐시 디렉토리 설정
const CACHE_DIR = join(__dirname, '../../.cache/transformers');

// 임베딩 파이프라인 초기화
let embeddingPipeline: any = null;

export interface Category {
    cat_id: string;
    major_category: string;
    middle_category: string;
    minor_category: string;
    detailed_category: string;
    full_category_path: string;
    similarity?: number;
}

// 임베딩 파이프라인 초기화 함수
export async function initEmbeddingPipeline() {
    if (!embeddingPipeline) {
        embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
            cache_dir: CACHE_DIR
        });
    }
    return embeddingPipeline;
}

// 데이터베이스 초기화
let db: Database | null = null;

export function initDatabase(): Database {
    if (!db) {
        db = new betterSqlite3(DB_PATH);
        
        // categories 테이블 생성
        db.exec(`
            CREATE TABLE IF NOT EXISTS categories (
                cat_id TEXT PRIMARY KEY,
                major_category TEXT NOT NULL,
                middle_category TEXT,
                minor_category TEXT,
                detailed_category TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // category_embeddings 테이블 생성
        db.exec(`
            CREATE TABLE IF NOT EXISTS category_embeddings (
                cat_id TEXT PRIMARY KEY,
                embedding BLOB NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (cat_id) REFERENCES categories(cat_id)
            )
        `);
    }
    return db;
}

// 텍스트를 임베딩 벡터로 변환
async function getEmbedding(text: string): Promise<number[]> {
    const pipeline = await initEmbeddingPipeline();
    const output = await pipeline(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

// 코사인 유사도 계산
function cosineSimilarity(vec1: number[], vec2: number[]): number {
    const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    const norm1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const norm2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (norm1 * norm2);
}

// 모든 카테고리에 대한 임베딩 생성 및 저장
export async function generateAllCategoryEmbeddings() {
    const db = initDatabase();
    const categories = db.prepare('SELECT * FROM categories').all() as Category[];
    
    for (const category of categories) {
        const fullPath = `${category.major_category} > ${category.middle_category} > ${category.minor_category} > ${category.detailed_category}`;
        const embedding = await getEmbedding(fullPath);
        
        // 임베딩을 BLOB으로 저장
        const blob = Buffer.from(new Float32Array(embedding).buffer);
        db.prepare(`
            INSERT OR REPLACE INTO category_embeddings (cat_id, embedding)
            VALUES (?, ?)
        `).run(category.cat_id, blob);
    }
}

// 유사한 카테고리 검색
export async function searchSimilarCategories(query: string, limit: number = 5): Promise<Category[]> {
    const db = initDatabase();
    const queryEmbedding = await getEmbedding(query);
    
    // 모든 카테고리와 임베딩 가져오기
    const categories = db.prepare(`
        SELECT c.*, ce.embedding
        FROM categories c
        JOIN category_embeddings ce ON c.cat_id = ce.cat_id
    `).all() as (Category & { embedding: Buffer })[];
    
    // 유사도 계산 및 정렬
    const results = categories.map(category => {
        const categoryEmbedding = new Float32Array(category.embedding.buffer);
        const similarity = cosineSimilarity(queryEmbedding, Array.from(categoryEmbedding));
        const fullPath = `${category.major_category} > ${category.middle_category} > ${category.minor_category} > ${category.detailed_category}`;
        
        return {
            ...category,
            full_category_path: fullPath,
            similarity
        };
    }).sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
    .slice(0, limit);
    
    return results;
}

// 데이터베이스 연결 종료
export function closeDatabase(): void {
    if (db) {
        db.close();
        db = null;
    }
}

// 프로세스 종료 시 데이터베이스 연결 종료
process.on('exit', closeDatabase); 