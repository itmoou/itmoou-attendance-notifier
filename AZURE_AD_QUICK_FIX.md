# 🔴 Azure AD 인증 오류 - 빠른 해결 가이드

## 현재 오류 메시지

```
AADSTS700016: Application with identifier '52a8b283-875d-45ed-8282-f275c652f498' 
was not found in directory 'Bot Framework'.
```

---

## 🎯 가장 빠른 해결 방법 (5분 안에 해결)

### 1️⃣ Azure Portal에서 App Registration 확인

**URL**: https://portal.azure.com → Azure Active Directory → App registrations

1. **"All applications"** 탭 클릭
2. 검색: `52a8b283-875d-45ed-8282-f275c652f498`
3. 결과 확인:

#### ✅ 앱이 보이는 경우
- 앱 클릭 → **Certificates & secrets** 클릭
- **Client secrets** 확인:
  - 만료됨(Expired) → 새로 생성 필요
  - 활성(Active) → OK (하지만 BOT_APP_PASSWORD가 맞는지 확인)
  - 없음 → 새로 생성 필요

**새 Secret 생성**:
1. **+ New client secret** 클릭
2. Description: `Bot Framework Secret 2026`
3. Expires: **730 days (24 months)**
4. **Add** 클릭
5. ⚠️ **Value 즉시 복사!** (다시 볼 수 없음)

#### ❌ 앱이 안 보이는 경우
→ [아래 "App Registration 새로 만들기"](#app-registration-새로-만들기) 참조

---

### 2️⃣ Function App 환경변수 업데이트

**URL**: https://portal.azure.com → Function App: `itmoou-attendance-func`

1. Settings → **Environment variables** 클릭
2. **BOT_APP_PASSWORD** 찾기
3. **Edit** 클릭
4. 위에서 복사한 Secret 값 붙여넣기
5. **Apply** 클릭
6. **Confirm** 클릭

---

### 3️⃣ Function App 재시작

**중요**: 환경변수 변경 후 **반드시 재시작** 필요!

1. Function App → **Overview**
2. 상단의 **Restart** 버튼 클릭
3. **Yes** 확인
4. 1-2분 대기

---

### 4️⃣ 테스트

#### A. Web Chat에서 테스트 (가장 빠름)

**URL**: https://portal.azure.com → Bot Service: `itmoou-attendance-bot`

1. **Test in Web Chat** 클릭
2. 메시지 입력: `안녕하세요`
3. 응답 확인:
   - ✅ 봇 응답이 오면 → **성공!**
   - ❌ 오류 메시지 → Application Insights 확인 필요

#### B. Teams에서 테스트

1. Teams → Apps → **근태알림** 검색
2. 제거 후 재설치 (캐시 초기화)
3. 봇 열기 → 메시지 전송
4. 응답 확인

---

## 🆘 앱이 Azure AD에 없는 경우

### App Registration 새로 만들기

#### 1. 새 앱 등록

**URL**: https://portal.azure.com → Azure Active Directory → App registrations

1. **+ New registration** 클릭
2. 입력:
   - **Name**: `itmoou-attendance-bot`
   - **Supported account types**: 
     - ✅ **Accounts in any organizational directory (Any Azure AD directory - Multitenant) and personal Microsoft accounts**
   - **Redirect URI**: 비워둠
3. **Register** 클릭

#### 2. Application ID 확인

- Overview 페이지에서 **Application (client) ID** 복사
- 예: `52a8b283-875d-45ed-8282-f275c652f498`

⚠️ **중요**: 새 ID가 생성되면 모든 곳을 업데이트해야 합니다:
- Azure Bot Service Configuration
- Function App 환경변수 (BOT_APP_ID)
- Teams Developer Portal (Bot ID)

#### 3. Client Secret 생성

1. **Certificates & secrets** → **+ New client secret**
2. Description: `Bot Framework Secret 2026`
3. Expires: **730 days**
4. **Add** → **Value 복사** ⚠️

#### 4. 모든 서비스 업데이트

##### A. Azure Bot Service
- Bot Service → Configuration
- **Microsoft App ID**: (새 ID 입력)
- **Microsoft App Type**: **Multi Tenant**
- **Apply** → **저장**

##### B. Function App
- Function App → Environment variables
- **BOT_APP_ID**: (새 ID)
- **BOT_APP_PASSWORD**: (새 Secret)
- **Apply** → **Restart**

##### C. Teams Developer Portal
- https://dev.teams.microsoft.com/
- 근태알림 앱 → App features → Bot
- **Bot ID**: (새 ID)
- **Save** → **Publish** → **Update**

---

## 📊 문제 진단

### Application Insights에서 오류 확인

**URL**: https://portal.azure.com → Application Insights

**KQL 쿼리**:
```kusto
traces
| union exceptions
| where timestamp > ago(10m)
| where cloud_RoleName == "itmoou-attendance-func"
| where message contains "AADSTS" or message contains "400" or message contains "token"
| order by timestamp desc
| take 20
| project timestamp, message, severityLevel
```

### 일반적인 오류 코드

| 오류 코드 | 원인 | 해결 방법 |
|----------|------|----------|
| **AADSTS700016** | App이 Azure AD에 없음 | App Registration 확인/생성 |
| **AADSTS7000215** | Client Secret 유효하지 않음 | 새 Secret 생성 |
| **401 Unauthorized** | 인증 실패 | BOT_APP_PASSWORD 확인 |
| **500 Internal Server Error** | Function 코드 오류 | Application Insights 로그 확인 |

---

## ✅ 체크리스트

완료 여부를 확인하세요:

### Azure Active Directory
- [ ] App Registration 존재함
- [ ] Application ID 일치: `52a8b283-875d-45ed-8282-f275c652f498`
- [ ] Client Secret 유효함 (만료되지 않음)
- [ ] Supported account types: **Multi Tenant**

### Azure Bot Service
- [ ] Microsoft App ID 일치
- [ ] Microsoft App Type: **Multi Tenant**
- [ ] Messaging endpoint 올바름:
  ```
  https://itmoou-attendance-func-ate3csagf3c4hyas.koreacentral-01.azurewebsites.net/api/bot/messages
  ```
- [ ] Teams 채널 상태: **Healthy**

### Function App
- [ ] BOT_APP_ID 설정됨
- [ ] BOT_APP_PASSWORD 설정됨 (올바른 Secret 값)
- [ ] Function App 재시작됨

### 테스트
- [ ] Web Chat에서 응답 확인
- [ ] Teams에서 메시지 전송 가능
- [ ] Application Insights에 오류 없음

---

## 🚀 성공 확인

모든 설정이 완료되면:

### Web Chat 테스트
1. Bot Service → Test in Web Chat
2. 메시지: `안녕하세요`
3. 예상 응답:
   ```
   근태알림(자동 알림) / 회신 불필요
   
   안녕하세요! 👋
   
   저는 근태 누락 알림 봇입니다.
   ...
   ```

### Teams 테스트
1. Teams → 근태알림 봇
2. 메시지 전송
3. 봇 응답 확인

### Application Insights
```kusto
traces
| where timestamp > ago(5m)
| where message contains "[BotMessages] 요청 수신"
| order by timestamp desc
| take 5
```

로그가 보이고 오류가 없으면 → **성공!** 🎉

---

## 📞 추가 도움

위 단계를 모두 수행했는데도 문제가 해결되지 않으면:

### 스크린샷 공유
1. Azure AD → App registrations (검색 결과)
2. App → Certificates & secrets (Secret 목록, 만료일)
3. Function App → Environment variables (BOT_APP_ID, BOT_APP_PASSWORD)
4. Application Insights → Logs (최근 10분 오류)

### 로그 공유
```kusto
traces
| union exceptions
| where timestamp > ago(10m)
| where cloud_RoleName == "itmoou-attendance-func"
| order by timestamp desc
| take 20
| project timestamp, message, severityLevel, problemId
```

---

## 📚 관련 문서

- **상세 가이드**: `AZURE_AD_FIX_GUIDE.md`
- **진단 스크립트**: `check-azure-ad.sh`
- **Bot 설정 가이드**: `TEAMS_BOT_SETUP.md`

---

**작성일**: 2026-02-06  
**버전**: 1.0  
**대상**: itmoou-attendance-bot 문제 해결
