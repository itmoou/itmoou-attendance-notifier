# Flex Token 자동 갱신 문제 해결 가이드

## 🔍 문제 상황

```
{"success":false,"error":"Flex API Access Token 재발급 실패"}
```

### 원인

1. **Refresh Token 만료** (7일)
2. **잘못된 Token URL** 또는 **API Base URL**
3. **Flex API 서버 문제**

---

## ✅ 해결 방법

### 1단계: Flex Token 테스트 API 실행

**배포 완료 대기 (5-10분):**
- GitHub Actions: https://github.com/itmoou/itmoou-attendance-notifier/actions

**배포 완료 후:**

#### Azure Portal에서 테스트

1. **Azure Portal** → Function App → `itmoou-attendance-func`
2. **Functions** → `testFlexToken`
3. **Code + Test** → **Test/Run**
4. HTTP Method: `GET`
5. **Run** 클릭

#### 브라우저에서 직접 테스트

```
https://itmoou-attendance-func.azurewebsites.net/api/test/flex-token?code={Function_Key}
```

---

### 2단계: 로그 분석

**성공 시 응답 예시:**

```json
{
  "success": true,
  "message": "Flex API 토큰 테스트 완료",
  "data": {
    "accessToken": {
      "received": true,
      "length": 850,
      "preview": "eyJhbGciOiJSUzI1NiIsInR5cC...",
      "expiresIn": 600,
      "tokenType": "Bearer"
    },
    "refreshToken": {
      "received": true,
      "length": 120,
      "changed": true,
      "preview": "def50200a1b2c3d4e5f6..."
    }
  }
}
```

**주요 확인 사항:**

1. **`accessToken.received: true`** → Access Token 발급 성공 ✅
2. **`refreshToken.received: true`** → 새 Refresh Token 발급됨 ✅
3. **`refreshToken.changed: true`** → ⚠️ **환경변수 업데이트 필요!**

---

### 3단계: Refresh Token 업데이트 (changed: true인 경우)

#### 방법 A: 로그에서 새 Refresh Token 복사

**Azure Portal → Function App → Log stream:**

```
[TestFlexToken] ✅ 새로운 Refresh Token 발급됨!
[TestFlexToken] 새 Refresh Token 길이: 120
[TestFlexToken] 새 Refresh Token 앞 20자: def50200a1b2c3d4e5f6...
```

**또는 응답 JSON에서 복사:**

```json
{
  "data": {
    "refreshToken": {
      "preview": "def50200a1b2c3d4e5f6..."
    }
  }
}
```

#### 방법 B: Azure Portal에서 환경변수 업데이트

1. **Function App** → `itmoou-attendance-func`
2. **Configuration** → **Application settings**
3. `FLEX_REFRESH_TOKEN` 클릭 → **Edit**
4. 새 Refresh Token 붙여넣기
5. **OK** → **Save** → **Continue**
6. Function App 재시작 (1-2분)

---

### 4단계: 재테스트

**1-2분 후 다시 테스트:**

```
GET /api/vacation/calendar?year=2024&month=2&code={Function_Key}
```

**예상 결과:**

```json
{
  "success": true,
  "data": {
    "startDate": "2024-02-01",
    "endDate": "2024-02-29",
    "vacationDays": [...]
  }
}
```

---

## 🔧 상세 진단

### 에러 유형별 해결

#### 1. `400 Bad Request` - 잘못된 Refresh Token

**증상:**
```json
{
  "error": "invalid_grant",
  "error_description": "The provided authorization grant is invalid..."
}
```

**원인:** Refresh Token이 만료되었거나 잘못됨

**해결:**
1. Flex 관리자 페이지에서 **새 Refresh Token 발급**
2. Azure Configuration에서 `FLEX_REFRESH_TOKEN` 업데이트

---

#### 2. `404 Not Found` - 잘못된 Token URL

**증상:**
```
Cannot POST /oauth/token
```

**원인:** `FLEX_TOKEN_URL` 환경변수가 잘못됨

**해결:**

Azure Configuration에서 확인:
```
FLEX_TOKEN_URL=https://openapi.flex.team/v2/auth/realms/open-api/protocol/openid-connect/token
```

---

#### 3. `401 Unauthorized` - 인증 실패

**증상:**
```json
{
  "error": "unauthorized",
  "error_description": "Full authentication is required..."
}
```

**원인:** Flex API 인증 문제

**해결:**
1. Flex 계정 확인
2. OpenAPI 권한 확인
3. Flex 고객지원 문의

---

## 📊 자동 갱신 로직

### 현재 구현

```typescript
// tokenManager.ts

// Access Token 캐시
let cachedAccessToken: string | null = null;
let cachedExpiresAt: number = 0;

// 캐시된 토큰이 30초 이상 유효하면 재사용
if (cachedAccessToken && now < cachedExpiresAt - 30000) {
  return cachedAccessToken;
}

// 30초 이내면 재발급
const response = await axios.post(tokenUrl, {
  grant_type: 'refresh_token',
  refresh_token: refreshToken,
});

// 새 Refresh Token이 있으면 로그에 경고
if (newRefreshToken && newRefreshToken !== refreshToken) {
  console.warn('⚠️ 새로운 Refresh Token 발급됨!');
  console.warn('Azure Portal에서 FLEX_REFRESH_TOKEN 환경변수를 업데이트하세요');
}
```

### 토큰 만료 시간

- **Access Token:** 10분 (600초)
- **Refresh Token:** 7일 (168시간)
- **재발급 시점:** Access Token 만료 30초 전

---

## 🚨 중요: Refresh Token 자동 업데이트 (향후 개선)

### 현재 한계

- **수동 업데이트 필요:** 새 Refresh Token 발급 시 Azure Portal에서 수동으로 환경변수 업데이트

### 향후 개선 방안

#### 옵션 1: Azure Key Vault 사용

```typescript
import { SecretClient } from '@azure/keyvault-secrets';

// 새 Refresh Token 저장
if (newRefreshToken && newRefreshToken !== refreshToken) {
  const client = new SecretClient(vaultUrl, credential);
  await client.setSecret('FLEX-REFRESH-TOKEN', newRefreshToken);
  console.log('✅ Refresh Token 자동 업데이트 완료');
}
```

**장점:**
- 자동 업데이트
- 보안 강화 (Key Vault에 저장)
- 버전 관리

**단점:**
- 추가 비용
- 복잡도 증가

#### 옵션 2: Azure App Configuration

```typescript
import { AppConfigurationClient } from '@azure/app-configuration';

// 새 Refresh Token 저장
const client = new AppConfigurationClient(connectionString);
await client.setConfigurationSetting({
  key: 'FLEX_REFRESH_TOKEN',
  value: newRefreshToken,
});
```

#### 옵션 3: Azure Table Storage

```typescript
// Refresh Token을 Table Storage에 저장
const entity = {
  partitionKey: 'tokens',
  rowKey: 'flex-refresh',
  value: newRefreshToken,
  updatedAt: new Date().toISOString(),
};

await tableClient.upsertEntity(entity);
```

---

## 📋 체크리스트

### 문제 발생 시

- [ ] GitHub Actions 배포 완료 확인
- [ ] `testFlexToken` API 실행
- [ ] 로그에서 에러 메시지 확인
- [ ] `refreshToken.changed: true`인지 확인
- [ ] 새 Refresh Token 복사
- [ ] Azure Configuration 업데이트
- [ ] Function App 재시작 대기 (1-2분)
- [ ] 재테스트

### 정상 동작 확인

- [ ] `accessToken.received: true`
- [ ] `accessToken.expiresIn: 600` (10분)
- [ ] API 호출 성공
- [ ] 캘린더 데이터 로딩 성공

---

## 🆘 여전히 안 된다면?

### 1. Flex 관리자 페이지에서 새 토큰 발급

**절차:**
1. https://flex.team 로그인
2. **설정** → **Open API** 또는 **외부 연동**
3. **새 Refresh Token 발급**
4. 발급된 토큰 복사
5. Azure Configuration에 적용

### 2. Flex 고객지원 문의

**연락처:**
- 이메일: support@flex.team
- 메시지: "OpenAPI Refresh Token 재발급 요청 및 자동 갱신 방법 문의"

### 3. Application Insights 로그 확인

**쿼리:**

```kusto
traces
| where timestamp > ago(1h)
| where message contains "TokenManager" or message contains "TestFlexToken"
| order by timestamp desc
| take 100
```

**주요 로그:**
- `[TokenManager] Access Token 재발급 완료`
- `[TokenManager] ⚠️ 새로운 Refresh Token 발급됨!`
- `[TestFlexToken] ✅ Access Token 발급 성공`

---

## 📚 관련 문서

- [APIS.md](./APIS.md) - Flex API 명세
- [FLEX_INTEGRATION_GUIDE.md](./FLEX_INTEGRATION_GUIDE.md) - Flex 연동 가이드
- [README.md](./README.md) - 프로젝트 개요

**작성일:** 2024-02-07
