# Flex OpenAPI 인증 가이드

## ⚠️ 중요: 인증 방식

Flex OpenAPI는 **Client ID/Secret을 사용하지 않습니다!**

## 정확한 인증 방식

### 1. Refresh Token 기반 인증

Flex 콘솔에서 발급받는 것:
- **Refresh Token** (최대 7일 유효)

환경변수에 저장:
```bash
FLEX_REFRESH_TOKEN=your_refresh_token_here
```

### 2. Access Token 자동 재발급

**tokenManager.ts의 동작 방식:**

```typescript
import axios from 'axios';

let cachedAccessToken: string | null = null;
let cachedExpiresAt: number = 0;

export async function getFlexAccessToken(): Promise<string> {
  const now = Date.now();

  // 캐시된 토큰이 30초 이상 유효하면 재사용
  if (cachedAccessToken && now < cachedExpiresAt - 30000) {
    return cachedAccessToken;
  }

  // Access Token 재발급
  const response = await axios.post(process.env.FLEX_TOKEN_URL!, {
    grant_type: 'refresh_token',
    refresh_token: process.env.FLEX_REFRESH_TOKEN!,
  });

  cachedAccessToken = response.data.access_token;
  cachedExpiresAt = now + (response.data.expires_in * 1000);

  return cachedAccessToken;
}
```

### 3. 환경 변수 설정

**필수 환경 변수:**

```bash
# Flex API Base URL
FLEX_API_BASE=https://api.flex.team

# Flex Token URL
FLEX_TOKEN_URL=https://api.flex.team/oauth/token

# Flex Refresh Token (최대 7일 유효)
FLEX_REFRESH_TOKEN=your_refresh_token_here
```

**❌ 사용하지 않는 환경 변수:**

```bash
# 다음 변수들은 필요 없습니다!
FLEX_CLIENT_ID          # 삭제
FLEX_CLIENT_SECRET      # 삭제
FLEX_ACCESS_TOKEN       # 삭제 (자동 재발급)
```

### 4. API 호출 방법

**모든 Flex API 호출:**

```typescript
import { getFlexAccessToken } from './tokenManager';

// Access Token 자동 획득 및 API 호출
const token = await getFlexAccessToken();

const response = await axios.get('https://api.flex.team/api/v1/employees', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
});
```

**flexClient.ts에서는 인터셉터로 자동 처리:**

```typescript
this.client.interceptors.request.use(
  async (config) => {
    const token = await getFlexAccessToken();
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  }
);
```

## 토큰 관리 전략

### Access Token
- **유효 기간**: 최대 10분
- **저장 위치**: 메모리 (캐시)
- **재발급**: 만료 30초 전 자동
- **환경변수 저장**: ❌ 하지 않음

### Refresh Token
- **유효 기간**: 최대 7일
- **저장 위치**: Azure Key Vault / App Settings
- **재발급**: 수동 (Flex 콘솔에서)
- **환경변수 저장**: ✅ 필수

### 만료 경고
- Refresh Token 만료 2일 전 CEO에게 이메일 경고
- `REFRESH_TOKEN_WARNING_DAYS=2` 환경변수로 설정 가능

## 보안 권장 사항

1. **Refresh Token 보호**
   - `.env` 파일을 절대 Git에 커밋하지 마세요
   - `.gitignore`에 `.env`가 포함되어 있는지 확인
   - Azure Key Vault 사용 권장

2. **Access Token**
   - 환경변수에 저장하지 마세요
   - 메모리에만 캐시
   - 파일 시스템에 저장하지 마세요

3. **로깅**
   - 토큰 값을 로그에 출력하지 마세요
   - 에러 메시지에서 토큰 값 제거

## 문제 해결

### Access Token 재발급 실패

**증상:**
```
[TokenManager] Access Token 재발급 실패
```

**해결:**
1. `FLEX_REFRESH_TOKEN`이 올바른지 확인
2. `FLEX_TOKEN_URL`이 `https://api.flex.team/oauth/token`인지 확인
3. Refresh Token이 만료되지 않았는지 확인 (7일)
4. Flex 콘솔에서 새 Refresh Token 발급

### Refresh Token 만료

**증상:**
```
[CheckCheckIn] ⚠️ Refresh Token 만료 임박: 1일 남음
```

**해결:**
1. Flex 콘솔에 로그인
2. 새 Refresh Token 발급
3. 환경변수 업데이트:
   ```bash
   az functionapp config appsettings set \
     --name func-flex-attendance \
     --resource-group rg-flex-attendance \
     --settings "FLEX_REFRESH_TOKEN=new_refresh_token"
   ```
4. Function App 재시작 (선택 사항)

## 참고 자료

- [Flex API 공식 문서](https://developers.flex.team)
- [프로젝트 README](./README.md)
- [API 명세](./APIS.md)
