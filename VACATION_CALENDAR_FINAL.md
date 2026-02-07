# 🎉 휴가 캘린더 최종 배포 가이드

## ✅ 현재 상태

| 항목 | 상태 |
|------|------|
| **Backend API** | ✅ 완료 (vacationCalendar) |
| **Flex API 인증** | ✅ 완료 (client_id=open-api) |
| **API 테스트** | ✅ 성공 |
| **Frontend 웹페이지** | ✅ 완료 (public/) |
| **Function Key 처리** | ✅ URL 파라미터 방식 |
| **배포** | ⏳ 대기 중 |

---

## 🌐 배포 방법

### 방법 1: Azure Static Web Apps (권장)

#### 1단계: Static Web App 생성

```bash
az staticwebapp create \
  --name itmoou-vacation-calendar \
  --resource-group rg-itmoou-hr-prod \
  --source https://github.com/itmoou/itmoou-attendance-notifier \
  --location "East Asia" \
  --branch main \
  --app-location "public" \
  --skip-api-build
```

#### 2단계: 배포 완료 대기

- GitHub Actions 자동 실행
- 약 5-10분 소요

#### 3단계: URL 확인

```
https://itmoou-vacation-calendar.azurestaticapps.net
```

---

### 방법 2: Azure Storage 정적 웹사이트

#### 1단계: Storage Account에서 정적 웹사이트 활성화

```bash
# Azure Portal에서:
Storage Account → itmooustorage (또는 새로 생성)
→ Static website → Enabled
→ Index document name: index.html
```

#### 2단계: 파일 업로드

```bash
# Azure CLI로 업로드
az storage blob upload-batch \
  --account-name itmooustorage \
  --source ./public \
  --destination '$web' \
  --overwrite
```

#### 3단계: URL 확인

```
https://itmooustorage.z23.web.core.windows.net
```

---

### 방법 3: 로컬 테스트 (개발용)

```bash
cd /home/user/webapp/public
python3 -m http.server 8000
```

**접속 URL**:
```
http://localhost:8000/?key={Function_Key}
```

---

## 🔑 Function Key 사용 방법

### URL 파라미터 방식

```
https://your-vacation-calendar.com/?key=ABC123XYZ456...
```

**장점**:
- 간단한 구현
- 즉시 사용 가능

**단점**:
- URL에 키가 노출됨
- 브라우저 히스토리에 저장됨

### 보안 개선 (선택사항)

#### Azure AD 인증으로 업그레이드

1. Azure AD App Registration
2. MSAL.js 라이브러리 사용
3. Function App에서 Azure AD 인증 활성화

---

## 🛠️ CORS 설정

웹페이지에서 API를 호출하려면 CORS 설정 필요:

```bash
# 로컬 테스트용
az functionapp cors add \
  --name itmoou-attendance-func \
  --resource-group rg-itmoou-hr-prod \
  --allowed-origins "http://localhost:8000"

# Static Web Apps 배포 후
az functionapp cors add \
  --name itmoou-attendance-func \
  --resource-group rg-itmoou-hr-prod \
  --allowed-origins "https://itmoou-vacation-calendar.azurestaticapps.net"

# Storage 정적 웹사이트용
az functionapp cors add \
  --name itmoou-attendance-func \
  --resource-group rg-itmoou-hr-prod \
  --allowed-origins "https://itmooustorage.z23.web.core.windows.net"

# 또는 모든 도메인 허용 (테스트용, 프로덕션 비권장)
az functionapp cors add \
  --name itmoou-attendance-func \
  --resource-group rg-itmoou-hr-prod \
  --allowed-origins "*"
```

---

## 📊 시스템 구성도

```
┌─────────────────────────────────────────────────┐
│   사용자 (브라우저)                              │
│   https://vacation-calendar.com/?key=ABC123     │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│   Azure Static Web Apps / Storage               │
│   (휴가 캘린더 웹페이지)                         │
│   - 달력 UI                                     │
│   - 월별 네비게이션                              │
│   - 날짜별 휴가자 모달                           │
└────────────────┬────────────────────────────────┘
                 │ HTTPS + Function Key (URL param)
                 ▼
┌─────────────────────────────────────────────────┐
│   Azure Functions                               │
│   GET /api/vacation/calendar?year=2026&month=2  │
│   &code={Function_Key}                          │
└────────────────┬────────────────────────────────┘
                 │ Bearer Token (client_id=open-api)
                 ▼
┌─────────────────────────────────────────────────┐
│   Flex API                                      │
│   /users/time-off-uses/dates/{date}             │
└─────────────────────────────────────────────────┘
```

---

## 🧪 테스트 시나리오

### 1. 로컬 테스트

```bash
# 1. 로컬 서버 시작
cd /home/user/webapp/public
python3 -m http.server 8000

# 2. 브라우저 열기
http://localhost:8000/?key={Function_Key}

# 3. 확인 사항
- 달력이 정상적으로 표시되는가?
- 월 변경 버튼이 작동하는가?
- 휴가 데이터가 로드되는가?
```

### 2. API 직접 테스트

```bash
# testFlexToken
curl "https://itmoou-attendance-func.azurewebsites.net/api/test/flex-token?code={Function_Key}"

# vacationCalendar (2026년 2월)
curl "https://itmoou-attendance-func.azurewebsites.net/api/vacation/calendar?year=2026&month=2&code={Function_Key}"

# vacationCalendar (2025년 12월 - 휴가 데이터 있을 수 있음)
curl "https://itmoou-attendance-func.azurewebsites.net/api/vacation/calendar?year=2025&month=12&code={Function_Key}"
```

### 3. 휴가 데이터가 있는 월 테스트

실제 휴가 데이터가 있는 년/월을 테스트:
```
https://itmoou-attendance-func.azurewebsites.net/api/vacation/calendar?year=2024&month=8&code={Function_Key}
```

---

## 🎯 배포 체크리스트

### Backend (완료)
- [x] Azure Function App 배포
- [x] Flex API 인증 (client_id=open-api)
- [x] vacationCalendar API 구현
- [x] testFlexToken API 구현
- [x] 에러 처리 및 로깅

### Frontend (완료)
- [x] HTML/CSS/JS 구현
- [x] 달력 UI
- [x] 월별 네비게이션
- [x] 날짜별 휴가자 상세 모달
- [x] Function Key URL 파라미터 지원
- [x] 로딩 스피너
- [x] 반응형 디자인

### 배포 (진행 중)
- [ ] CORS 설정
- [ ] Azure Static Web Apps 또는 Storage 배포
- [ ] 도메인 확인
- [ ] 엔드투엔드 테스트

---

## 📚 관련 문서

- [VACATION_CALENDAR_GUIDE.md](./VACATION_CALENDAR_GUIDE.md) - 사용 가이드
- [VACATION_CALENDAR_DEPLOYMENT.md](./VACATION_CALENDAR_DEPLOYMENT.md) - 배포 가이드 (상세)
- [FLEX_TOKEN_FIX.md](./FLEX_TOKEN_FIX.md) - Flex API 인증 문제 해결
- [FLEX_INTEGRATION_GUIDE.md](./FLEX_INTEGRATION_GUIDE.md) - Flex 연동 가이드
- [README.md](./README.md) - 프로젝트 전체 개요

---

## 🚀 빠른 시작 (Quick Start)

### 1️⃣ CORS 설정 (필수)

```bash
az functionapp cors add \
  --name itmoou-attendance-func \
  --resource-group rg-itmoou-hr-prod \
  --allowed-origins "*"
```

### 2️⃣ 로컬 테스트

```bash
cd /home/user/webapp/public
python3 -m http.server 8000
```

브라우저 열기:
```
http://localhost:8000/?key={Your_Function_Key}
```

### 3️⃣ Function Key 확인

Azure Portal:
```
itmoou-attendance-func
→ App keys
→ default 키 복사
```

---

## 🎉 완료 후 확인사항

- [ ] 달력이 현재 월로 표시됨
- [ ] 이전/다음 월 버튼 작동
- [ ] 휴가가 있는 날짜에 배지 표시
- [ ] 날짜 클릭 시 상세 정보 모달 표시
- [ ] 오늘 날짜 강조 표시
- [ ] 주말 색상 구분
- [ ] 로딩 상태 표시

---

## 🔧 문제 해결

### CORS 에러

**증상**: `Access to fetch at '...' from origin '...' has been blocked by CORS policy`

**해결**:
```bash
az functionapp cors add \
  --name itmoou-attendance-func \
  --resource-group rg-itmoou-hr-prod \
  --allowed-origins "YOUR_WEBSITE_URL"
```

### Function Key 에러

**증상**: `401 Unauthorized` 또는 `403 Forbidden`

**해결**:
- Function Key가 올바른지 확인
- URL에 `?key=` 파라미터 포함 확인

### 휴가 데이터가 안 보임

**증상**: `vacationDays: []` (빈 배열)

**원인**: 해당 월에 휴가 데이터가 없음 (정상)

**확인**: Flex에서 실제 휴가 데이터가 있는 월로 테스트

---

## 📞 지원

문제가 발생하면:

1. **Azure Portal Log Stream** 확인
   ```
   itmoou-attendance-func → Log stream
   ```

2. **브라우저 Console** 확인
   ```
   F12 → Console 탭
   ```

3. **API 직접 테스트**
   ```bash
   curl "https://itmoou-attendance-func.azurewebsites.net/api/vacation/calendar?year=2026&month=2&code={Key}"
   ```

---

**배포 준비 완료!** 🚀

이제 위의 배포 방법 중 하나를 선택해서 진행하면 됩니다!
