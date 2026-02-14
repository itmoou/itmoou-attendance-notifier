# 환경변수 가이드

## 🔑 Flex API 관련

### 필수
| 변수명 | 설명 | 예시 | 현재 값 |
|--------|------|------|---------|
| `FLEX_REFRESH_TOKEN` | Flex API Refresh Token (7일 유효) | `eyJ0eXAiOiJKV1Q...` | ✅ 설정됨 |

### 선택 (기본값 있음)
| 변수명 | 설명 | 기본값 | 필요 여부 |
|--------|------|--------|----------|
| `FLEX_API_BASE` | Flex API Base URL | `https://openapi.flex.team/v2` | ❌ 선택 |
| `FLEX_TOKEN_URL` | Token 발급 URL | `https://openapi.flex.team/v2/auth/realms/open-api/protocol/openid-connect/token` | ❌ 선택 |

### 사용 안 함
| 변수명 | 설명 | 이유 |
|--------|------|------|
| `FLEX_CLIENT_ID` | Client ID | Refresh Token 방식에서는 `open-api` 고정값 사용 |
| `FLEX_CLIENT_SECRET` | Client Secret | 현재 인증 방식에서 불필요 |
| `FLEX_API_KEY` | API Key | 사용하지 않음 |

---

## 🤖 Bot 관련

### 근태알림 봇
| 변수명 | 설명 | 현재 값 |
|--------|------|---------|
| `BOT_APP_ID` | Bot Application ID | ✅ 설정됨 |
| `BOT_APP_PASSWORD` | Bot Password | ✅ 설정됨 |
| `BOT_TENANT_ID` | Tenant ID (Single Tenant) | ✅ 설정됨 |

### HR 봇
| 변수명 | 설명 | 현재 값 |
|--------|------|---------|
| `HR_BOT_APP_ID` | HR Bot Application ID | ✅ 설정됨 |
| `HR_BOT_APP_PASSWORD` | HR Bot Password | ✅ 설정됨 |
| `HR_BOT_TENANT_ID` | Tenant ID | ✅ 설정됨 |

### 일정관리 봇 (NEW)
| 변수명 | 설명 | 현재 값 |
|--------|------|---------|
| `MICROSOFT_APP_ID` | Calendar Bot Application ID | `61a8f2d7-05ee-48a5-b206-b4f0b740863d` |
| `MICROSOFT_APP_PASSWORD` | Calendar Bot Password | ✅ 설정됨 |
| `MICROSOFT_APP_TENANT_ID` | Tenant ID | ✅ 설정됨 |

---

## 📊 Microsoft Graph API

### Graph API 인증
| 변수명 | 설명 | Fallback | 현재 값 |
|--------|------|----------|---------|
| `AZURE_CLIENT_ID` | Graph App ID | `BOT_APP_ID` | ✅ 설정됨 |
| `AZURE_CLIENT_SECRET` | Graph Secret | `BOT_APP_PASSWORD` | ✅ 설정됨 |
| `AZURE_TENANT_ID` | Tenant ID | `BOT_TENANT_ID` | ✅ 설정됨 |

**참고:** Graph API는 Bot 인증을 fallback으로 사용합니다.

---

## 💾 Storage

| 변수명 | 설명 | 현재 값 |
|--------|------|---------|
| `AZURE_STORAGE_CONNECTION_STRING` | Azure Storage 연결 문자열 | ✅ 설정됨 |

**사용 용도:**
- EmployeeMap (사원 매핑)
- NotifyState (중복 방지)
- TeamsConversation (봇 대화 참조)
- FlexTokenCache (Refresh Token 자동 관리) ← **NEW**

---

## 🌐 기타

| 변수명 | 설명 | 현재 값 |
|--------|------|---------|
| `TZ` | 타임존 | `Asia/Seoul` ✅ |
| `GRAPH_API_BASE_URL` | Graph API Base URL | `https://graph.microsoft.com/v1.0` (기본값) |

---

## 🔄 Refresh Token 관리

### 이전 방식 (수동)
```
1. Access Token 발급 시 새 Refresh Token 받음
2. 로그에서 경고 출력
3. 수동으로 환경변수 업데이트
4. Function App 재시작
```

### 새로운 방식 (자동) ⭐
```
1. Access Token 발급 시 새 Refresh Token 받음
2. 자동으로 Storage에 저장
3. 다음 호출부터 Storage의 최신 토큰 사용
4. Function App 재시작 불필요
```

### 자동 갱신 (NEW)
```
Timer: 6일마다 실행 (refreshFlexToken)
→ Access Token 발급 시도
→ 새 Refresh Token 자동 수령 및 저장
→ 만료 방지
```

---

## 📝 초기 설정 방법

### Flex Refresh Token 발급

**방법 1: 개인 계정으로 테스트**
```bash
curl -X POST https://itmoou-attendance-func-ate3csagf3c4hyas.koreacentral-01.azurewebsites.net/api/init-flex-token \
  -H "Content-Type: application/json" \
  -d '{
    "username": "ymsim@itmoou.com",
    "password": "YOUR_PASSWORD"
  }'
```

**방법 2: 관리자 계정 사용 (권장)**
- Flex 관리자 페이지에서 API 토큰 발급
- 조직 전체 데이터 접근 권한 필요

**결과:**
- 성공 시: Refresh Token이 Storage에 자동 저장
- 실패 시: 권한 부족 또는 잘못된 인증 정보

---

## 🚨 주의사항

### Refresh Token 보안
- ⚠️ Git에 커밋하지 마세요
- ⚠️ 로그에 전체 값 출력하지 마세요
- ✅ Storage에 암호화되어 저장됨
- ✅ 환경변수는 Azure에서 암호화 관리

### 권한
- Flex API: 조직 전체 근태 데이터 조회 권한 필요
- Graph API: Calendars.Read, User.Read.All 권한 필요
- Bot: Teams 메시지 전송 권한 필요

---

## 🔍 문제 해결

### Flex API 401 에러
```
원인: Refresh Token 만료 또는 무효화
해결: 새 Refresh Token 발급
```

### Storage 접근 실패
```
원인: AZURE_STORAGE_CONNECTION_STRING 없음
해결: 환경변수 확인 및 추가
```

### Bot 메시지 전송 실패
```
원인: Conversation Reference 없음
해결: 사용자가 봇과 대화 시작 필요
```

---

## 📊 환경변수 체크리스트

배포 전 확인:
- [ ] `FLEX_REFRESH_TOKEN` 설정
- [ ] `BOT_APP_ID`, `BOT_APP_PASSWORD`, `BOT_TENANT_ID` 설정
- [ ] `AZURE_STORAGE_CONNECTION_STRING` 설정
- [ ] `TZ=Asia/Seoul` 설정
- [ ] Graph API 권한 부여 완료
- [ ] Bot Service Teams 채널 활성화
