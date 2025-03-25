import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import Hangul from 'hangul-js';

interface CategoryData {
    cat_id: string | number;
    major_category: string;
    middle_category: string;
    minor_category: string;
    detailed_category: string;
}

interface Category {
    cat_id: string;
    full_category_path: string;
}

interface CategoryWithEmbedding {
    cat_id: string;
    full_category_path: string;
    embedding: number[];
}

// 카테고리 데이터 로드 및 변환
function loadCategories(): Category[] {
    try {
        const fileContent = readFileSync('data/categories.json', 'utf-8');
        const data = JSON.parse(fileContent);
        
        if (!data.categories || !Array.isArray(data.categories)) {
            console.error('유효한 카테고리 데이터가 없습니다.');
            return [];
        }
        
        return data.categories
            .map((category: CategoryData) => ({
                cat_id: category.cat_id.toString(),
                full_category_path: [
                    category.major_category,
                    category.middle_category,
                    category.minor_category,
                    category.detailed_category
                ].filter(Boolean).join(' > ')
            }))
            .filter((category: Category) => category.full_category_path.length > 0);
    } catch (error) {
        console.error('카테고리 데이터 로드 중 오류 발생:', error);
        return [];
    }
}

// 카테고리 경로 유사도 계산
function calculatePathSimilarity(path1: string, path2: string): number {
    const parts1 = path1.split(' > ');
    const parts2 = path2.split(' > ');
    
    let similarity = 0;
    const maxLength = Math.max(parts1.length, parts2.length);
    
    for (let i = 0; i < maxLength; i++) {
        if (parts1[i] === parts2[i]) {
            similarity += 1 / maxLength;
        }
    }
    
    return similarity;
}

// 유사 카테고리 찾기
function findSimilarCategories(category: Category, allCategories: Category[]): Category[] {
    const categoryParts = category.full_category_path.split(' > ');
    const mainCategory = categoryParts[0];
    
    return allCategories
        .filter((cat: Category) => {
            const similarity = calculatePathSimilarity(category.full_category_path, cat.full_category_path);
            return similarity > 0.5 && cat.cat_id !== category.cat_id;
        })
        .slice(0, 5); // 상위 5개의 유사 카테고리만 사용
}

// 한글 자모 분리 및 복합어 처리
function processKoreanWord(word: string): string[] {
    // 자모 분리
    const decomposed = Hangul.disassemble(word);
    
    // 자모를 다시 조합하여 가능한 모든 조합 생성
    const combinations: string[] = [];
    let current = '';
    
    for (let i = 0; i < decomposed.length; i++) {
        current += decomposed[i];
        if (i > 0) {
            const assembled = Hangul.assemble(decomposed.slice(0, i + 1));
            combinations.push(assembled);
        }
    }
    
    // 원본 단어 추가
    combinations.push(word);
    
    // 복합어 처리
    if (word.length >= 4) {
        // 2글자씩 분리
        for (let i = 0; i < word.length - 1; i += 2) {
            const part = word.slice(i, i + 2);
            combinations.push(part);
        }
        
        // 특수 패턴 처리
        const patterns = {
            '스마트': ['폰', '워치', '밴드', '태그'],
            '디지털': ['가전', '기기', '카메라'],
            '블루투스': ['이어폰', '스피커', '키보드'],
            '무선': ['이어폰', '마우스', '키보드']
        };
        
        for (const [prefix, suffixes] of Object.entries(patterns)) {
            if (word.startsWith(prefix)) {
                combinations.push(prefix);
                for (const suffix of suffixes) {
                    if (word.endsWith(suffix)) {
                        combinations.push(suffix);
                    }
                }
            }
        }
    }
    
    // 중복 제거
    return [...new Set(combinations)];
}

// 카테고리 임베딩 생성
function generateCategoryEmbedding(category: Category, allCategories: Category[]): number[] {
    const embedding: number[] = new Array(100).fill(0);
    const categoryPath = category.full_category_path;
    const pathParts = categoryPath.split(' > ');
    
    // 각 계층별 가중치 적용 (상위 카테고리일수록 더 높은 가중치)
    const levelWeights = [1.0, 0.8, 0.6, 0.4];
    
    // 카테고리 경로의 각 부분 처리
    pathParts.forEach((part, index) => {
        const levelWeight = levelWeights[index] || 0.3;
        const words = part.split(/\s+/);
        
        // 단어 단위로 처리
        words.forEach(word => {
            // 한글 처리
            const processedWords = processKoreanWord(word);
            
            // 각 처리된 단어의 특성을 임베딩에 반영
            processedWords.forEach(processedWord => {
                const wordHash = Array.from(processedWord).reduce((hash, char) => {
                    return hash + char.charCodeAt(0);
                }, 0);
                
                // 단어 길이에 따른 가중치 조정
                const wordWeight = levelWeight * (1 + processedWord.length * 0.1);
                
                // 임베딩에 반영
                for (let i = 0; i < 5; i++) {
                    const position = (wordHash * (i + 1)) % embedding.length;
                    embedding[position] += Math.sin(wordHash * wordWeight) * wordWeight;
                }
            });
        });
        
        // 카테고리 계층 구조 정보 반영
        if (index > 0) {
            const parentPart = pathParts[index - 1];
            const parentHash = Array.from(parentPart).reduce((hash, char) => {
                return hash + char.charCodeAt(0);
            }, 0);
            
            for (let i = 0; i < 3; i++) {
                const position = (parentHash * (i + 1)) % embedding.length;
                embedding[position] += Math.cos(parentHash * levelWeight) * levelWeight * 0.5;
            }
        }
        
        // 전체 카테고리 경로의 특성 반영
        const fullPathHash = Array.from(categoryPath).reduce((hash, char) => {
            return hash + char.charCodeAt(0);
        }, 0);
        
        for (let i = 0; i < 3; i++) {
            const position = (fullPathHash * (i + 1)) % embedding.length;
            embedding[position] += Math.sin(fullPathHash * 0.3) * 0.3;
        }
    });
    
    // 유사 카테고리 관계 반영 (상위 3개만)
    const similarCategories = findSimilarCategories(category, allCategories).slice(0, 3);
    similarCategories.forEach((similarCat, index) => {
        const similarity = calculatePathSimilarity(category.full_category_path, similarCat.full_category_path);
        const weight = similarity * 0.3 / (index + 1);
        
        const similarHash = Array.from(similarCat.full_category_path).reduce((hash, char) => {
            return hash + char.charCodeAt(0);
        }, 0);
        
        for (let i = 0; i < 3; i++) {
            const position = (similarHash * (i + 1)) % embedding.length;
            embedding[position] += Math.sin(similarHash * weight) * weight;
        }
    });
    
    // 임베딩 정규화
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / (magnitude || 1));
}

// 임베딩 생성 및 저장
function generateEmbeddings(): void {
    try {
        const categories = loadCategories();
        console.log(`총 ${categories.length}개의 카테고리에 대해 임베딩을 생성합니다...`);
        
        const embeddingsWithCategory: CategoryWithEmbedding[] = categories.map((category: Category) => ({
            cat_id: category.cat_id,
            full_category_path: category.full_category_path,
            embedding: generateCategoryEmbedding(category, categories)
        }));

        // 임베딩 데이터를 TypeScript 파일로 저장
        const embeddingFileContent = `// 자동 생성된 임베딩 데이터
export const hardcodedEmbeddings = ${JSON.stringify(embeddingsWithCategory, null, 2)};`;
        
        writeFileSync('src/data/hardcodedEmbeddings.ts', embeddingFileContent);
        console.log(`임베딩 데이터가 성공적으로 생성되었습니다. (${embeddingsWithCategory.length}개)`);
    } catch (error) {
        console.error('임베딩 생성 중 오류 발생:', error);
    }
}

// 임베딩 생성 실행
generateEmbeddings(); 