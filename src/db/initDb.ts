import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import lowdb from 'lowdb';
import FileSync from 'lowdb/adapters/FileSync';

// 카테고리 데이터 인터페이스 정의
interface CategoryData {
  cat_id: number | string;
  major_category: string;
  middle_category: string;
  minor_category: string;
  detailed_category: string;
}

// 데이터베이스 스키마 정의
interface DbSchema {
  categories: CategoryData[];
}

// 간단한 예제 데이터 정의
const sampleData: CategoryData[] = [
  {
    cat_id: 50006033,
    major_category: "도서",
    middle_category: "컴퓨터/IT",
    minor_category: "IT 전문서",
    detailed_category: "개발/OS/데이터베이스"
  },
  {
    cat_id: 50006035,
    major_category: "도서",
    middle_category: "컴퓨터/IT",
    minor_category: "IT 전문서",
    detailed_category: "네트워크/해킹/보안"
  },
  {
    cat_id: 50006036,
    major_category: "도서",
    middle_category: "컴퓨터/IT",
    minor_category: "IT 전문서",
    detailed_category: "모바일 프로그래밍"
  },
  {
    cat_id: 50006034,
    major_category: "도서",
    middle_category: "컴퓨터/IT",
    minor_category: "IT 전문서",
    detailed_category: "웹프로그래밍"
  },
  {
    cat_id: 50006032,
    major_category: "도서",
    middle_category: "컴퓨터/IT",
    minor_category: "IT 활용서",
    detailed_category: "IT 교양서"
  },
  {
    cat_id: 50006031,
    major_category: "도서",
    middle_category: "컴퓨터/IT",
    minor_category: "IT 활용서",
    detailed_category: "오피스 활용"
  },
  {
    cat_id: 50002033,
    major_category: "식품",
    middle_category: "음료",
    minor_category: "탄산수",
    detailed_category: ""
  },
  {
    cat_id: 50006351,
    major_category: "식품",
    middle_category: "전통주",
    minor_category: "약주",
    detailed_category: ""
  },
  {
    cat_id: 50006354,
    major_category: "식품",
    middle_category: "전통주",
    minor_category: "일반증류주",
    detailed_category: ""
  },
  {
    cat_id: 50006952,
    major_category: "식품",
    middle_category: "전통주",
    minor_category: "전통주선물세트",
    detailed_category: ""
  }
];

// ESM에서 __dirname 구현
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 데이터베이스 경로
const dbPath = path.join(__dirname, '../../data/categorieson');

// 데이터베이스 디렉토리 확인 및 생성
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

try {
  console.error(JSON.stringify({
    type: 'info',
    message: '데이터베이스 초기화를 시작합니다...'
  }));
  
  // 데이터베이스 어댑터 생성
  const adapter = new FileSync<DbSchema>(dbPath);
  
  // 데이터베이스 초기화
  const db = lowdb(adapter);
  
  // 기본 데이터 구조 설정
  db.defaults({ categories: [] }).write();
  
  // 카테고리 데이터 삽입
  db.set('categories', sampleData).write();
  
  console.error(JSON.stringify({
    type: 'info',
    message: '카테고리 데이터베이스 초기화 완료'
  }));
} catch (error) {
  console.error(JSON.stringify({
    type: 'error',
    message: '데이터베이스 초기화 중 오류 발생',
    error: error instanceof Error ? error.message : String(error)
  }));
} 