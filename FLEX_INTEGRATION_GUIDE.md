# Flex 휴가 관리 연동 가이드

## ⚠️ 중요: Flex는 Webhook을 지원하지 않습니다

**조사 결과:**
- Flex OpenAPI는 **폴링(Polling) 방식**만 지원합니다
- Webhook 이벤트 알림 기능은 **제공되지 않습니다**
- Flex API 키만 발급되며, 주기적으로 API를 호출해야 합니다

---

## 현재 구현된 방식

### 1️⃣ 폴링 기반 휴가 데이터 조회

**Flex OpenAPI 엔드포인트:**
```http
GET https://openapi.flex.team/v2/users/time-off-uses/dates/{date}
```

**구현 파일:**
- `apps/api/shared/flexClient.ts` - Flex API 클라이언트
- `apps/api/timers/vacationAnnouncement/index.ts` - 매일 09:00 휴가 현황 공지
- `apps/api/timers/vacationReminder/index.ts` - 매일 18:00 휴가 리마인더

### 2️⃣ 자동화 타이머 함수

| 함수 | 실행 시간 | 기능 | 방식 |
|------|----------|------|------|
| **vacationAnnouncement** | 매일 09:00 (평일) | 오늘 휴가자 Teams 공지 + HR 이메일 | Flex API 폴링 |
| **vacationReminder** | 매일 18:00 (평일) | 내일 휴가 시작/복귀 리마인더 | Flex API 폴링 |

---

## 휴가 승인 시 실시간 알림 구현 방법

Flex가 Webhook을 지원하지 않으므로, 다음 2가지 방법으로 구현할 수 있습니다:

### 방법 1: Flex API 짧은 주기 폴링 (권장하지 않음)

**장점:**
- 구현 간단

**단점:**
- API 호출 비용 증가
- Rate Limit 위험
- 실시간성 부족 (최소 1~5분 지연)
- 불필요한 API 호출 발생

**구현 예시:**
```typescript
// 예: 5분마다 최근 휴가 승인 확인
app.timer('vacationPolling', {
  schedule: '0 */5 * * * *', // 5분마다
  handler: async (timer, context) => {
    // 최근 5분 내 휴가 승인 확인
    const recentVacations = await flexClient.getRecentVacations(5);
    // 승인된 휴가만 처리
    // ...
  }
});
```

### 방법 2: 수동 Webhook 트리거 (현재 구현됨) ⭐ 권장

**개념:**
- Flex에서 휴가 승인 시 **수동으로** Webhook URL 호출
- 외부 자동화 도구 사용 (Zapier, Power Automate 등)
- 또는 Flex 담당자에게 커스텀 연동 요청

**구현 완료:**
```http
POST https://itmoou-attendance-func.azurewebsites.net/api/vacation/approved
```

**호출 방법:**

#### A. Azure Portal에서 수동 테스트

1. **Azure Portal** → Function App → `vacationApproved`
2. **Code + Test** → **Test/Run**
3. HTTP POST, Body에 JSON 입력:

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

#### B. Postman / curl 수동 호출

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
    "reason": "개인 휴가"
  }'
```

#### C. Power Automate / Zapier 자동화 (권장)

**Microsoft Power Automate 예시:**

1. **트리거:** Outlook에서 HR에게 "휴가 승인 완료" 이메일 수신
2. **액션:** HTTP POST 요청 → Azure Function URL
3. **데이터 매핑:** 이메일에서 직원 정보 추출 → JSON 변환

**Zapier 예시:**

1. **Trigger:** Email Parser (특정 형식의 이메일 파싱)
2. **Action:** Webhooks by Zapier → POST Request
3. **URL:** `https://itmoou-attendance-func.azurewebsites.net/api/vacation/approved`

#### D. Flex 담당자에게 커스텀 연동 요청

Flex 고객 성공팀 또는 기술팀에 문의:

```
안녕하세요, itmoou입니다.

휴가 승인 시 외부 시스템(Azure Functions)으로 Webhook을 전송하고자 합니다.
Flex에서 휴가 승인 완료 시 아래 URL로 POST 요청을 보낼 수 있는지 문의드립니다.

Webhook URL:
https://itmoou-attendance-func.azurewebsites.net/api/vacation/approved?code={키}

Method: POST
Content-Type: application/json

Body 형식:
{
  "employeeNumber": "직원사원번호",
  "employeeName": "직원이름",
  "employeeEmail": "직원이메일@itmoou.com",
  "vacationType": "연차/반차/병가",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "reason": "휴가사유"
}

가능 여부를 회신 부탁드립니다.
감사합니다.
```

---

## 현재 동작하는 기능

### ✅ 구현 완료 기능

1. **매일 09:00 휴가 현황 공지** (폴링 방식)
   - Flex API로 오늘 휴가자 목록 조회
   - Teams 채널에 공지
   - HR 이메일로 리포트 발송

2. **매일 18:00 휴가 리마인더** (폴링 방식)
   - 내일 휴가 시작하는 직원 → 본인 + HR 알림
   - 오늘 휴가 종료/내일 복귀 직원 → 본인 알림

3. **휴가 승인 HTTP Trigger** (수동/자동화 도구 연동)
   - ✅ Teams 개인 DM 알림
   - ✅ Outlook 개인 캘린더 일정 등록
   - ✅ HR 팀 공유 캘린더 일정 등록

---

## 테스트 방법

### 1️⃣ 타이머 함수 수동 실행

**Azure Portal:**
1. Function App → `itmoou-attendance-func`
2. Functions → `vacationAnnouncement` 또는 `vacationReminder`
3. **Code + Test** → **Run**
4. 로그 확인

### 2️⃣ HTTP Trigger 테스트

**Azure Portal:**
1. Functions → `vacationApproved`
2. **Code + Test** → **Test/Run**
3. Body에 JSON 입력 후 **Run**

**예상 응답:**
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

---

## 운영 체크리스트

- [x] Flex API 폴링 기반 타이머 함수 구현
- [x] vacationAnnouncement (09:00 공지)
- [x] vacationReminder (18:00 리마인더)
- [x] vacationApproved HTTP Trigger 구현
- [ ] Power Automate / Zapier 자동화 설정 (선택)
- [ ] Flex 담당자에게 커스텀 Webhook 요청 (선택)

---

## Function Key 확인 방법

Azure Portal에서 Function Key 확인:

1. **Azure Portal** → Function App → `itmoou-attendance-func`
2. **Functions** → `vacationApproved`
3. **Function Keys** → `default` 키 값 복사

**Webhook URL:**
```
https://itmoou-attendance-func.azurewebsites.net/api/vacation/approved?code={복사한_키}
```

---

## 로그 모니터링

### 실시간 로그

**Azure Portal:**
1. Function App → `itmoou-attendance-func`
2. **Log stream**

### Application Insights 쿼리

```kusto
// 휴가 승인 처리 로그
traces
| where timestamp > ago(1h)
| where message contains "VacationApproved"
| order by timestamp desc
| take 100
```

```kusto
// 휴가 공지 로그
traces
| where timestamp > ago(1d)
| where message contains "VacationAnnouncement"
| order by timestamp desc
| take 50
```

---

## 관련 문서

- [Phase 2 가이드](./PHASE2_GUIDE.md)
- [API 명세](./APIS.md)
- [README](./README.md)

---

## 문의

- **Flex API 문의:** Flex 고객 지원팀
- **시스템 문제:** Azure Portal Log stream 확인
- **Graph API 권한:** Microsoft 365 관리자

**작성일:** 2024-02-07
