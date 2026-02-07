# Flex Webhook 연동 가이드

## 개요

Flex에서 **휴가가 승인**되면 자동으로 다음 작업이 수행됩니다:
- ✅ Teams 개인 DM으로 휴가 승인 알림 발송
- ✅ Outlook 개인 캘린더에 휴가 일정 등록
- ✅ HR 팀 공유 캘린더에 휴가 일정 등록

---

## 1️⃣ Webhook URL 확인

### Function Key 획득 방법

1. **Azure Portal** 접속: https://portal.azure.com
2. **Function App** → `itmoou-attendance-func`
3. **Functions** → `vacationApproved`
4. **Function Keys** 탭 → `default` 키 값 복사

### Webhook URL 형식

```
https://itmoou-attendance-func.azurewebsites.net/api/vacation/approved?code={FUNCTION_KEY}
```

**실제 사용 예시:**
```
https://itmoou-attendance-func.azurewebsites.net/api/vacation/approved?code=ABC123XYZ456...
```

---

## 2️⃣ Flex에서 Webhook 설정

### 설정 방법 (Flex Admin Panel)

Flex 관리자 페이지에서 다음과 같이 설정합니다:

#### 기본 설정
- **이벤트 트리거**: 휴가 승인 완료 시
- **Webhook URL**: `https://itmoou-attendance-func.azurewebsites.net/api/vacation/approved?code={키값}`
- **HTTP Method**: `POST`
- **Content-Type**: `application/json`

#### 요청 본문 (Request Body)

Flex에서 다음 형식의 JSON을 전송하도록 설정:

```json
{
  "employeeNumber": "{{직원사원번호}}",
  "employeeName": "{{직원이름}}",
  "employeeEmail": "{{직원이메일}}",
  "vacationType": "{{휴가종류}}",
  "startDate": "{{시작일자}}",
  "endDate": "{{종료일자}}",
  "reason": "{{휴가사유}}"
}

```

**실제 데이터 예시:**
```json
{
  "employeeNumber": "240101",
  "employeeName": "심영민",
  "employeeEmail": "ymsim@itmoou.com",
  "vacationType": "연차",
  "startDate": "2024-02-15",
  "endDate": "2024-02-16",
  "reason": "개인 휴가"
}
```

#### 필드 설명

| 필드 | 필수 여부 | 설명 | 예시 |
|------|----------|------|------|
| `employeeNumber` | ✅ 필수 | 직원 사원번호 | `"240101"` |
| `employeeName` | ✅ 필수 | 직원 이름 | `"심영민"` |
| `employeeEmail` | ✅ 필수 | 직원 이메일 (Microsoft 365) | `"ymsim@itmoou.com"` |
| `vacationType` | ✅ 필수 | 휴가 종류 | `"연차"`, `"반차"`, `"병가"` |
| `startDate` | ✅ 필수 | 휴가 시작일 (YYYY-MM-DD) | `"2024-02-15"` |
| `endDate` | ✅ 필수 | 휴가 종료일 (YYYY-MM-DD) | `"2024-02-16"` |
| `reason` | ⚪ 선택 | 휴가 사유 | `"개인 휴가"` |

---

## 3️⃣ 테스트 방법

### 수동 테스트 (Postman / curl)

#### curl 예시

```bash
curl -X POST "https://itmoou-attendance-func.azurewebsites.net/api/vacation/approved?code={FUNCTION_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeNumber": "240101",
    "employeeName": "심영민",
    "employeeEmail": "ymsim@itmoou.com",
    "vacationType": "연차",
    "startDate": "2024-02-15",
    "endDate": "2024-02-16",
    "reason": "테스트용 휴가"
  }'
```

#### 성공 응답 예시

```json
{
  "success": true,
  "message": "휴가 승인 처리 완료",
  "data": {
    "employeeName": "심영민",
    "vacationType": "연차",
    "period": "2024-02-15 ~ 2024-02-16",
    "personalCalendar": true,
    "teamCalendar": true,
    "teamsNotification": true
  }
}
```

### 실제 동작 확인

1. **Teams 알림 확인**
   - 직원의 Teams 개인 채팅에서 봇으로부터 알림 수신 확인

2. **Outlook 개인 캘린더 확인**
   - https://outlook.office.com → 캘린더
   - 휴가 기간에 `[휴가] 심영민 - 연차` 일정 확인
   - 속성: 종일 이벤트, Out of Office, 카테고리: 휴가/연차

3. **HR 팀 캘린더 확인**
   - HR 계정(`hr@itmoou.com`)의 Outlook 캘린더
   - 동일한 휴가 일정 등록 확인

---

## 4️⃣ Flex Admin 설정 예시

### 옵션 1: Flex Admin Panel에서 직접 설정

Flex 관리자 페이지 → Webhook 설정 메뉴에서:
- 이벤트: **휴가 승인 완료**
- URL: `https://itmoou-attendance-func.azurewebsites.net/api/vacation/approved?code={키}`
- Method: `POST`
- Headers: `Content-Type: application/json`
- Body Template: 위 JSON 형식 참고

### 옵션 2: Flex 담당자에게 전달

Flex API 담당자에게 다음 정보를 전달:

```
# Flex 휴가 승인 Webhook 설정 요청

**Webhook URL:**
https://itmoou-attendance-func.azurewebsites.net/api/vacation/approved?code={FUNCTION_KEY}

**트리거 이벤트:**
휴가 승인 완료 시

**HTTP Method:**
POST

**Content-Type:**
application/json

**Request Body 형식:**
{
  "employeeNumber": "직원사원번호",
  "employeeName": "직원이름",
  "employeeEmail": "직원이메일@itmoou.com",
  "vacationType": "연차/반차/병가",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "reason": "휴가사유(선택)"
}
```

---

## 5️⃣ 문제 해결 (Troubleshooting)

### Webhook 호출 실패

**증상:** Flex에서 Webhook 호출 시 오류 발생

**해결 방법:**
1. Function Key가 올바른지 확인
2. Azure Function App이 실행 중인지 확인
3. Azure Portal → Log stream에서 에러 로그 확인

### 캘린더 생성 실패

**증상:** `personalCalendar: false` 또는 `teamCalendar: false`

**원인 및 해결:**
- ❌ **직원 이메일이 Microsoft 365에 존재하지 않음**
  - → 실제 존재하는 이메일로 테스트
- ❌ **Graph API 권한 부족**
  - → Azure Portal → App registrations → API permissions 확인
  - → `Calendars.ReadWrite` (Application) 권한 확인
  - → `Grant admin consent` 상태 확인

### Teams 알림 실패

**증상:** `teamsNotification: false`

**원인 및 해결:**
- ❌ **직원이 Teams Bot에 먼저 메시지를 보내지 않음**
  - → Teams에서 Bot 추가 후 아무 메시지나 먼저 전송
  - → 이후 Webhook 재테스트

---

## 6️⃣ 로그 모니터링

### 실시간 로그 확인

**Azure Portal:**
1. Function App → `itmoou-attendance-func`
2. **Log stream** 메뉴
3. 실시간 로그 확인

### Application Insights 쿼리

```kusto
traces
| where timestamp > ago(1h)
| where message contains "VacationApproved"
| order by timestamp desc
| take 100
```

---

## 7️⃣ 운영 체크리스트

- [ ] Azure Function Key 확보
- [ ] Flex Webhook URL 설정 완료
- [ ] 테스트 휴가 승인으로 동작 확인
- [ ] Teams 알림 수신 확인
- [ ] Outlook 개인 캘린더 일정 확인
- [ ] HR 팀 캘린더 일정 확인
- [ ] Log stream에서 에러 없음 확인

---

## 8️⃣ 관련 문서

- [Phase 2 가이드](./PHASE2_GUIDE.md)
- [API 명세](./APIS.md)
- [README](./README.md)

---

## 문의

- 시스템 문제: Azure Portal Log stream 확인
- Flex 연동 문제: Flex API 담당자 문의
- Graph API 권한 문제: Microsoft 365 관리자 문의

**배포 완료일:** 2024-02-07
