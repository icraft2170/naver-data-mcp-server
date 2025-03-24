import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pipeline } from '@xenova/transformers';
import fs from 'fs';
import lowdb from 'lowdb';
import FileSync from 'lowdb/adapters/FileSync.js';
import { Category } from '../types/naverTypes';

// ESM에서 __dirname 사용을 위한 workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 데이터베이스 경로 설정
const DB_PATH = join(__dirname, '../../data/categorieson');

// 데이터베이스 디렉토리 생성
const dbDir = dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// 임베딩 모델 캐시 디렉토리 설정
const CACHE_DIR = join(__dirname, '../../.cache/transformers');

// 데이터베이스 스키마 정의
interface DbSchema {
  categories: Category[];
  category_embeddings: Array<{
    cat_id: string;
    embedding: number[];
    created_at: string;
  }>;
}

// 임베딩 파이프라인 초기화
let embeddingPipeline: any = null;

// 임베딩 파이프라인 초기화 함수
export async function initEmbeddingPipeline() {
    if (!embeddingPipeline) {
        embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
            cache_dir: CACHE_DIR,
            quantized: true
        });
    }
    return embeddingPipeline;
}

// 데이터베이스 초기화
let db: lowdb.LowdbSync<DbSchema> | null = null;

export function initDatabase(): Promise<lowdb.LowdbSync<DbSchema>> {
    return new Promise((resolve, reject) => {
        try {
            if (!db) {
                console.error(JSON.stringify({
                    type: 'info',
                    message: '데이터베이스 연결을 초기화합니다...'
                }));
                
                // 데이터베이스 어댑터 생성
                const adapter = new FileSync<DbSchema>(DB_PATH);
                
                // 데이터베이스 초기화
                db = lowdb(adapter);
                
                // 기본 데이터 구조 설정
                db.defaults({ 
                    categories: [],
                    category_embeddings: []
                }).write();

                console.error(JSON.stringify({
                    type: 'info',
                    message: '데이터베이스 테이블이 생성되었습니다.'
                }));
            }
            resolve(db);
        } catch (error) {
            console.error(JSON.stringify({
                type: 'error',
                message: '데이터베이스 초기화 중 오류 발생',
                error: error instanceof Error ? error.message : String(error)
            }));
            reject(error);
        }
    });
}

// 임베딩 생성 함수
async function getEmbedding(text: string): Promise<number[]> {
    const pipeline = await initEmbeddingPipeline();
    const output = await pipeline(text, {
        pooling: 'mean',
        normalize: true
    });
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
    await initDatabase();
    if (!db) return;
    
    const categories = db.get('categories').value();
    
    // 배치 처리로 임베딩 생성
    const batchSize = 10;
    for (let i = 0; i < categories.length; i += batchSize) {
        const batch = categories.slice(i, i + batchSize);
        await Promise.all(batch.map(async (category) => {
            const fullPath = `${category.major_category} > ${category.middle_category} > ${category.minor_category} > ${category.detailed_category}`;
            const embedding = await getEmbedding(fullPath);
            
            // 임베딩 저장
            db?.get('category_embeddings')
              .push({
                cat_id: category.cat_id.toString(),
                embedding: embedding,
                created_at: new Date().toISOString()
              })
              .write();
        }));
    }
}

// 유사한 카테고리 검색
export async function searchSimilarCategories(query: string, limit: number = 5): Promise<Category[]> {
    await initDatabase();
    if (!db) return [];
    
    const queryEmbedding = await getEmbedding(query);
    
    // 모든 카테고리와 임베딩 가져오기
    const categories = db.get('categories').value();
    const embeddings = db.get('category_embeddings').value();
    
    // 카테고리 및 임베딩 매핑
    const categoriesWithEmbeddings = categories.map(category => {
        const categoryEmbedding = embeddings.find(e => e.cat_id === category.cat_id.toString());
        return {
            ...category,
            embedding: categoryEmbedding?.embedding || []
        };
    }).filter(category => category.embedding.length > 0);
    
    // 유사도 계산 및 정렬
    const results = categoriesWithEmbeddings.map(category => {
        const similarity = cosineSimilarity(queryEmbedding, category.embedding);
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

// 데이터베이스 연결 종료 (lowdb에서는 필요 없음)
export function closeDatabase(): void {
    db = null;
    console.error(JSON.stringify({
        type: 'info',
        message: '데이터베이스 연결을 종료합니다.'
    }));
}

// 프로세스 종료 시 데이터베이스 연결 종료
process.on('exit', closeDatabase); 