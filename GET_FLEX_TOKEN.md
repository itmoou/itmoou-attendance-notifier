# Flex Refresh Token 발급 가이드

## 🔑 Option 1: 개인 계정으로 발급 (테스트용)

### 배포 후 API 엔드포인트 사용

```bash
curl -X POST https://itmoou-attendance-func-ate3csagf3c4hyas.koreacentral-01.azurewebsites.net/api/init-flex-token \
  -H "Content-Type: application/json" \
  -d '{
    "username": "ymsim@itmoou.com",
    "password": "여기에_Flex_로그인_비밀번호"
  }'
```

**주의**: 개인 계정은 본인의 근태 데이터만 조회 가능할 수 있습니다.
조직 전체 데이터 접근을 위해서는 관리자 계정 필요.

### 직접 Flex API 호출 (배포 전에도 가능)

```bash
# Windows PowerShell
$body = @{
    grant_type = "password"
    username = "ymsim@itmoou.com"
    password = "여기에_비밀번호"
    client_id = "open-api"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://openapi.flex.team/v2/auth/realms/open-api/protocol/openid-connect/token" `
  -Method Post `
  -ContentType "application/x-www-form-urlencoded" `
  -Body "grant_type=password&username=ymsim@itmoou.com&password=여기에_비밀번호&client_id=open-api"
```

```bash
# Linux/Mac/WSL
curl -X POST https://openapi.flex.team/v2/auth/realms/open-api/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&username=ymsim@itmoou.com&password=여기에_비밀번호&client_id=open-api"
```

**응답 예시:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1Q...",
  "refresh_token": "eyJ0eXAiOiJKV1Q...",  ← 이 값을 사용
  "expires_in": 600,
  "refresh_expires_in": 604800
}
```

---

## 🔑 Option 2: Flex 관리자 페이지에서 발급 (권장)

1. Flex 웹사이트 로그인 (관리자 계정)
2. 설정 → API 관리 메뉴
3. API Token 발급 또는 기존 토큰 확인
4. 발급된 Refresh Token 복사

**장점**: 조직 전체 데이터 접근 권한

---

## 🔄 발급 후 저장 방법

### A. Storage에 저장 (권장 - 자동 갱신)

```bash
curl -X POST https://itmoou-attendance-func-ate3csagf3c4hyas.koreacentral-01.azurewebsites.net/api/init-flex-token \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "여기에_발급받은_refresh_token"
  }'
```

### B. Azure 환경변수에 저장 (선택)

1. Azure Portal → Function App
2. Settings → Environment variables
3. `FLEX_REFRESH_TOKEN` 추가 또는 업데이트
4. Save → Restart

**참고**: Storage 방식을 사용하면 환경변수 업데이트 불필요 (자동 갱신됨)

---

## ✅ 확인 방법

```bash
# Storage에 저장된 토큰 확인
curl https://itmoou-attendance-func-ate3csagf3c4hyas.koreacentral-01.azurewebsites.net/api/init-flex-token

# 응답 예시:
# {
#   "stored": true,
#   "updatedAt": "2026-02-14T12:00:00Z",
#   "updatedBy": "manual"
# }
```

---

## 🚨 문제 해결

### 401 Unauthorized
- 비밀번호가 틀렸거나 계정이 잠김
- Flex 로그인 페이지에서 직접 로그인 테스트

### 403 Forbidden
- 권한 부족 (조직 데이터 접근 불가)
- 관리자 계정으로 시도 필요

### Network Error
- Flex API가 일시적으로 다운
- 잠시 후 재시도
