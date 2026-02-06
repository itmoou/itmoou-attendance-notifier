# Azure AD 인증 문제 해결 가이드

## 🔴 현재 오류

```
AADSTS700016: Application with identifier '52a8b283-875d-45ed-8282-f275c652f498' 
was not found in directory 'Bot Framework'.
```

**원인**: Azure AD App Registration이 올바르지 않거나 Bot Framework와 연결되지 않음

---

## ✅ 해결 방법 (단계별)

### 1단계: Azure Active Directory에서 App Registration 확인

#### A. Azure Portal 접속
1. https://portal.azure.com 접속
2. **Azure Active Directory** 검색 및 클릭
3. 왼쪽 메뉴에서 **App registrations** 클릭

#### B. 앱 찾기
1. **All applications** 탭 클릭
2. 검색창에 `52a8b283-875d-45ed-8282-f275c652f498` 입력
3. 앱이 보이는지 확인

**시나리오 A**: 앱이 보임 → [2단계](#2단계-client-secret-확인-및-재생성)로 이동  
**시나리오 B**: 앱이 안 보임 → [3단계](#3단계-app-registration-다시-생성)로 이동

---

### 2단계: Client Secret 확인 및 재생성

> **앱이 존재하는 경우**

#### A. Client Secret 확인
1. App registration 클릭
2. 왼쪽 메뉴에서 **Certificates & secrets** 클릭
3. **Client secrets** 탭 확인

#### B. Secret 상태 확인
- **만료됨(Expired)**: 새로 생성 필요
- **없음(No secrets)**: 새로 생성 필요
- **활성(Active)**: 값 복사 (한 번만 표시됨!)

#### C. 새 Secret 생성 (필요 시)
1. **+ New client secret** 클릭
2. Description: `Bot Framework Secret`
3. Expires: **730 days (24 months)** 권장
4. **Add** 클릭
5. ⚠️ **Value 즉시 복사!** (다시 볼 수 없음)

#### D. Function App에 Secret 설정
1. Azure Portal → **Function App** (`itmoou-attendance-func`)
2. Settings → **Environment variables**
3. **BOT_APP_PASSWORD** 찾기
4. 복사한 Secret 값으로 업데이트
5. **Apply** 클릭
6. **Restart Function App** (Configuration → Overview → Restart)

---

### 3단계: App Registration 다시 생성

> **앱이 없거나 완전히 재생성이 필요한 경우**

#### A. 새 App Registration 생성
1. Azure Active Directory → App registrations
2. **+ New registration** 클릭
3. 입력:
   - **Name**: `itmoou-attendance-bot`
   - **Supported account types**: **Accounts in any organizational directory (Any Azure AD directory - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)**
   - **Redirect URI**: 비워둠
4. **Register** 클릭

#### B. Application ID 확인
- **Application (client) ID** 값 복사
- 예: `52a8b283-875d-45ed-8282-f275c652f498`

#### C. Client Secret 생성
1. Certificates & secrets → **+ New client secret**
2. Description: `Bot Framework Secret`
3. Expires: **730 days**
4. **Add** → **Value 복사** (⚠️ 한 번만 표시!)

#### D. API Permissions 추가 (중요!)
1. 왼쪽 메뉴에서 **API permissions** 클릭
2. **+ Add a permission** 클릭
3. **Microsoft APIs** 탭에서 스크롤 → 못 찾으면 다음 방법:
   - **APIs my organization uses** 탭 클릭
   - 검색: `Bot Framework`
   - 또는 직접 scope 추가: `https://api.botframework.com/.default`

4. **대안 방법** (추천):
   - 이미 생성된 앱의 경우 Bot Framework Token Endpoint가 자동으로 인식함
   - 별도 permission 추가 없이도 작동 가능

---

### 4단계: Azure Bot Service 연결

#### A. Bot Service Configuration 업데이트
1. Azure Portal → **itmoou-attendance-bot** (Bot Service)
2. Settings → **Configuration**
3. 입력 확인/수정:
   - **Microsoft App ID**: `52a8b283-875d-45ed-8282-f275c652f498`
   - **Microsoft App Tenant ID**: `common` 또는 실제 Tenant ID
   - **Microsoft App Type**: **Multi Tenant**
4. **Apply** 클릭

#### B. Messaging Endpoint 확인
- **Messaging endpoint**: 
  ```
  https://itmoou-attendance-func-ate3csagf3c4hyas.koreacentral-01.azurewebsites.net/api/bot/messages
  ```
- **Apply** 클릭

---

### 5단계: Function App 환경변수 설정

#### A. Function App 환경변수 확인
1. Azure Portal → **itmoou-attendance-func**
2. Settings → **Environment variables**
3. 다음 변수 확인/설정:

```
BOT_APP_ID = 52a8b283-875d-45ed-8282-f275c652f498
BOT_APP_PASSWORD = <위에서 생성한 Client Secret Value>
```

#### B. 적용 및 재시작
1. **Apply** 클릭
2. **Overview** → **Restart** 클릭
3. 재시작 완료 대기 (1-2분)

---

### 6단계: 테스트

#### A. Function Endpoint 직접 테스트
```bash
curl -X POST https://itmoou-attendance-func-ate3csagf3c4hyas.koreacentral-01.azurewebsites.net/api/bot/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "type": "message",
    "id": "test-id",
    "timestamp": "2026-02-06T03:00:00Z",
    "channelId": "msteams",
    "from": {"id": "test-user"},
    "conversation": {"id": "test-conv"},
    "text": "hi",
    "serviceUrl": "https://smba.trafficmanager.net/apac/"
  }'
```

**예상 응답**:
- ✅ **성공**: `{"status":"ok"}` 또는 메시지 응답
- ❌ **실패**: `{"error":"..."}` → Application Insights 확인

#### B. Bot Framework Portal Web Chat 테스트
1. https://dev.botframework.com/bots 접속
2. 봇 선택 (또는 새로 연결)
3. **Test in Web Chat** 클릭
4. 메시지: `안녕하세요`
5. 응답 확인

#### C. Teams에서 테스트
1. Teams → Apps → 근태알림 재설치
2. 봇 열기
3. 메시지: `안녕하세요`
4. 응답 확인

---

## 🔍 문제 진단 체크리스트

### Azure AD
- [ ] App Registration이 존재함
- [ ] Application ID가 일치: `52a8b283-875d-45ed-8282-f475c652f498`
- [ ] Client Secret이 유효함 (만료되지 않음)
- [ ] Supported account types: **Multi Tenant**

### Azure Bot Service
- [ ] Microsoft App ID가 일치
- [ ] Microsoft App Type: **Multi Tenant**
- [ ] Messaging endpoint가 올바름
- [ ] Microsoft Teams 채널이 **Healthy**

### Function App
- [ ] BOT_APP_ID 환경변수 설정됨
- [ ] BOT_APP_PASSWORD 환경변수 설정됨 (올바른 Secret 값)
- [ ] Function App이 재시작됨

### Application Insights
- [ ] 토큰 요청 오류 없음
- [ ] `[BotMessages] 요청 수신` 로그 보임
- [ ] 500 오류 없음

---

## 📊 Application Insights 확인 쿼리

### 최근 오류 확인
```kusto
traces
| union exceptions
| where timestamp > ago(10m)
| where cloud_RoleName == "itmoou-attendance-func"
| where message contains "AADSTS" or message contains "unauthorized" or message contains "400"
| order by timestamp desc
| take 20
| project timestamp, message, severityLevel
```

### Bot Token 요청 확인
```kusto
traces
| where timestamp > ago(10m)
| where message contains "getBotToken" or message contains "token"
| order by timestamp desc
| take 10
| project timestamp, message
```

---

## 🎯 빠른 해결 방법

### 가장 흔한 원인

1. **Client Secret 만료** → 새로 생성
2. **BOT_APP_PASSWORD 미설정** → Function App에 설정
3. **App Registration이 Multi Tenant가 아님** → Multi Tenant로 변경
4. **Function App 재시작 안 함** → 환경변수 변경 후 반드시 재시작

---

## 📝 스크린샷 요청

다음 화면을 캡처해주세요:

1. **Azure AD → App registrations → 검색 결과**
   - `52a8b283-875d-45ed-8282-f275c652f498` 검색 결과

2. **App registration → Certificates & secrets**
   - Client secrets 목록 (Value 말고 설명/만료일만)

3. **Function App → Environment variables**
   - BOT_APP_ID 값
   - BOT_APP_PASSWORD 존재 여부 (값은 가려도 됨)

4. **Application Insights → Logs**
   - 위의 쿼리 실행 결과 (최근 10분)

---

## ✅ 성공 확인

모든 설정이 완료되면:

1. **Web Chat에서 테스트**:
   - "안녕하세요" 메시지 → 봇 응답 확인

2. **Teams에서 테스트**:
   - 근태알림 봇 열기 → 메시지 전송 → 응답 확인

3. **Application Insights**:
   - `[BotMessages] 요청 수신` 로그 확인
   - 오류 없음 확인

---

## 🆘 추가 도움

위 단계를 모두 수행했는데도 문제가 해결되지 않으면:

1. **스크린샷 공유** (위 4가지)
2. **Application Insights 로그** 공유
3. **정확한 오류 메시지** 공유

그러면 더 정확한 진단을 도와드리겠습니다! 🚀
