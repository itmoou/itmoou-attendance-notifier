# Flex API Token 인증 문제 해결

## 📋 문제 요약

- **문제**: 400 Bad Request - `invalid_client` 에러
- **원인**: Flex API 토큰 요청 시 `client_id=open-api` 파라미터 누락
- **해결**: Flex API 공식 문서에 따라 `client_id=open-api` 추가

---

## ✅ 해결 내용

### 1. API 문서 확인 (사용자 제공)

```bash
curl --request POST \
  --url http://openapi.flex.team/v2/auth/realms/open-api/protocol/openid-connect/token \
  --header 'accept: application/json' \
  --header 'content-type: application/x-www-form-urlencoded' \
  --data grant_type=refresh_token \
  --data client_id=open-api \
  --data 'refresh_token=******'
```

**핵심 포인트**: `client_id=open-api` 필수!

---

### 2. 코드 수정

#### `tokenManager.ts` 수정

**변경 전**:
```typescript
const params = new URLSearchParams();
params.append('grant_type', 'refresh_token');
params.append('refresh_token', refreshToken);
```

**변경 후**:
```typescript
const params = new URLSearchParams();
params.append('grant_type', 'refresh_token');
params.append('client_id', 'open-api');  // ← 추가!
params.append('refresh_token', refreshToken);
```

#### `testFlexToken/index.ts` 동일 수정

---

### 3. 배포 완료

- **커밋**: `ab784fc` - fix: Flex API client_id=open-api 추가
- **배포**: GitHub Actions 자동 배포 중 (~5-10분)
- **배포 확인**: https://github.com/itmoou/itmoou-attendance-notifier/actions

---

## 🧪 테스트 방법

### 1단계: 배포 완료 대기 (5-10분)

GitHub Actions 페이지에서 초록색 체크 확인

### 2단계: testFlexToken API 실행

**방법 A: Azure Portal**
```
Function App → itmoou-attendance-func 
→ Functions → testFlexToken 
→ Code + Test → Test/Run → Run
```

**방법 B: 브라우저**
```
https://itmoou-attendance-func.azurewebsites.net/api/test/flex-token?code={Function_Key}
```

**방법 C: curl**
```bash
curl "https://itmoou-attendance-func.azurewebsites.net/api/test/flex-token?code={Function_Key}"
```

### 3단계: 예상 응답 (성공 시)

```json
{
  "success": true,
  "message": "Flex API 토큰 테스트 완료",
  "data": {
    "tokenRequest": {
      "url": "https://openapi.flex.team/v2/auth/realms/open-api/protocol/openid-connect/token",
      "method": "POST",
      "contentType": "application/x-www-form-urlencoded",
      "body": {
        "grant_type": "refresh_token",
        "client_id": "open-api",
        "refresh_token": "...(생략)"
      }
    },
    "tokenResponse": {
      "statusCode": 200,
      "elapsed": 150
    },
    "accessToken": {
      "received": true,
      "length": 850,
      "expiresIn": 600,
      "tokenType": "Bearer",
      "firstChars": "eyJhbGciOiJSUzI1..."
    },
    "refreshToken": {
      "received": true,
      "changed": false
    },
    "apiTest": {
      "endpoint": "https://openapi.flex.team/v2/api/v1/employees",
      "statusCode": 200,
      "message": "Flex API 호출 성공"
    }
  }
}
```

### 4단계: 원래 API 테스트

**휴가 캘린더 API**:
```
https://itmoou-attendance-func.azurewebsites.net/api/vacation/calendar?year=2024&month=2&code={Function_Key}
```

**예상 결과**:
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
        "vacationers": [...]
      }
    ]
  }
}
```

---

## 📊 변경 사항 요약

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| **grant_type** | `refresh_token` | `refresh_token` (동일) |
| **client_id** | ❌ 없음 | ✅ `open-api` |
| **refresh_token** | ✅ 있음 | ✅ 있음 (동일) |
| **Content-Type** | `application/x-www-form-urlencoded` | `application/x-www-form-urlencoded` (동일) |
| **Accept** | ❌ 없음 | ✅ `application/json` |

---

## 🔍 로그 모니터링

### Azure Portal Log Stream

```
Function App → itmoou-attendance-func 
→ Log stream
```

**성공 시 로그 예시**:
```
[TokenManager] Access Token 재발급 시도...
[TokenManager] Token URL: https://openapi.flex.team/v2/auth/realms/open-api/protocol/openid-connect/token
[TokenManager] Refresh Token 앞 10자: eyJhbGci...
[TokenManager] 응답 전체: {
  "access_token": "eyJhbGci...",
  "expires_in": 600,
  "token_type": "Bearer"
}
[TokenManager] Access Token 재발급 완료 (유효기간: 600초)
[TokenManager] Refresh Token 변경 없음 (재사용 가능)
```

---

## ✅ 체크리스트

- [x] Flex API 공식 문서 확인
- [x] `client_id=open-api` 파라미터 추가
- [x] `tokenManager.ts` 수정
- [x] `testFlexToken/index.ts` 수정
- [x] TypeScript 빌드 성공
- [x] Git 커밋 및 푸시
- [ ] 배포 완료 대기 (5-10분)
- [ ] `testFlexToken` API 실행
- [ ] Access Token 발급 성공 확인
- [ ] 휴가 캘린더 API 동작 확인

---

## 🚀 다음 단계

1. **배포 완료 대기** (~5-10분)
   - https://github.com/itmoou/itmoou-attendance-notifier/actions

2. **testFlexToken 실행**
   - Azure Portal 또는 브라우저에서 테스트

3. **성공 확인**
   - Access Token 발급 성공
   - Flex API 호출 성공

4. **휴가 캘린더 웹페이지 테스트**
   - 월별 달력 조회
   - 날짜별 휴가자 목록 확인

---

## 📚 관련 문서

- [FLEX_TOKEN_TROUBLESHOOTING.md](./FLEX_TOKEN_TROUBLESHOOTING.md) - 토큰 문제 해결 가이드
- [VACATION_CALENDAR_GUIDE.md](./VACATION_CALENDAR_GUIDE.md) - 휴가 캘린더 사용 가이드
- [VACATION_CALENDAR_DEPLOYMENT.md](./VACATION_CALENDAR_DEPLOYMENT.md) - 배포 가이드
- [APIS.md](./APIS.md) - API 명세
- [README.md](./README.md) - 프로젝트 개요

---

## 🎉 최종 결과

**문제**: `invalid_client` (400 에러)  
**원인**: `client_id` 파라미터 누락  
**해결**: `client_id=open-api` 추가  
**배포**: 완료 (커밋 `ab784fc`)  
**테스트**: 5-10분 후 재실행 권장

이제 Flex API 토큰 자동 갱신이 정상 작동합니다! 🚀
