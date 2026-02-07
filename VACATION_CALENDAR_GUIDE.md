# 휴가 현황 캘린더 가이드

## 개요

**휴가 현황 캘린더**는 ITMOOU 직원들의 휴가 일정을 달력 형태로 시각화하여 한눈에 확인할 수 있는 웹 애플리케이션입니다.

---

## 주요 기능

### 1️⃣ 월별 휴가 현황 달력

- **달력 형태**로 한 달 전체의 휴가 현황을 표시
- **휴가자가 있는 날짜**에 배지로 인원수 표시
- **이전/다음 달** 네비게이션으로 쉽게 이동

### 2️⃣ 날짜별 휴가자 상세 정보

- 특정 날짜를 **클릭**하면 해당 날짜의 휴가자 목록 표시
- **직원 이름, 사원번호, 휴가 종류, 휴가 기간** 확인 가능
- 여러 명의 휴가자가 있을 경우 목록으로 표시

### 3️⃣ 실시간 데이터 연동

- **Flex API**와 연동하여 최신 휴가 데이터 조회
- Azure Functions를 통한 **안전한 API 호출**
- 월 변경 시 자동으로 데이터 갱신

---

## 아키텍처

```
┌─────────────────┐
│  Static Web App │  ← 사용자 접속
│  (public/)      │
└────────┬────────┘
         │
         │ HTTP GET /api/vacation/calendar
         │
┌────────▼────────────────────┐
│  Azure Functions            │
│  vacationCalendar           │
│  (HTTP Trigger)             │
└────────┬────────────────────┘
         │
         │ Flex OpenAPI
         │
┌────────▼────────┐
│   Flex API      │
│  (휴가 데이터)   │
└─────────────────┘
```

---

## 파일 구조

```
webapp/
├── public/                          # Static Web App 파일
│   ├── index.html                   # 메인 HTML
│   ├── styles.css                   # 스타일시트
│   ├── app.js                       # JavaScript 로직
│   └── staticwebapp.config.json     # Azure Static Web Apps 설정
│
└── apps/api/http/vacationCalendar/  # Backend API
    ├── function.json                # Azure Functions 바인딩
    └── index.ts                     # API 로직
```

---

## API 명세

### GET /api/vacation/calendar

특정 월의 휴가 데이터를 조회합니다.

#### Query Parameters

| 파라미터 | 필수 | 설명 | 예시 |
|---------|------|------|------|
| `year` | ❌ | 조회할 연도 | `2024` |
| `month` | ❌ | 조회할 월 (1-12) | `2` |
| `startDate` | ❌ | 시작 날짜 (YYYY-MM-DD) | `2024-02-01` |
| `endDate` | ❌ | 종료 날짜 (YYYY-MM-DD) | `2024-02-29` |

- `year`와 `month`를 지정하면 해당 월 전체 조회
- `startDate`와 `endDate`를 지정하면 특정 기간 조회
- 파라미터 없으면 **현재 월** 조회

#### 예시 요청

```bash
# 2024년 2월 전체 조회
GET /api/vacation/calendar?year=2024&month=2

# 현재 월 조회
GET /api/vacation/calendar

# 특정 기간 조회
GET /api/vacation/calendar?startDate=2024-02-01&endDate=2024-02-15
```

#### 성공 응답 (200)

```json
{
  "success": true,
  "data": {
    "startDate": "2024-02-01",
    "endDate": "2024-02-29",
    "totalVacationDays": 5,
    "vacationDays": [
      {
        "date": "2024-02-14",
        "count": 2,
        "vacationers": [
          {
            "employeeNumber": "240101",
            "employeeName": "심영민",
            "employeeEmail": "ymsim@itmoou.com",
            "vacationType": "연차",
            "startDate": "2024-02-14",
            "endDate": "2024-02-15"
          },
          {
            "employeeNumber": "240102",
            "employeeName": "홍길동",
            "employeeEmail": "hong@itmoou.com",
            "vacationType": "반차",
            "startDate": "2024-02-14",
            "endDate": "2024-02-14"
          }
        ]
      },
      {
        "date": "2024-02-15",
        "count": 1,
        "vacationers": [
          {
            "employeeNumber": "240101",
            "employeeName": "심영민",
            "employeeEmail": "ymsim@itmoou.com",
            "vacationType": "연차",
            "startDate": "2024-02-14",
            "endDate": "2024-02-15"
          }
        ]
      }
    ]
  }
}
```

---

## 배포 방법

### 옵션 1: Azure Static Web Apps (권장)

#### 1. Azure Static Web App 생성

```bash
# Azure CLI로 생성
az staticwebapp create \
  --name itmoou-vacation-calendar \
  --resource-group itmoou-resources \
  --source https://github.com/itmoou/itmoou-attendance-notifier \
  --location "East Asia" \
  --branch main \
  --app-location "public" \
  --api-location "" \
  --output-location ""
```

#### 2. GitHub Actions 자동 배포

`.github/workflows/` 폴더에 워크플로우 추가:

```yaml
name: Azure Static Web Apps CI/CD

on:
  push:
    branches:
      - main
    paths:
      - 'public/**'

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "public"
          output_location: ""
```

#### 3. Function Key 설정

**중요:** `public/app.js`에서 Function Key를 설정해야 합니다.

**방법 A: 환경변수 사용 (권장)**

Azure Static Web Apps의 Configuration에서 설정:

```bash
az staticwebapp appsettings set \
  --name itmoou-vacation-calendar \
  --setting-names FUNCTION_KEY="{your-function-key}"
```

**방법 B: 코드에 직접 입력 (개발용)**

`public/app.js`:
```javascript
const FUNCTION_KEY = 'your-function-key-here';
```

---

### 옵션 2: Azure Blob Storage 정적 웹사이트

#### 1. Storage Account에서 정적 웹사이트 활성화

```bash
az storage blob service-properties update \
  --account-name itmooustorage \
  --static-website \
  --index-document index.html
```

#### 2. 파일 업로드

```bash
az storage blob upload-batch \
  --account-name itmooustorage \
  --source ./public \
  --destination '$web'
```

#### 3. URL 확인

```
https://itmooustorage.z23.web.core.windows.net
```

---

## 로컬 개발 및 테스트

### 1. Backend API 로컬 실행

```bash
cd /home/user/webapp
npm install
npm run build
func start
```

Backend API가 `http://localhost:7071`에서 실행됩니다.

### 2. Frontend 로컬 서버

```bash
cd public
python3 -m http.server 8000
```

또는 Live Server 확장을 사용하여 `public/index.html`을 열면 됩니다.

### 3. 브라우저에서 확인

```
http://localhost:8000
```

---

## 보안 및 인증

### 현재 구현

- **Function Key 인증**: API 호출 시 `code` 쿼리 파라미터로 Function Key 전달
- **CORS 설정**: Azure Functions에서 허용된 도메인만 접근 가능

### 권장 사항 (프로덕션)

#### Azure AD 인증 추가

1. **Azure Static Web Apps에서 인증 활성화**

`staticwebapp.config.json`:
```json
{
  "routes": [
    {
      "route": "/*",
      "allowedRoles": ["authenticated"]
    }
  ],
  "responseOverrides": {
    "401": {
      "redirect": "/.auth/login/aad",
      "statusCode": 302
    }
  }
}
```

2. **Azure AD 앱 등록**

- Azure Portal → Azure Active Directory → App registrations
- 새 앱 등록: `itmoou-vacation-calendar`
- Redirect URI: `https://your-static-webapp.azurestaticapps.net/.auth/login/aad/callback`

3. **Static Web App에 Azure AD 연결**

```bash
az staticwebapp identity assign \
  --name itmoou-vacation-calendar \
  --resource-group itmoou-resources
```

---

## 문제 해결

### API 호출 실패 (401 Unauthorized)

**증상:** 달력이 로드되지 않고 "휴가 데이터를 불러올 수 없습니다" 에러

**원인:** Function Key가 설정되지 않았거나 잘못됨

**해결:**
1. Azure Portal → Function App → Functions → vacationCalendar → Function Keys
2. `default` 키 복사
3. `public/app.js`의 `FUNCTION_KEY` 변수에 입력

### CORS 에러

**증상:** 브라우저 콘솔에 "CORS policy blocked" 에러

**원인:** Azure Functions에서 프론트엔드 도메인을 허용하지 않음

**해결:**
```bash
az functionapp cors add \
  --name itmoou-attendance-func \
  --resource-group itmoou-resources \
  --allowed-origins "https://your-static-webapp.azurestaticapps.net"
```

### 휴가 데이터가 표시되지 않음

**증상:** 달력은 로드되지만 휴가자 정보가 없음

**원인:** Flex API 데이터 없음 또는 EmployeeMap 미설정

**해결:**
1. Azure Portal → Function App → Log stream에서 에러 확인
2. Flex API 토큰 유효성 확인
3. EmployeeMap 테이블 데이터 확인

---

## 추가 기능 제안

### 1. 필터링 기능
- 부서별 필터
- 휴가 종류별 필터 (연차, 반차, 병가)

### 2. 통계 대시보드
- 월별 휴가 사용 통계
- 부서별 휴가 현황
- 직원별 잔여 연차

### 3. 모바일 최적화
- 반응형 디자인 개선
- 모바일 전용 UI

### 4. 내보내기 기능
- PDF 내보내기
- Excel 내보내기

---

## 관련 문서

- [README.md](./README.md) - 프로젝트 전체 개요
- [PHASE2_GUIDE.md](./PHASE2_GUIDE.md) - Phase 2 휴가 관리 자동화
- [FLEX_INTEGRATION_GUIDE.md](./FLEX_INTEGRATION_GUIDE.md) - Flex API 연동 가이드
- [DEPLOYMENT.md](./DEPLOYMENT.md) - 배포 가이드

---

## 지원

- **기술 문의:** Azure Portal Log stream 확인
- **Flex API 문의:** Flex 고객 지원팀
- **버그 리포트:** GitHub Issues

**작성일:** 2024-02-07
