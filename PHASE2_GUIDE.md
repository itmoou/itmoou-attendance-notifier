# Phase 2: 휴가 관리 자동화 구현 가이드

## 📋 개요

이 문서는 Flex 근태 알림 시스템에 추가된 Phase 2 휴가 관리 자동화 기능에 대한 상세 가이드입니다.

---

## 🎯 구현된 기능

### 1. 휴가 승인 알림 및 Outlook 캘린더 연동

#### Webhook 엔드포인트
```
POST /api/vacation/approved
```

#### 요청 예시
```json
{
  "employeeNumber": "123456",
  "employeeName": "홍길동",
  "employeeEmail": "hong@itmoou.com",
  "vacationType": "연차",
  "startDate": "2024-02-10",
  "endDate": "2024-02-12",
  "reason": "개인 휴가"
}
```

#### 응답 예시
```json
{
  "success": true,
  "message": "휴가 승인 처리 완료",
  "data": {
    "employeeName": "홍길동",
    "vacationType": "연차",
    "period": "2024-02-10 ~ 2024-02-12",
    "personalCalendar": true,
    "teamCalendar": true,
    "teamsNotification": true
  }
}
```

#### 처리 흐름
1. Flex에서 휴가 승인 → Webhook 호출
2. Teams Bot으로 승인 알림 발송
3. Outlook 개인 캘린더에 휴가 일정 등록
4. 팀 공유 캘린더(HR 계정)에 휴가 표시

---

### 2. 매일 아침 휴가 현황 공지

#### Timer: vacationAnnouncement
- **실행 시간**: 평일 09:00 (KST)
- **Cron**: `0 0 9 * * 1-5`

#### 기능
- 오늘 휴가자 목록 조회
- 이번 주 남은 기간 휴가 예정자 조회
- HR 이메일로 휴가 현황 리포트 발송

#### 이메일 내용
```
📅 2024-02-06 휴가 현황

오늘 휴가자 (2명)
  • 홍길동 - 연차 (2024-02-06 ~ 2024-02-08)
  • 김영희 - 반차 (2024-02-06)

이번 주 휴가 예정 (3건)
  2024-02-07 (수)
    • 이철수 - 병가
  2024-02-09 (금)
    • 박민수 - 연차
    • 최지연 - 반차
```

---

### 3. 휴가 리마인더

#### Timer: vacationReminder
- **실행 시간**: 평일 18:00 (KST)
- **Cron**: `0 0 18 * * 1-5`

#### 기능

##### 3.1 내일 휴가 시작 알림
- 내일 휴가 시작하는 직원에게 Teams DM 발송
- HR에게 이메일 알림

**Teams 메시지 예시**:
```
📅 휴가 시작 알림

안녕하세요, 홍길동님!

내일부터 휴가가 시작됩니다. 편안한 휴가 보내세요! 🌴

휴가 정보:
- 휴가 유형: 연차
- 기간: 2024-02-07 ~ 2024-02-09
- 복귀일: 2024-02-10

즐거운 시간 되세요! 😊
```

##### 3.2 내일 복귀 알림
- 오늘 휴가 종료하는 직원에게 Teams DM 발송

**Teams 메시지 예시**:
```
🏢 출근 리마인더

안녕하세요, 홍길동님!

휴가가 오늘로 종료되고, 내일(2024-02-07) 출근입니다.

휴가 정보:
- 휴가 유형: 연차
- 휴가 기간: 2024-02-04 ~ 2024-02-06
- 복귀일: 2024-02-07

잘 쉬셨나요? 내일 뵙겠습니다! 😊
```

---

## 🔧 기술 구현

### 1. Flex API 휴가 데이터 조회

#### 새로운 flexClient 메서드

```typescript
// 특정 날짜의 휴가자 목록 조회 (상세 정보 포함)
async getVacationersWithDetails(
  date: string,
  employeeNumbers: string[]
): Promise<VacationInfo[]>

// 날짜 범위의 휴가 정보 조회
async getVacationsInRange(
  startDate: string,
  endDate: string,
  employeeNumbers: string[]
): Promise<FlexTimeOffUse[]>

// 내일 휴가 시작하는 직원 조회
async getVacationStartingTomorrow(
  tomorrow: string,
  employeeNumbers: string[]
): Promise<FlexTimeOffUse[]>

// 내일 휴가 종료 (복귀일) 직원 조회
async getVacationEndingToday(
  today: string,
  employeeNumbers: string[]
): Promise<FlexTimeOffUse[]>
```

---

### 2. Outlook Calendar API 연동

#### calendarClient.ts

```typescript
// 사용자 개인 캘린더에 휴가 일정 생성
async function createVacationEvent(
  params: CreateVacationEventParams
): Promise<{ success: boolean; eventId?: string; error?: string }>

// 팀 공유 캘린더에 휴가 일정 추가
async function createTeamVacationEvent(
  params: CreateVacationEventParams,
  sharedCalendarId?: string
): Promise<{ success: boolean; eventId?: string; error?: string }>

// 캘린더 이벤트 삭제
async function deleteCalendarEvent(
  userEmail: string,
  eventId: string
): Promise<{ success: boolean; error?: string }>
```

#### 캘린더 이벤트 속성
- `subject`: `[휴가] 홍길동 - 연차`
- `isAllDay`: `true`
- `showAs`: `oof` (Out of Office)
- `categories`: `['휴가', '연차']`
- `timeZone`: `Asia/Seoul`

---

### 3. Graph API 권한 요구사항

#### 필요한 권한 (Application Permissions)
```
Calendars.ReadWrite
User.Read.All
Mail.Send
Chat.ReadWrite (기존)
```

#### Azure AD 앱 등록 설정
1. Azure Portal → Azure AD → App registrations
2. API permissions → Add permission
3. Microsoft Graph → Application permissions
4. `Calendars.ReadWrite` 추가
5. Grant admin consent

---

## 📝 사용 방법

### 1. Flex Webhook 설정

Flex 시스템에서 휴가 승인 이벤트 발생 시 다음 엔드포인트로 Webhook 호출:

```
POST https://<your-function-app>.azurewebsites.net/api/vacation/approved?code=<function-key>
```

### 2. 환경 변수 설정

기존 환경 변수에 추가 설정 불필요 (기존 Graph API 권한 사용)

### 3. 배포 후 확인

#### 3.1 Timer Functions 확인
```bash
# Azure Portal → Function App → Functions
# 다음 함수들이 표시되어야 함:
- vacationAnnouncement (Timer: 0 0 9 * * 1-5)
- vacationReminder (Timer: 0 0 18 * * 1-5)
```

#### 3.2 HTTP Trigger 확인
```bash
# Azure Portal → Function App → Functions
# 다음 함수가 표시되어야 함:
- vacationApproved (HTTP: POST /api/vacation/approved)
```

#### 3.3 로그 확인
```bash
# Azure Portal → Function App → Log stream
# 실행 로그 실시간 확인
```

---

## 🧪 테스트

### 1. 휴가 승인 Webhook 테스트

```bash
curl -X POST "https://<your-function-app>.azurewebsites.net/api/vacation/approved?code=<function-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeNumber": "123456",
    "employeeName": "홍길동",
    "employeeEmail": "hong@itmoou.com",
    "vacationType": "연차",
    "startDate": "2024-02-10",
    "endDate": "2024-02-12",
    "reason": "개인 휴가"
  }'
```

### 2. 수동 Timer 실행 (테스트용)

```bash
# Azure Portal에서 Timer Function 선택 → Code + Test → Test/Run
# 또는 Azure CLI 사용:
az functionapp function invoke \
  --name <function-app-name> \
  --function-name vacationAnnouncement \
  --resource-group <resource-group>
```

---

## 🔍 트러블슈팅

### 1. Outlook 캘린더 일정 생성 실패

**증상**:
```
[CalendarClient] 캘린더 일정 생성 실패: 403 Forbidden
```

**해결**:
- Graph API 권한 `Calendars.ReadWrite` 확인
- Admin Consent 완료 확인
- 사용자 이메일이 Microsoft 365에 존재하는지 확인

---

### 2. Teams 알림 미발송

**증상**:
```
[TeamsBot] Conversation Reference 없음
```

**해결**:
- 직원이 먼저 봇에게 메시지를 보내야 함
- Employee Map에 사원번호-UPN 매핑 확인
- `checkConversationReference(upn)` 함수로 확인

---

### 3. 휴가 데이터 조회 실패

**증상**:
```
[FlexClient] 휴가 정보 조회 실패: 401 Unauthorized
```

**해결**:
- Flex API Access Token 갱신 확인
- Refresh Token 유효기간 확인 (최대 7일)
- `FLEX_REFRESH_TOKEN` 환경변수 확인

---

## 📊 모니터링

### Application Insights 쿼리

```kusto
// 휴가 승인 처리 통계
traces
| where message contains "VacationApproved"
| where timestamp > ago(7d)
| summarize count() by bin(timestamp, 1d)

// 휴가 현황 공지 실행
traces
| where message contains "VacationAnnouncement"
| where timestamp > ago(30d)
| project timestamp, message

// 휴가 리마인더 발송 통계
traces
| where message contains "VacationReminder"
| where timestamp > ago(7d)
| summarize 시작알림=countif(message contains "휴가 시작"), 
            복귀알림=countif(message contains "복귀") 
  by bin(timestamp, 1d)
```

---

## 🚀 향후 개선 사항

1. **부서별 휴가 현황**: 부서별로 휴가 현황 분리 조회
2. **휴가 승인 거부 알림**: 휴가 거부 시 자동 알림
3. **휴가 잔여일 알림**: 연차 잔여일 부족 시 알림
4. **주간 휴가 리포트**: 매주 월요일 전주 휴가 현황 요약
5. **Teams 채널 공지**: 전체 팀 채널에 휴가 현황 자동 게시

---

## 📞 지원

시스템 관련 문의사항:
- **이메일**: hr@itmoou.com
- **긴급**: CEO (ceo@itmoou.com)

기술 관련 문의:
- GitHub Issues: [itmoou/itmoou-attendance-notifier](https://github.com/itmoou/itmoou-attendance-notifier/issues)
