# API 명세서

## Flex OpenAPI 엔드포인트

이 문서는 시스템에서 사용하는 Flex OpenAPI 엔드포인트의 상세 명세를 제공합니다.

⚠️ **중요**: 
- Flex API Base URL: `https://api.flex.team`
- Flex Token URL: `https://api.flex.team/oauth/token`

---

## 인증

### Flex OpenAPI 인증 방식

⚠️ **중요**: Flex OpenAPI는 Client ID/Secret을 사용하지 않습니다!

### Access Token 획득

**Endpoint:**
```http
POST https://api.flex.team/oauth/token
```

**Headers:**
```
Content-Type: application/x-www-form-urlencoded
```

**Request Body:** (form-urlencoded)
```
grant_type=refresh_token&refresh_token=your_refresh_token
```

**또는 application/json 형식으로 보낼 경우:**
```json
{
  "grant_type": "refresh_token",
  "refresh_token": "your_refresh_token"
}
```

**⚠️ 중요:** Flex API는 **application/x-www-form-urlencoded** 형식을 권장합니다.

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 600,
  "token_type": "Bearer"
}
```

**토큰 관리:**
- Refresh Token: 최대 7일 유효 (환경변수에 저장)
- Access Token: 최대 10분 유효 (자동 재발급, 메모리 캐시)
- Access Token 만료 30초 전 자동 재발급

---

## 직원 관리

### 전체 직원 목록 조회

**Endpoint:**
```http
GET https://api.flex.team/api/v1/employees
```

**Headers:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Query Parameters:**
- `active` (optional): `true` - 활성 직원만 조회
- `department` (optional): 부서별 필터링

**Response:**
```json
{
  "employees": [
    {
      "id": "emp001",
      "name": "홍길동",
      "email": "hong@example.com",
      "department": "개발팀",
      "position": "시니어 개발자",
      "teamsUserId": "29:1a2b3c4d5e6f...",
      "active": true
    },
    {
      "id": "emp002",
      "name": "김철수",
      "email": "kim@example.com",
      "department": "디자인팀",
      "position": "디자이너",
      "teamsUserId": "29:9z8y7x6w5v4u...",
      "active": true
    }
  ],
  "total": 2
}
```

---

## 근태 관리

### 개별 직원 근태 기록 조회

**Endpoint:**
```http
GET https://api.flex.team/api/v1/attendance/{employeeId}
```

**Headers:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Path Parameters:**
- `employeeId`: 직원 ID

**Query Parameters:**
- `date` (required): 조회 날짜 (YYYY-MM-DD 형식)

**Example Request:**
```http
GET https://api.flex.team/api/v1/attendance/emp001?date=2024-02-04
```

**Response (출근/퇴근 모두 체크됨):**
```json
{
  "attendance": {
    "employeeId": "emp001",
    "date": "2024-02-04",
    "checkInTime": "09:15:30",
    "checkOutTime": "18:45:20",
    "status": "present",
    "workHours": "09:29:50"
  }
}
```

**Response (출근만 체크됨):**
```json
{
  "attendance": {
    "employeeId": "emp001",
    "date": "2024-02-04",
    "checkInTime": "09:15:30",
    "checkOutTime": null,
    "status": "present",
    "workHours": null
  }
}
```

**Response (기록 없음):**
```json
{
  "attendance": null
}
```
또는
```http
404 Not Found
```

---

### 여러 직원 근태 기록 일괄 조회

**Endpoint:**
```http
POST https://api.flex.team/api/v1/attendance/batch
```

**Headers:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "employeeIds": ["emp001", "emp002", "emp003"],
  "date": "2024-02-04"
}
```

**Response:**
```json
{
  "attendances": [
    {
      "employeeId": "emp001",
      "date": "2024-02-04",
      "checkInTime": "09:15:30",
      "checkOutTime": "18:45:20",
      "status": "present"
    },
    {
      "employeeId": "emp002",
      "date": "2024-02-04",
      "checkInTime": "10:00:00",
      "checkOutTime": null,
      "status": "present"
    }
  ],
  "total": 2
}
```

---

### 날짜 범위별 근태 기록 조회

**Endpoint:**
```http
GET https://api.flex.team/api/v1/attendance/range
```

**Headers:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Query Parameters:**
- `startDate` (required): 시작 날짜 (YYYY-MM-DD)
- `endDate` (required): 종료 날짜 (YYYY-MM-DD)
- `employeeId` (optional): 특정 직원 필터링

**Example Request:**
```http
GET https://api.flex.team/api/v1/attendance/range?startDate=2024-02-01&endDate=2024-02-07
```

**Response:**
```json
{
  "attendances": [
    {
      "employeeId": "emp001",
      "date": "2024-02-01",
      "checkInTime": "09:00:00",
      "checkOutTime": "18:00:00",
      "status": "present"
    },
    {
      "employeeId": "emp001",
      "date": "2024-02-02",
      "checkInTime": null,
      "checkOutTime": null,
      "status": "vacation"
    }
  ],
  "total": 2
}
```

---

## 휴가 관리

### 특정 날짜의 휴가자 목록 조회

**Endpoint:**
```http
GET https://api.flex.team/api/v1/vacations
```

**Headers:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Query Parameters:**
- `date` (required): 조회 날짜 (YYYY-MM-DD)

**Example Request:**
```http
GET https://api.flex.team/api/v1/vacations?date=2024-02-04
```

**Response:**
```json
{
  "vacations": [
    {
      "employeeId": "emp002",
      "employeeName": "김철수",
      "startDate": "2024-02-04",
      "endDate": "2024-02-05",
      "type": "annual",
      "reason": "개인 휴가",
      "status": "approved"
    },
    {
      "employeeId": "emp005",
      "employeeName": "이영희",
      "startDate": "2024-02-03",
      "endDate": "2024-02-07",
      "type": "sick",
      "reason": "병가",
      "status": "approved"
    }
  ],
  "total": 2
}
```

**휴가 타입:**
- `annual`: 연차
- `sick`: 병가
- `other`: 기타

---

## Microsoft Graph API

시스템에서 사용하는 Microsoft Graph API 엔드포인트입니다.

### Teams DM 전송

**1. 1:1 채팅 생성/조회**

```http
GET https://graph.microsoft.com/v1.0/chats
  ?$filter=chatType eq 'oneOnOne'
  &$expand=members
Authorization: Bearer {azure_access_token}
```

**2. 새 1:1 채팅 생성**

```http
POST https://graph.microsoft.com/v1.0/chats
Authorization: Bearer {azure_access_token}
Content-Type: application/json

{
  "chatType": "oneOnOne",
  "members": [
    {
      "@odata.type": "#microsoft.graph.aadUserConversationMember",
      "roles": ["owner"],
      "user@odata.bind": "https://graph.microsoft.com/v1.0/users/{userId}"
    }
  ]
}
```

**3. 메시지 전송**

```http
POST https://graph.microsoft.com/v1.0/chats/{chatId}/messages
Authorization: Bearer {azure_access_token}
Content-Type: application/json

{
  "body": {
    "contentType": "html",
    "content": "<div>알림 메시지 내용</div>"
  }
}
```

---

### Outlook 이메일 전송

```http
POST https://graph.microsoft.com/v1.0/users/{fromEmail}/sendMail
Authorization: Bearer {azure_access_token}
Content-Type: application/json

{
  "message": {
    "subject": "근태 리포트",
    "body": {
      "contentType": "HTML",
      "content": "<html>...</html>"
    },
    "toRecipients": [
      {
        "emailAddress": {
          "address": "hr@itmoou.com"
        }
      }
    ]
  },
  "saveToSentItems": true
}
```

---

## 에러 코드

### Flex API 에러 코드

| 코드 | 의미 | 해결 방법 |
|------|------|----------|
| 401 | 인증 실패 | Access Token 갱신 |
| 403 | 권한 없음 | API 권한 확인 |
| 404 | 리소스 없음 | 요청 파라미터 확인 |
| 429 | Rate Limit 초과 | 요청 빈도 감소 |
| 500 | 서버 오류 | 재시도 또는 관리자 문의 |

### Microsoft Graph API 에러 코드

| 코드 | 의미 | 해결 방법 |
|------|------|----------|
| 401 | 인증 실패 | Azure AD Token 갱신 |
| 403 | 권한 없음 | Admin Consent 확인 |
| 404 | 사용자/채팅 없음 | User ID 확인 |
| 429 | Throttling | 요청 간격 증가 |

---

## 테스트

### cURL 예제

**1. Flex API - 직원 목록 조회**
```bash
curl -X GET \
  "$https://api.flex.team/api/v1/employees" \
  -H "Authorization: Bearer ${FLEX_ACCESS_TOKEN}" \
  -H "Content-Type: application/json"
```

**2. Flex API - 근태 기록 조회**
```bash
curl -X GET \
  "$https://api.flex.team/api/v1/attendance/emp001?date=2024-02-04" \
  -H "Authorization: Bearer ${FLEX_ACCESS_TOKEN}" \
  -H "Content-Type: application/json"
```

**3. Graph API - Teams 메시지 전송 (테스트)**
```bash
curl -X POST \
  "https://graph.microsoft.com/v1.0/chats/${CHAT_ID}/messages" \
  -H "Authorization: Bearer ${AZURE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "body": {
      "contentType": "html",
      "content": "<div>테스트 메시지</div>"
    }
  }'
```

---

## 참고 문서

- [Flex OpenAPI 공식 문서](https://flex-docs.example.com)
- [Microsoft Graph API 문서](https://learn.microsoft.com/graph/)
- [Azure Functions Timer Trigger](https://learn.microsoft.com/azure/azure-functions/functions-bindings-timer)
