# Flex 근태 누락 알림 시스템 + 휴가 관리 자동화

Flex OpenAPI + Microsoft Teams DM + Outlook을 기반으로 한 자동화된 근태 누락 알림 및 휴가 관리 시스템입니다.

## 📋 목차

- [개요](#개요)
- [주요 기능](#주요-기능)
- [시스템 아키텍처](#시스템-아키텍처)
- [기술 스택](#기술-스택)
- [프로젝트 구조](#프로젝트-구조)
- [설치 및 설정](#설치-및-설정)
- [환경 변수 설정](#환경-변수-설정)
- [로컬 개발](#로컬-개발)
- [배포](#배포)
- [알림 정책](#알림-정책)
- [API 명세](#api-명세)
- [트러블슈팅](#트러블슈팅)

---

## 개요

이 시스템은 직원들의 출퇴근 체크 누락을 자동으로 감지하고, Microsoft Teams DM과 Outlook 이메일을 통해 알림을 전송합니다. 또한 휴가 신청 승인 시 자동으로 Outlook 캘린더에 일정을 등록하고, 휴가 현황을 Teams로 공지하며, 휴가 시작/종료 리마인더를 발송합니다.

### 핵심 특징

- ⏰ **자동화된 스케줄링**: Azure Functions Timer Trigger 기반
- 🤖 **Teams Bot 알림**: Bot Framework를 통한 Proactive Message 전송
- 📧 **일일 리포트**: Outlook을 통한 전일 누적 리포트 발송
- 🔐 **토큰 자동 관리**: Flex API Access Token 자동 갱신
- 🏖️ **휴가자 제외**: 휴가 중인 직원은 알림 대상에서 자동 제외
- ⚠️ **만료 경고**: Refresh Token 만료 2일 전 자동 경고
- 💾 **Conversation 저장**: Azure Table Storage를 통한 사용자별 대화 관리
- 📅 **휴가 관리**: 휴가 승인 시 Outlook 캘린더 자동 연동
- 🔔 **휴가 알림**: 휴가 시작/종료 리마인더 자동 발송
- 📊 **휴가 현황**: 매일 아침 오늘 휴가자 Teams 공지

---

## 주요 기능

### 1. 출근 누락 알림

| 시간 | 동작 | 대상 |
|------|------|------|
| **11:05** | 1차 알림 (Teams Bot DM) | 출근 미체크자 |
| **11:30** | 2차 최종 알림 (Teams Bot DM) | 여전히 미체크자 |

### 2. 퇴근 누락 알림

| 시간 | 동작 | 대상 |
|------|------|------|
| **20:30** | 1차 알림 (Teams Bot DM) | 퇴근 미체크자 |
| **22:00** | 2차 최종 알림 (Teams Bot DM) | 여전히 미체크자 |

### 3. 당일 누적 요약

| 시간 | 동작 | 대상 |
|------|------|------|
| **22:10** | 당일 누락 요약 (Teams Bot DM) | 오늘 누락 발생자 |

### 4. Outlook 리포트

| 시간 | 동작 | 수신자 |
|------|------|--------|
| **09:00** | 전일 누락 리포트 (이메일) | hr@itmoou.com |

### 5. 휴가 관리 (Phase 2 신규 기능) 🆕

#### 5.1 휴가 승인 알림
- **Webhook**: POST `/api/vacation/approved`
- Flex에서 휴가 승인 시 호출
- Teams Bot으로 승인 알림 발송
- Outlook 개인 캘린더에 휴가 일정 자동 등록
- 팀 공유 캘린더에 휴가 표시

#### 5.2 매일 아침 휴가 현황 공지
- **시간**: 평일 09:00
- **대상**: HR 이메일 (hr@itmoou.com)
- **내용**: 
  - 오늘 휴가자 목록
  - 이번 주 휴가 예정 현황

#### 5.3 휴가 리마인더
- **시간**: 평일 18:00
- **내용**:
  - 내일 휴가 시작하는 직원 → 본인과 HR에게 알림
  - 오늘 휴가 종료 (내일 복귀) 직원 → 본인에게 복귀 리마인더

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                  Azure Functions                        │
│          (Timer Trigger + HTTP Trigger)                 │
└─────────────────────────────────────────────────────────┘
                          │
                          ├─────────────────────────┐
                          │                         │
                ┌─────────▼─────────┐     ┌────────▼────────┐
                │   Flex OpenAPI    │     │  Teams Bot +    │
                │   (근태 데이터)     │     │ Microsoft Graph │
                └───────────────────┘     └─────────────────┘
                          │                         │
                          ├─────────┬───────────────┤
                          │         │               │
                    ┌─────▼────┐ ┌──▼──────────┐ ┌──▼─────────┐
                    │ 직원 정보 │ │  Teams Bot  │ │  Outlook   │
                    │ 근태 기록 │ │  Proactive  │ │ (일일리포트)│
                    │ 휴가 정보 │ │  Message    │ └────────────┘
                    └──────────┘ └─────────────┘
                                        │
                                ┌───────▼────────┐
                                │ Table Storage  │
                                │ Conversation   │
                                │   Reference    │
                                └────────────────┘
```

---

## 기술 스택

- **런타임**: Node.js 18+
- **언어**: TypeScript 5.3+
- **플랫폼**: Azure Functions (Timer Trigger)
- **외부 API**:
  - Flex OpenAPI (근태 데이터)
  - Teams Bot Framework (Proactive Message)
  - Microsoft Graph API (Outlook만 사용)
- **저장소**: Azure Table Storage (Conversation Reference)
- **인증**: 
  - Flex: Refresh Token 기반 (7일 유효, Access Token 자동 재발급)
  - Teams Bot: Bot Framework Credentials
  - Microsoft Graph: Azure AD Client Credentials Flow (Outlook만)

---

## 프로젝트 구조

```
flex-attendance-alert/
├── apps/
│   └── api/
│       ├── host.json                    # Azure Functions 설정
│       ├── shared/                      # 공통 모듈
│       │   ├── tokenManager.ts          # Flex API 토큰 관리
│       │   ├── flexClient.ts            # Flex API 클라이언트
│       │   ├── teamsClient.ts           # Teams DM 클라이언트
│       │   ├── outlookClient.ts         # Outlook 이메일 클라이언트
│       │   ├── calendarClient.ts        # Outlook Calendar API 클라이언트 🆕
│       │   ├── graphClient.ts           # Microsoft Graph 인증
│       │   └── rules.ts                 # 알림 정책 및 비즈니스 로직
│       ├── timers/                      # Timer Functions
│       │   ├── checkCheckIn/            # 출근 체크 (11:05, 11:30)
│       │   │   ├── index.ts
│       │   │   └── function.json
│       │   ├── checkCheckOut/           # 퇴근 체크 (20:30, 22:00)
│       │   │   ├── index.ts
│       │   │   └── function.json
│       │   ├── dailySummary/            # 당일 요약 (22:10)
│       │   │   ├── index.ts
│       │   │   └── function.json
│       │   ├── outlookReport/           # Outlook 리포트 (09:00)
│       │   │   ├── index.ts
│       │   │   └── function.json
│       │   ├── vacationAnnouncement/    # 휴가 현황 공지 (09:00) 🆕
│       │   │   ├── index.ts
│       │   │   └── function.json
│       │   └── vacationReminder/        # 휴가 리마인더 (18:00) 🆕
│       │       ├── index.ts
│       │       └── function.json
│       └── http/                        # HTTP Triggers
│           └── vacationApproved/        # 휴가 승인 Webhook 🆕
│               ├── index.ts
│               └── function.json
├── package.json
├── tsconfig.json
├── .env.example                         # 환경 변수 예제
├── .gitignore
└── README.md
```

---

## 설치 및 설정

### 1. 사전 요구사항

- Node.js 18 이상
- Azure Functions Core Tools 4.x
- Azure 구독 (배포용)
- Flex OpenAPI 계정 및 토큰
- Microsoft 365 계정 (Graph API 권한 필요)

### 2. 프로젝트 설치

```bash
# 저장소 클론
git clone <repository-url>
cd flex-attendance-alert

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일을 열어서 실제 값으로 수정
```

### 3. TypeScript 빌드

```bash
npm run build
```

---

## 환경 변수 설정

`.env` 파일을 생성하고 다음 값들을 설정하세요:

### Flex OpenAPI 설정

⚠️ **중요**: Flex OpenAPI는 Client ID/Secret을 사용하지 않습니다!

```bash
# Flex API Base URL
FLEX_API_BASE=https://api.flex.team

# Flex Token URL (Access Token 재발급 엔드포인트)
FLEX_TOKEN_URL=https://api.flex.team/oauth/token

# Flex API Refresh Token (최대 7일 유효)
# ⚠️ 주의: 절대 Git에 커밋하지 마세요!
FLEX_REFRESH_TOKEN=your_flex_refresh_token_here
```

**토큰 관리 방식:**
- Refresh Token만 환경변수에 저장
- Access Token은 자동으로 재발급 (10분 유효)
- Access Token은 메모리에 캐시 (파일 저장 안 함)

### Microsoft Graph API 설정

```bash
# Azure AD Configuration
AZURE_TENANT_ID=your_azure_tenant_id
AZURE_CLIENT_ID=your_azure_client_id
AZURE_CLIENT_SECRET=your_azure_client_secret

# Graph API Base URL (기본값 사용 권장)
GRAPH_API_BASE_URL=https://graph.microsoft.com/v1.0
```

### 이메일 설정

```bash
# HR Email (발신자)
HR_EMAIL=hr@itmoou.com

# CEO Email (Refresh Token 만료 경고 수신자)
CEO_EMAIL=ceo@itmoou.com
```

### 알림 시간 설정 (선택 사항)

```bash
# 출근 체크 시간
CHECK_IN_TIME_1=11:05
CHECK_IN_TIME_2=11:30

# 퇴근 체크 시간
CHECK_OUT_TIME_1=20:30
CHECK_OUT_TIME_2=22:00

# 당일 누적 요약 시간
DAILY_SUMMARY_TIME=22:10

# Outlook 리포트 시간
OUTLOOK_REPORT_TIME=09:00

# Refresh Token 만료 경고 임계값 (일)
REFRESH_TOKEN_WARNING_DAYS=2
```

### 기타 설정

```bash
# Timezone
TZ=Asia/Seoul

# Log Level
LOG_LEVEL=info
```

---

## 로컬 개발

### 로컬에서 실행

```bash
# TypeScript 컴파일 (watch 모드)
npm run watch

# 다른 터미널에서 Azure Functions 실행
npm start
```

### 로컬 설정 파일

`local.settings.json` 파일 생성:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "FLEX_API_BASE": "https://api.flex.team",
    "FLEX_TOKEN_URL": "https://api.flex.team/oauth/token",
    "FLEX_REFRESH_TOKEN": "your_refresh_token",
    "AZURE_TENANT_ID": "your_tenant_id",
    "AZURE_CLIENT_ID": "your_azure_client_id",
    "AZURE_CLIENT_SECRET": "your_azure_client_secret",
    "HR_EMAIL": "hr@itmoou.com",
    "CEO_EMAIL": "ceo@itmoou.com",
    "TZ": "Asia/Seoul",
    "LOG_LEVEL": "info"
  }
}
```

---

## 배포

### Azure Portal을 통한 배포

1. **Azure Function App 생성**
   - 런타임: Node.js 18
   - OS: Linux 권장
   - 플랜: Consumption (자동 스케일링)

2. **환경 변수 설정**
   - Azure Portal → Function App → Configuration
   - `.env`의 모든 변수를 Application Settings에 추가

3. **코드 배포**
   ```bash
   # Azure CLI 로그인
   az login
   
   # Function App에 배포
   func azure functionapp publish <your-function-app-name>
   ```

### Azure DevOps / GitHub Actions를 통한 CI/CD

`.github/workflows/deploy.yml` 예제:

```yaml
name: Deploy to Azure Functions

on:
  push:
    branches:
      - main

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Deploy to Azure Functions
        uses: Azure/functions-action@v1
        with:
          app-name: ${{ secrets.AZURE_FUNCTION_APP_NAME }}
          package: .
          publish-profile: ${{ secrets.AZURE_FUNCTION_APP_PUBLISH_PROFILE }}
```

---

## 알림 정책

### 출근 알림 정책

```typescript
// 1차 알림: 11:05
if (출근 기록 없음 && !휴가) {
  Teams DM 발송 (경고 수준: 주의)
}

// 2차 알림: 11:30
if (여전히 출근 기록 없음 && !휴가) {
  Teams DM 발송 (경고 수준: 긴급)
}
```

### 퇴근 알림 정책

```typescript
// 1차 알림: 20:30
if (출근 기록 있음 && 퇴근 기록 없음 && !휴가) {
  Teams DM 발송 (경고 수준: 주의)
}

// 2차 알림: 22:00
if (여전히 퇴근 기록 없음 && !휴가) {
  Teams DM 발송 (경고 수준: 긴급)
}
```

### 당일 요약 정책

```typescript
// 22:10
const 누락자 = 출근 누락자 + 퇴근 누락자
if (누락자.length > 0) {
  누락자.forEach(직원 => {
    Teams DM 발송 (당일 누락 요약)
  })
}
```

### Outlook 리포트 정책

```typescript
// 09:00 (전일 리포트)
const 전일누락 = 전일_출근누락 + 전일_퇴근누락
if (전일누락.length > 0) {
  Outlook 이메일 발송 (to: hr@itmoou.com)
}
```

---

## API 명세

### Flex OpenAPI 엔드포인트 (구현 필요)

다음 엔드포인트들을 실제 Flex API URL로 교체해야 합니다:

#### 1. 전체 직원 목록 조회

```http
GET /api/v1/employees
Authorization: Bearer {access_token}
```

**응답 예시:**
```json
{
  "employees": [
    {
      "id": "emp001",
      "name": "홍길동",
      "email": "hong@example.com",
      "teamsUserId": "29:1a2b3c..."
    }
  ]
}
```

#### 2. 근태 기록 조회

```http
GET /api/v1/attendance/{employeeId}?date=YYYY-MM-DD
Authorization: Bearer {access_token}
```

**응답 예시:**
```json
{
  "attendance": {
    "employeeId": "emp001",
    "date": "2024-02-04",
    "checkInTime": "09:15:30",
    "checkOutTime": "18:45:20",
    "status": "present"
  }
}
```

#### 3. 휴가자 목록 조회

```http
GET /api/v1/vacations?date=YYYY-MM-DD
Authorization: Bearer {access_token}
```

**응답 예시:**
```json
{
  "vacations": [
    {
      "employeeId": "emp002",
      "startDate": "2024-02-04",
      "endDate": "2024-02-05",
      "type": "annual"
    }
  ]
}
```

#### 4. Access Token 갱신

```http
POST /oauth/token
Content-Type: application/json

{
  "grant_type": "refresh_token",
  "refresh_token": "{refresh_token}",
  "client_id": "{client_id}",
  "client_secret": "{client_secret}"
}
```

**응답 예시:**
```json
{
  "access_token": "new_access_token",
  "refresh_token": "new_refresh_token",
  "expires_in": 600
}
```

### Microsoft Graph API

시스템에서 사용하는 Graph API 권한:

- `Chat.ReadWrite` - Teams 채팅 읽기/쓰기
- `Mail.Send` - 이메일 발송
- `User.Read.All` - 사용자 정보 조회

---

## 트러블슈팅

### 1. Access Token 만료 오류

**증상:**
```
[FlexClient] API 호출 실패: 401 Unauthorized
```

**해결:**
- Access Token은 10분마다 자동 갱신됩니다.
- Refresh Token이 유효한지 확인하세요.
- 수동으로 새 토큰을 발급받아 환경 변수를 업데이트하세요.

### 2. Teams DM 전송 실패

**증상:**
```
[TeamsClient] DM 전송 실패: 404 Not Found
```

**해결:**
- 직원 정보에 `teamsUserId`가 정확히 설정되었는지 확인
- Azure AD Application에 `Chat.ReadWrite` 권한이 부여되었는지 확인
- Admin Consent가 완료되었는지 확인

### 3. Outlook 이메일 발송 실패

**증상:**
```
[OutlookClient] 이메일 전송 실패: 403 Forbidden
```

**해결:**
- Azure AD Application에 `Mail.Send` 권한이 부여되었는지 확인
- `HR_EMAIL` 계정이 Microsoft 365에 존재하는지 확인
- Mailbox가 활성화되어 있는지 확인

### 4. Refresh Token 만료

**증상:**
- 2일 전 CEO에게 경고 이메일이 발송됨
- 시스템이 API 호출 실패

**해결:**
1. Flex 시스템에 로그인하여 새 Refresh Token 발급
2. 환경 변수 업데이트:
   ```bash
   # Azure Portal
   Configuration → Application Settings
   FLEX_REFRESH_TOKEN=새_리프레시_토큰
   ```
3. Function App 재시작

### 5. 휴가자가 알림을 받는 경우

**증상:**
- 휴가 중인 직원이 알림을 받음

**해결:**
- Flex API의 휴가 데이터가 정확한지 확인
- `getVacations()` API 응답 확인
- 날짜 형식이 `YYYY-MM-DD`인지 확인

---

## 라이선스

ISC

---

## 문의

시스템 관련 문의사항은 HR 담당자에게 연락해주세요.

- **Email**: hr@itmoou.com
- **긴급**: CEO (ceo@itmoou.com)

---

## 변경 이력

### v2.0.0 (2024-02-06) - Phase 2: 휴가 관리 자동화 🆕
- **휴가 승인 알림**: Flex 휴가 승인 시 Teams Bot 알림 자동 발송
- **Outlook 캘린더 연동**: 휴가 승인 시 개인/팀 캘린더에 자동 등록
- **매일 휴가 현황 공지**: 평일 09:00에 오늘 휴가자 및 주간 휴가 현황 이메일 발송
- **휴가 리마인더**: 
  - 내일 휴가 시작하는 직원에게 알림 (평일 18:00)
  - 내일 복귀하는 직원에게 리마인더 (평일 18:00)
- **Flex API 휴가 조회 강화**: 
  - 날짜 범위별 휴가 조회
  - 휴가 시작/종료일 필터링
- **새로운 API 엔드포인트**: POST `/api/vacation/approved` (휴가 승인 Webhook)

### v1.0.0 (2024-02-04) - Phase 1: 근태 관리
- 초기 버전 출시
- Flex OpenAPI 연동
- Microsoft Teams DM 알림
- Outlook 일일 리포트
- Access Token 자동 갱신
- Refresh Token 만료 경고
