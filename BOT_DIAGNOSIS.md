# Teams Bot 진단 체크리스트

## 1단계: Azure Function 작동 확인
```bash
curl -X POST https://itmoou-attendance-func-ate3csagf3c4hyas.koreacentral-01.azurewebsites.net/api/bot/messages \
  -H "Content-Type: application/json" \
  -d '{"type":"message","from":{"id":"test"},"conversation":{"id":"test"},"serviceUrl":"https://test.com","text":"hi"}'
```

예상 응답: 오류 메시지 (정상) 또는 200 OK

---

## 2단계: Azure Bot Service 설정 확인

### Azure Portal → Bot Service → Configuration

- [ ] Microsoft App ID: `52a8b283-875d-45ed-8282-f275c652f498`
- [ ] Messaging endpoint: `https://itmoou-attendance-func-ate3csagf3c4hyas.koreacentral-01.azurewebsites.net/api/bot/messages`
- [ ] "Apply" 버튼 클릭 완료

### Azure Portal → Bot Service → Channels

- [ ] Microsoft Teams 채널: **Healthy** 상태
- [ ] Messaging 탭: **활성화됨**

---

## 3단계: Bot Framework Portal 연결 확인

https://dev.botframework.com/bots 접속:

- [ ] 봇이 목록에 보임
- [ ] "Test in Web Chat" 작동함

**봇이 안 보이는 경우**:
→ Azure Bot Service와 Bot Framework Portal이 연결되지 않음
→ Azure Portal에서 다시 생성 필요

---

## 4단계: Teams Manifest 확인

Developer Portal → manifest.json:

- [ ] `"botId": "52a8b283-875d-45ed-8282-f275c652f498"`
- [ ] `"isNotificationOnly": false`
- [ ] `"scopes": ["personal"]`
- [ ] `"permissions": ["identity", "messageTeamMembers"]`
- [ ] `"validDomains": ["itmoou-attendance-func-ate3csagf3c4hyas.koreacentral-01.azurewebsites.net", "*.botframework.com"]`

---

## 5단계: Teams 앱 상태 확인

Teams → Apps → 근태알림:

- [ ] 앱이 설치되어 있음
- [ ] 버전 1.0.2로 업데이트됨
- [ ] 채팅창 열림

**오류 메시지**:
- "이 봇으로 메시지를 보낼 수 없습니다": Manifest 또는 Bot Service 설정 문제
- "봇이 응답하지 않습니다": Function 또는 Endpoint 문제

---

## 가능한 원인 및 해결책

### 원인 1: Bot Framework Portal에 봇이 등록되지 않음
**해결**: Azure Portal에서 Bot Service를 삭제하고 다시 생성

### 원인 2: Teams Channel이 제대로 설정되지 않음
**해결**: Azure Portal → Channels → Microsoft Teams 재설정

### 원인 3: Manifest에 isNotificationOnly가 true로 설정됨
**해결**: Manifest에서 `"isNotificationOnly": false` 확인

### 원인 4: validDomains가 비어있음
**해결**: Manifest에 Bot Endpoint 도메인 추가

### 원인 5: Teams 앱 캐시 문제
**해결**: 웹 브라우저 시크릿 모드에서 테스트

---

## 최종 확인 명령

```bash
# Function 작동 확인
curl -X POST https://itmoou-attendance-func-ate3csagf3c4hyas.koreacentral-01.azurewebsites.net/api/bot/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test" \
  -d '{"type":"message","from":{"id":"test"},"conversation":{"id":"test"},"serviceUrl":"https://test.com","text":"hi"}'

# 예상: {"error":"Invalid activity: missing serviceUrl or conversation.id"} 또는 다른 검증 오류
# 이것은 정상입니다! Function이 작동하고 있다는 의미입니다.
```
