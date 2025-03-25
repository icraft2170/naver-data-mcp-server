import { hardcodedEmbeddings } from '../data/hardcodedEmbeddings.js';

interface CategoryEmbedding {
    cat_id: string;
    embedding: number[];
    full_category_path: string;
}

interface CategorySearchResult {
    cat_id: string;
    full_category_path: string;
    similarity: number;
}

// 코사인 유사도 계산
function cosineSimilarity(vec1: number[], vec2: number[]): number {
    const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitude1 * magnitude2);
}

// 한글 자모 분리 함수
function decomposeHangul(str: string): string[] {
    const result: string[] = [];
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        if (char >= 0xAC00 && char <= 0xD7A3) {
            const syllable = char - 0xAC00;
            const initial = Math.floor(syllable / 28 / 21);
            const medial = Math.floor((syllable % (28 * 21)) / 28);
            const final = syllable % 28;
            
            result.push(String.fromCharCode(0x1100 + initial));
            result.push(String.fromCharCode(0x1161 + medial));
            if (final > 0) {
                result.push(String.fromCharCode(0x11A7 + final));
            }
        } else {
            result.push(str[i]);
        }
    }
    return result;
}

// 복합어 분리 함수
function decomposeCompoundWord(word: string): string[] {
    // 한글 2글자 이상인 경우에만 처리
    if (word.length < 2) return [word];
    
    // 한글 복합어 패턴
    const patterns = [
        { prefix: '스마트', suffix: ['폰', '워치', '키', '밴드', '카드'] },
        { prefix: '블루투스', suffix: ['이어폰', '스피커', '키보드', '마우스'] },
        { prefix: '무선', suffix: ['이어폰', '마우스', '키보드'] },
        { prefix: '디지털', suffix: ['카메라', '시계'] }
    ];
    
    // 패턴 매칭
    for (const pattern of patterns) {
        if (word.startsWith(pattern.prefix)) {
            for (const suffix of pattern.suffix) {
                if (word === pattern.prefix + suffix) {
                    return [pattern.prefix, suffix];
                }
            }
        }
    }
    
    // 4글자 이상인 경우 2글자씩 분리 시도
    if (word.length >= 4) {
        const parts = [];
        for (let i = 0; i < word.length; i += 2) {
            parts.push(word.slice(i, i + 2));
        }
        return parts;
    }
    
    return [word];
}

// 단어 유사도 계산
function wordSimilarity(word1: string, word2: string): number {
    // 정확한 단어 매칭에 더 높은 가중치 부여
    if (word1 === word2) return 1.0;
    
    // 복합어 처리
    const decomposed1 = decomposeCompoundWord(word1);
    const decomposed2 = decomposeCompoundWord(word2);
    
    // 분리된 단어들 간의 유사도 계산
    let maxSimilarity = 0;
    decomposed1.forEach(part1 => {
        decomposed2.forEach(part2 => {
            if (part1 === part2) {
                maxSimilarity = Math.max(maxSimilarity, 0.9);
            } else if (part1.includes(part2) || part2.includes(part1)) {
                maxSimilarity = Math.max(maxSimilarity, 0.7);
            } else {
                // 자모 분리 기반 유사도 계산
                const jamo1 = decomposeHangul(part1);
                const jamo2 = decomposeHangul(part2);
                
                let matchCount = 0;
                const minLength = Math.min(jamo1.length, jamo2.length);
                
                for (let i = 0; i < minLength; i++) {
                    if (jamo1[i] === jamo2[i]) {
                        matchCount++;
                    }
                }
                
                const similarity = matchCount / Math.max(jamo1.length, jamo2.length);
                maxSimilarity = Math.max(maxSimilarity, similarity * 0.5);
            }
        });
    });
    
    return maxSimilarity;
}

// 카테고리 경로 유사도 계산
function calculatePathSimilarity(query: string, categoryPath: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const pathParts = categoryPath.toLowerCase().split(' > ');
    
    let maxSimilarity = 0;
    let exactMatchCount = 0;
    let partialMatchCount = 0;
    
    // 각 쿼리 단어에 대해
    for (const queryWord of queryWords) {
        let wordMaxSimilarity = 0;
        
        // 각 카테고리 경로 부분과 비교
        for (const pathPart of pathParts) {
            const pathWords = pathPart.split(/\s+/);
            
            // 각 경로 단어와 비교
            for (const pathWord of pathWords) {
                // 정확한 일치
                if (pathWord === queryWord) {
                    wordMaxSimilarity = 1;
                    exactMatchCount++;
                    break;
                }
                
                // 포함 관계
                if (pathWord.includes(queryWord) || queryWord.includes(pathWord)) {
                    wordMaxSimilarity = Math.max(wordMaxSimilarity, 0.8);
                    partialMatchCount++;
                    continue;
                }
                
                // 부분 일치
                const commonChars = queryWord.split('').filter(char => pathWord.includes(char));
                const similarity = commonChars.length / Math.max(queryWord.length, pathWord.length);
                if (similarity > 0.5) {
                    wordMaxSimilarity = Math.max(wordMaxSimilarity, similarity);
                    partialMatchCount++;
                }
            }
        }
        
        maxSimilarity += wordMaxSimilarity;
    }
    
    // 정확한 매칭과 부분 매칭에 따른 보너스 점수
    const matchBonus = (exactMatchCount * 0.2 + partialMatchCount * 0.1) / queryWords.length;
    
    // 최종 유사도 계산
    const finalSimilarity = (maxSimilarity / queryWords.length + matchBonus) / 2;
    
    return Math.min(finalSimilarity, 1);
}

// 유사 카테고리 검색
export function searchSimilarCategories(query: string, limit: number = 10): CategorySearchResult[] {
    console.info(`하드코딩된 임베딩 ${hardcodedEmbeddings.length}개를 사용하여 검색합니다.`);
    
    // 쿼리 임베딩 생성 (간단한 방식)
    const queryEmbedding = new Array(100).fill(0);
    const queryWords = query.toLowerCase().split(/\s+/);
    
    queryWords.forEach(word => {
        const wordHash = Array.from(word).reduce((hash, char) => {
            return hash + char.charCodeAt(0);
        }, 0);
        
        for (let i = 0; i < 5; i++) {
            const position = (wordHash * (i + 1)) % queryEmbedding.length;
            queryEmbedding[position] += Math.sin(wordHash * 0.3) * 0.3;
        }
    });
    
    // 임베딩 정규화
    const magnitude = Math.sqrt(queryEmbedding.reduce((sum, val) => sum + val * val, 0));
    queryEmbedding.forEach((val, i) => {
        queryEmbedding[i] = val / (magnitude || 1);
    });
    
    // 유사도 계산 및 결과 정렬
    const results = hardcodedEmbeddings
        .map(category => {
            const embeddingSimilarity = cosineSimilarity(queryEmbedding, category.embedding);
            const pathSimilarity = calculatePathSimilarity(query, category.full_category_path);
            
            // 임베딩 유사도와 경로 유사도를 결합
            const combinedSimilarity = (embeddingSimilarity * 0.4 + pathSimilarity * 0.6) * 100;
            
            return {
                cat_id: category.cat_id,
                full_category_path: category.full_category_path,
                similarity: combinedSimilarity
            };
        })
        .filter(result => {
            // 유사도가 너무 낮은 결과 제외
            if (result.similarity < 30) return false;
            
            // 쿼리 단어와 카테고리 경로의 관련성 확인
            const queryWords = query.toLowerCase().split(/\s+/);
            const pathParts = result.full_category_path.toLowerCase().split(' > ');
            
            // 정확한 일치가 있는 경우 우선 포함
            const hasExactMatch = queryWords.some(word => 
                pathParts.some(part => part.split(/\s+/).some(pathWord => pathWord === word))
            );
            
            if (hasExactMatch) return true;
            
            // 포함 관계가 있는 경우 포함
            const hasInclusion = queryWords.some(word => 
                pathParts.some(part => part.split(/\s+/).some(pathWord => 
                    pathWord.includes(word) || word.includes(pathWord)
                ))
            );
            
            if (hasInclusion) return true;
            
            // 부분 일치가 있는 경우 포함
            const hasPartialMatch = queryWords.some(word => 
                pathParts.some(part => part.split(/\s+/).some(pathWord => {
                    const commonChars = word.split('').filter(char => pathWord.includes(char));
                    return commonChars.length / Math.max(word.length, pathWord.length) > 0.6;
                }))
            );
            
            return hasPartialMatch;
        })
        .sort((a, b) => {
            // 정확한 일치 우선
            const aExactMatch = query.toLowerCase().split(/\s+/).some(word => 
                a.full_category_path.toLowerCase().split(' > ').some(part => 
                    part.split(/\s+/).some(pathWord => pathWord === word)
                )
            );
            const bExactMatch = query.toLowerCase().split(/\s+/).some(word => 
                b.full_category_path.toLowerCase().split(' > ').some(part => 
                    part.split(/\s+/).some(pathWord => pathWord === word)
                )
            );
            
            if (aExactMatch && !bExactMatch) return -1;
            if (!aExactMatch && bExactMatch) return 1;
            
            // 포함 관계 우선
            const aInclusion = query.toLowerCase().split(/\s+/).some(word => 
                a.full_category_path.toLowerCase().split(' > ').some(part => 
                    part.split(/\s+/).some(pathWord => 
                        pathWord.includes(word) || word.includes(pathWord)
                    )
                )
            );
            const bInclusion = query.toLowerCase().split(/\s+/).some(word => 
                b.full_category_path.toLowerCase().split(' > ').some(part => 
                    part.split(/\s+/).some(pathWord => 
                        pathWord.includes(word) || word.includes(pathWord)
                    )
                )
            );
            
            if (aInclusion && !bInclusion) return -1;
            if (!aInclusion && bInclusion) return 1;
            
            // 유사도로 정렬
            return b.similarity - a.similarity;
        })
        .slice(0, limit);
    
    return results;
}

export function searchCategories(query: string): string[] {
    try {
        if (!Array.isArray(hardcodedEmbeddings) || hardcodedEmbeddings.length === 0) {
            console.error('임베딩 데이터가 없습니다.');
            return [];
        }

        // 쿼리 임베딩 생성
        const queryEmbedding = new Array(100).fill(0);
        const queryWords = query.toLowerCase().split(/\s+/);
        
        queryWords.forEach(word => {
            const wordHash = Array.from(word).reduce((hash, char) => {
                return hash + char.charCodeAt(0);
            }, 0);
            
            for (let i = 0; i < 5; i++) {
                const position = (wordHash * (i + 1)) % queryEmbedding.length;
                queryEmbedding[position] += Math.sin(wordHash * 0.3) * 0.3;
            }
        });
        
        // 임베딩 정규화
        const magnitude = Math.sqrt(queryEmbedding.reduce((sum, val) => sum + val * val, 0));
        queryEmbedding.forEach((val, i) => {
            queryEmbedding[i] = val / (magnitude || 1);
        });

        // 코사인 유사도 계산 및 정렬
        const results = hardcodedEmbeddings
            .map((embedding: CategoryEmbedding) => ({
                cat_id: embedding.cat_id,
                similarity: cosineSimilarity(queryEmbedding, embedding.embedding)
            }))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 5)
            .map(result => result.cat_id);

        return results;
    } catch (error) {
        console.error('카테고리 검색 중 오류 발생:', error);
        return [];
    }
}