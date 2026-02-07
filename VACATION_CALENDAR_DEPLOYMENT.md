# 휴가 캘린더 배포 및 테스트 가이드

## 🚀 배포 완료 체크리스트

### 1단계: GitHub Actions 배포 확인

배포가 완료되었는지 확인하세요:

1. **GitHub Repository** 접속
   - https://github.com/itmoou/itmoou-attendance-notifier/actions

2. **최신 워크플로우 실행** 확인
   - 워크플로우 이름: "Build and deploy Node.js project to Azure Function App"
   - 상태: ✅ 초록색 체크 마크

3. **배포 완료까지 약 5-10분 소요**

---

### 2단계: Backend API 테스트

#### A. Azure Portal에서 Function 확인

1. **Azure Portal** 접속: https://portal.azure.com
2. **Function App** → `itmoou-attendance-func`
3. **Functions** → `vacationCalendar` 함수 확인
4. **Code + Test** → **Test/Run** 클릭

#### B. HTTP GET 테스트

**Test/Run 패널에서:**
- HTTP Method: `GET`
- Query Parameters 추가:
  - `year`: `2024`
  - `month`: `2`

**Run 클릭 후 예상 응답:**

```json
{
  "success": true,
  "data": {
    "startDate": "2024-02-01",
    "endDate": "2024-02-29",
    "vacationDays": [
      {
        "date": "2024-02-14",
        "count": 1,
        "vacationers": [...]
      }
    ],
    "totalVacationDays": 5
  }
}
```

#### C. Function Key 복사

1. **Functions** → `vacationCalendar`
2. **Function Keys** 탭
3. `default` 키 값 복사 → 메모장에 저장

**예시:**
```
ABC123xyz456DEF789...
```

---

### 3단계: Frontend 로컬 테스트

#### A. Function Key 설정

`public/app.js` 파일 수정:

```javascript
// Function Key (보안상 환경변수로 관리하거나 인증 토큰 사용 권장)
const FUNCTION_KEY = 'ABC123xyz456DEF789...'; // ← 여기에 복사한 키 입력
```

#### B. 로컬 웹 서버 실행

**방법 1: Python HTTP Server**

```bash
cd /home/user/webapp/public
python3 -m http.server 8000
```

**방법 2: Node.js HTTP Server**

```bash
cd /home/user/webapp/public
npx http-server -p 8000
```

**방법 3: VS Code Live Server**

VS Code에서 `public/index.html`을 열고 Live Server 실행

#### C. 브라우저에서 확인

```
http://localhost:8000
```

**확인 사항:**
1. ✅ 달력이 정상적으로 표시됨
2. ✅ 이전/다음 달 버튼 작동
3. ✅ 휴가자가 있는 날짜에 배지 표시
4. ✅ 날짜 클릭 시 휴가자 상세 정보 모달 표시
5. ✅ 브라우저 콘솔에 에러 없음

---

### 4단계: Azure Static Web Apps 배포

#### 옵션 A: Azure CLI로 배포

```bash
# 1. Azure CLI 로그인
az login

# 2. Static Web App 생성
az staticwebapp create \
  --name itmoou-vacation-calendar \
  --resource-group itmoou-resources \
  --source https://github.com/itmoou/itmoou-attendance-notifier \
  --location "East Asia" \
  --branch main \
  --app-location "public" \
  --output-location "" \
  --login-with-github

# 3. 배포 토큰 확인
az staticwebapp secrets list \
  --name itmoou-vacation-calendar \
  --resource-group itmoou-resources
```

#### 옵션 B: Azure Portal에서 수동 생성

1. **Azure Portal** → **Static Web Apps** → **Create**
2. **기본 정보 입력:**
   - Subscription: 구독 선택
   - Resource Group: `itmoou-resources`
   - Name: `itmoou-vacation-calendar`
   - Plan: `Free`
   - Region: `East Asia`

3. **Deployment 설정:**
   - Source: `GitHub`
   - Organization: `itmoou`
   - Repository: `itmoou-attendance-notifier`
   - Branch: `main`
   - Build Presets: `Custom`
   - App location: `/public`
   - Output location: (비워두기)

4. **Review + Create** → **Create**

#### 옵션 C: GitHub Actions 자동 배포 (권장)

`.github/workflows/static-web-app.yml` 생성:

```yaml
name: Deploy Static Web App

on:
  push:
    branches:
      - main
    paths:
      - 'public/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "public"
          output_location: ""
```

**GitHub Secrets 추가:**
1. GitHub Repository → Settings → Secrets and variables → Actions
2. **New repository secret**
3. Name: `AZURE_STATIC_WEB_APPS_API_TOKEN`
4. Value: Azure Portal에서 복사한 배포 토큰

---

### 5단계: 프로덕션 URL 확인 및 테스트

#### A. Static Web App URL 확인

```bash
az staticwebapp show \
  --name itmoou-vacation-calendar \
  --resource-group itmoou-resources \
  --query "defaultHostname" \
  --output tsv
```

**예상 출력:**
```
itmoou-vacation-calendar.azurestaticapps.net
```

#### B. Function Key 환경변수 설정

**중요:** 프로덕션 환경에서는 Function Key를 코드에 직접 입력하지 말고 환경변수로 관리하세요.

```bash
az staticwebapp appsettings set \
  --name itmoou-vacation-calendar \
  --resource-group itmoou-resources \
  --setting-names FUNCTION_KEY="{복사한_키}"
```

#### C. 프로덕션 URL 테스트

브라우저에서 접속:
```
https://itmoou-vacation-calendar.azurestaticapps.net
```

**확인 사항:**
1. ✅ HTTPS 접속 정상
2. ✅ 달력 UI 정상 표시
3. ✅ API 호출 성공 (개발자 도구 → Network 탭 확인)
4. ✅ 휴가 데이터 로딩 성공
5. ✅ 날짜 클릭 시 상세 정보 표시

---

### 6단계: CORS 설정 (필수)

Azure Functions에서 Static Web App 도메인을 허용해야 합니다:

```bash
az functionapp cors add \
  --name itmoou-attendance-func \
  --resource-group itmoou-resources \
  --allowed-origins "https://itmoou-vacation-calendar.azurestaticapps.net"
```

**또는 Azure Portal에서:**

1. Function App → `itmoou-attendance-func`
2. **CORS** 메뉴
3. **Allowed Origins에 추가:**
   ```
   https://itmoou-vacation-calendar.azurestaticapps.net
   ```
4. **Save**

---

### 7단계: Azure AD 인증 설정 (선택사항)

HR 직원만 접근할 수 있도록 인증을 추가하세요:

#### A. Azure AD 앱 등록

1. **Azure Portal** → **Azure Active Directory** → **App registrations**
2. **New registration**
   - Name: `itmoou-vacation-calendar`
   - Supported account types: `Accounts in this organizational directory only`
   - Redirect URI:
     ```
     https://itmoou-vacation-calendar.azurestaticapps.net/.auth/login/aad/callback
     ```
3. **Register**

#### B. Client Secret 생성

1. 등록된 앱 → **Certificates & secrets**
2. **New client secret**
3. Description: `vacation-calendar-secret`
4. Expires: `24 months`
5. **Add** → **복사하여 저장**

#### C. Static Web App에 인증 설정

```bash
az staticwebapp identity assign \
  --name itmoou-vacation-calendar \
  --resource-group itmoou-resources
```

`public/staticwebapp.config.json` 업데이트:

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

---

## 🧪 테스트 시나리오

### 시나리오 1: 현재 월 휴가 확인

1. 웹페이지 접속
2. 현재 월의 달력 확인
3. 휴가자가 있는 날짜에 배지 표시 확인

**예상 결과:** ✅ 현재 월 데이터 정상 표시

---

### 시나리오 2: 특정 날짜 휴가자 상세 확인

1. 휴가 배지가 있는 날짜 클릭
2. 모달에서 휴가자 목록 확인
3. 직원 이름, 사원번호, 휴가 종류 확인

**예상 결과:** ✅ 휴가자 상세 정보 모달 표시

---

### 시나리오 3: 이전/다음 달 네비게이션

1. "다음 달" 버튼 클릭
2. 다음 달 데이터 로딩 확인
3. "이전 달" 버튼으로 되돌아오기

**예상 결과:** ✅ 월 변경 시 데이터 자동 갱신

---

### 시나리오 4: 모바일 반응형 확인

1. 브라우저 개발자 도구 → 모바일 뷰
2. 달력 UI 확인
3. 모달 UI 확인

**예상 결과:** ✅ 모바일에서도 정상 표시

---

## 🐛 문제 해결

### 문제 1: API 호출 실패 (401 Unauthorized)

**증상:** 브라우저 콘솔에 401 에러

**원인:** Function Key 미설정 또는 잘못됨

**해결:**
1. Azure Portal에서 Function Key 재확인
2. `public/app.js`의 `FUNCTION_KEY` 업데이트
3. 캐시 삭제 후 새로고침 (Ctrl + Shift + R)

---

### 문제 2: CORS 에러

**증상:** 브라우저 콘솔에 "CORS policy blocked" 에러

**원인:** Azure Functions CORS 설정 누락

**해결:**
```bash
az functionapp cors add \
  --name itmoou-attendance-func \
  --resource-group itmoou-resources \
  --allowed-origins "https://your-domain.azurestaticapps.net"
```

---

### 문제 3: 휴가 데이터가 없음

**증상:** 달력은 로드되지만 휴가 배지가 없음

**원인:** Flex API 데이터 없음 또는 Employee Map 미설정

**해결:**
1. Azure Portal → Function App → Log stream
2. Flex API 호출 로그 확인
3. Employee Map 테이블 데이터 확인

---

### 문제 4: 배포 후 변경사항이 반영되지 않음

**증상:** 코드 변경 후 Push했지만 웹페이지가 그대로

**원인:** CDN 캐시 또는 브라우저 캐시

**해결:**
1. 브라우저 캐시 강제 삭제 (Ctrl + Shift + R)
2. Azure Portal → Static Web App → Purge CDN
3. 5-10분 후 재확인

---

## 📊 모니터링

### Application Insights 쿼리

```kusto
// 휴가 캘린더 API 호출 로그
traces
| where timestamp > ago(1h)
| where message contains "VacationCalendar"
| order by timestamp desc
| take 100
```

```kusto
// API 응답 시간
requests
| where timestamp > ago(24h)
| where name == "GET /api/vacation/calendar"
| summarize avg(duration), max(duration), min(duration) by bin(timestamp, 1h)
```

---

## ✅ 배포 완료 체크리스트

- [ ] GitHub Actions 배포 성공 확인
- [ ] Backend API 테스트 (Azure Portal)
- [ ] Function Key 복사 및 설정
- [ ] 로컬에서 웹페이지 테스트
- [ ] Azure Static Web Apps 생성
- [ ] CORS 설정 완료
- [ ] 프로덕션 URL 접속 확인
- [ ] 휴가 데이터 정상 로딩
- [ ] 모바일 반응형 확인
- [ ] Azure AD 인증 설정 (선택)

---

## 🎉 완료!

모든 단계가 완료되면 다음 URL로 접속하여 휴가 현황을 확인할 수 있습니다:

```
https://itmoou-vacation-calendar.azurestaticapps.net
```

**문의:** Azure Portal Log stream 또는 GitHub Issues

**작성일:** 2024-02-07
