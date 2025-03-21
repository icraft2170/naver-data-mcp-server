# 네이버 데이터랩 MCP 서버

이 프로젝트는 네이버 데이터랩 API를 [Model Context Protocol(MCP)](https://github.com/anthropics/model-context-protocol-spec) 인터페이스로 제공하는 서버입니다.

## 기능

### 검색어 트렌드
- 네이버 데이터랩 통합 검색어 트렌드 API 제공
- 검색어 그룹별 트렌드 조회 (최대 5개 그룹, 그룹당 최대 5개 검색어)
- 기간, 성별, 연령대, 디바이스 기준 필터링 지원

### 쇼핑인사이트
- 쇼핑 분야별 트렌드 조회 기능 (최대 3개 분야)
- 특정 쇼핑 분야 내 키워드별 트렌드 조회 기능 (최대 3개 키워드)
- 기간, 성별, 연령대, 디바이스 기준 필터링 지원

## 설치

### npm을 통한 설치
```bash
npm install -g naver-datalab-mcp-server
```

### 소스코드로 설치
```bash
# 저장소 클론
git clone https://github.com/sonhyeonho/naver-data-lab-mcp-server.git
cd naver-data-lab-mcp-server

# 의존성 설치 및 빌드
npm install
npm run build
```

## 개발 환경 설정

### 환경 변수 설정
`.env` 파일을 생성하고 다음 내용을 추가합니다:

```bash
# .env.example 파일을 복사하여 .env 파일 생성
cp .env.example .env

# .env 파일을 열고 다음 내용을 수정
NAVER_CLIENT_ID=your_naver_client_id_here
NAVER_CLIENT_SECRET=your_naver_client_secret_here
```

### 개발 서버 실행
```bash
# 개발 모드로 실행
npm run dev

# 빌드
npm run build

# 실행
npm start
```

## API 사용 방법

### 검색어 트렌드 조회
```typescript
{
  startDate: "2024-01-01",    // YYYY-MM-DD 형식
  endDate: "2024-01-31",      // YYYY-MM-DD 형식
  timeUnit: "date",           // "date" | "week" | "month"
  keywordGroups: [            // 최대 5개 그룹
    {
      groupName: "그룹1",
      keywords: ["검색어1", "검색어2"]  // 그룹당 최대 5개
    }
  ],
  device: "pc",              // 선택사항: "pc" | "mo" | ""
  gender: "f",               // 선택사항: "f" | "m" | ""
  ages: ["20", "30"]         // 선택사항: ["1"~"11"]
}
```

### 쇼핑인사이트 분야별 트렌드 조회
```typescript
{
  startDate: "2024-01-01",
  endDate: "2024-01-31",
  timeUnit: "date",
  category: [                 // 최대 3개 분야
    {
      name: "패션의류",
      param: ["50000000"]     // 네이버 쇼핑 카테고리 코드
    }
  ],
  device: "pc",              // 선택사항
  gender: "f",               // 선택사항
  ages: ["20", "30"]         // 선택사항
}
```

### 쇼핑인사이트 키워드별 트렌드 조회
```typescript
{
  startDate: "2024-01-01",
  endDate: "2024-01-31",
  timeUnit: "date",
  category: "50000000",      // 쇼핑 분야 코드
  keyword: [                 // 최대 3개 키워드
    {
      name: "키워드1",
      param: ["검색어1", "검색어2"]  // 최대 5개
    }
  ],
  device: "pc",              // 선택사항
  gender: "f",               // 선택사항
  ages: ["20", "30"]         // 선택사항
}
```

## 연령대 코드
- "1": 0-12세
- "2": 13-18세
- "3": 19-24세
- "4": 25-29세
- "5": 30-34세
- "6": 35-39세
- "7": 40-44세
- "8": 45-49세
- "9": 50-54세
- "10": 55-59세
- "11": 60세 이상

## API 참고 자료
- [네이버 데이터랩 검색어 트렌드 API 문서](https://developers.naver.com/docs/serviceapi/datalab/search/search.md)
- [네이버 데이터랩 쇼핑인사이트 API 문서](https://developers.naver.com/docs/serviceapi/datalab/shopping/shopping.md)

## MCP 서버 설정

### MCP 서버 실행
```bash
npx -y naver-datalab-mcp-server
```

### MCP 설정 예시
```json
{
  "naver-datalab": {
    "command": "npx",
    "args": [
      "-y",
      "naver-datalab-mcp-server"
    ],
    "env": {
      "NAVER_CLIENT_ID": "your_naver_client_id_here",
      "NAVER_CLIENT_SECRET": "your_naver_client_secret_here"
    }
  }
}
```

## 시스템 요구사항
- Node.js >= 18.0.0

## 라이선스
MIT 