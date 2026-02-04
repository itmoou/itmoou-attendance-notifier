# Teams Bot 설정 가이드

## ⚠️ 중요: Teams 알림 방식

이 시스템은 **Microsoft Graph API가 아닌 Teams Bot (Proactive Message)**을 사용합니다.

**이유:**
- Graph API의 `/chats/{id}/messages`는 app-only 권한으로 운영 목적 DM 발송이 불안정
- Teams Bot은 사용자 동의 없이 proactive message 전송 가능
- 더 안정적이고 Microsoft가 권장하는 방식

---

## 1️⃣ Azure Bot Service 생성

### Azure Portal에서 Bot 생성

```bash
# 1. Azure Portal → Create a resource
# 2. "Azure Bot" 검색
# 3. 다음 정보로 생성:
#    - Bot handle: flex-attendance-bot
#    - Pricing tier: F0 (Free)
#    - Microsoft App ID: Create new
```

### Bot Credentials 저장

생성 완료 후 다음 정보를 메모:
- **Application (client) ID**: `BOT_APP_ID`
- **Client Secret**: `BOT_APP_PASSWORD`

---

## 2️⃣ Teams Channel 추가

### Bot에 Teams 채널 연결

```bash
# 1. Azure Portal → Bot Service
# 2. Channels → Microsoft Teams
# 3. Enable 클릭
# 4. 저장
```

### Messaging Endpoint 설정

```bash
# Azure Portal → Bot Service → Configuration → Messaging endpoint

# 로컬 테스트 (ngrok 사용):
https://your-ngrok-url.ngrok.io/api/bot/messages

# Azure 배포 후:
https://your-function-app.azurewebsites.net/api/bot/messages
```

---

## 3️⃣ Azure Storage Account 생성

### Table Storage 생성

```bash
# 1. Azure Portal → Create Storage Account
# 2. 생성 완료 후 Connection String 복사
# 3. 환경변수에 저장: AZURE_STORAGE_CONNECTION_STRING
```

### TeamsConversation 테이블 생성

시스템이 자동으로 생성하지만, 수동으로 생성하려면:

```bash
# Azure Portal → Storage Account → Tables → + Table
# Table name: TeamsConversation
```

**스키마:**
- **PartitionKey**: `v1` (고정)
- **RowKey**: 사용자 UPN (예: `ymsim@itmoou.com`)
- **conversationReferenceJson**: Conversation Reference JSON

---

## 4️⃣ Bot Manifest 생성 및 배포

### Manifest 파일 생성

`manifest.json` 파일 생성:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
  "manifestVersion": "1.16",
  "version": "1.0.0",
  "id": "YOUR_BOT_APP_ID",
  "packageName": "com.itmoou.attendance.bot",
  "developer": {
    "name": "ITMOOU",
    "websiteUrl": "https://www.itmoou.com",
    "privacyUrl": "https://www.itmoou.com/privacy",
    "termsOfUseUrl": "https://www.itmoou.com/terms"
  },
  "icons": {
    "color": "color.png",
    "outline": "outline.png"
  },
  "name": {
    "short": "근태 알림",
    "full": "ITMOOU 근태 누락 알림 봇"
  },
  "description": {
    "short": "출퇴근 체크 누락 시 자동 알림",
    "full": "Flex 출퇴근 체크 누락 시 Teams로 자동 알림을 보내는 봇입니다."
  },
  "accentColor": "#FFFFFF",
  "bots": [
    {
      "botId": "YOUR_BOT_APP_ID",
      "scopes": [
        "personal"
      ],
      "supportsFiles": false,
      "isNotificationOnly": false
    }
  ],
  "permissions": [
    "identity",
    "messageTeamMembers"
  ],
  "validDomains": []
}
```

### 아이콘 준비

- `color.png`: 192x192 픽셀
- `outline.png`: 32x32 픽셀 (투명 배경)

### ZIP 패키지 생성

```bash
# manifest.json, color.png, outline.png을 ZIP으로 압축
zip bot-package.zip manifest.json color.png outline.png
```

---

## 5️⃣ Teams에 Bot 배포

### 조직 전체에 배포 (관리자)

```bash
# 1. Teams Admin Center
# 2. Teams apps → Manage apps
# 3. Upload → Upload an app to your org's app catalog
# 4. bot-package.zip 업로드
# 5. 승인 및 배포
```

### 개인 배포 (테스트용)

```bash
# 1. Teams 앱
# 2. Apps → Manage your apps
# 3. Upload an app
# 4. bot-package.zip 업로드
```

---

## 6️⃣ 사용자 초기 설정

### 사용자가 해야 할 일

**모든 직원이 다음 단계를 수행해야 합니다:**

1. **Teams에서 봇 검색**
   ```
   Teams → Apps → "근태 알림" 검색
   ```

2. **봇 추가**
   ```
   Add 클릭
   ```

3. **첫 메시지 전송**
   ```
   채팅창에서 "hi" 또는 아무 메시지나 전송
   ```

4. **봇 응답 확인**
   ```
   봇이 환영 메시지를 보내면 설정 완료!
   ```

**⚠️ 중요**: 
- 사용자가 먼저 봇에게 메시지를 보내야 Conversation Reference가 저장됨
- 저장되기 전에는 알림을 받을 수 없음
- HR 담당자는 모든 직원이 봇을 추가했는지 확인 필요

---

## 7️⃣ 환경 변수 설정

### Azure Function App Settings

```bash
az functionapp config appsettings set \
  --name func-flex-attendance \
  --resource-group rg-flex-attendance \
  --settings \
    "BOT_APP_ID=your_bot_app_id" \
    "BOT_APP_PASSWORD=your_bot_app_password" \
    "AZURE_STORAGE_CONNECTION_STRING=your_connection_string"
```

---

## 8️⃣ 테스트

### Conversation Reference 확인

직원이 봇에게 메시지를 보낸 후:

```bash
# Azure Portal → Storage Account → Tables → TeamsConversation
# RowKey에 직원 UPN이 있는지 확인
```

### 수동 테스트

Timer Function을 수동으로 실행하여 알림이 전송되는지 확인:

```bash
# Azure Portal → Function App → Functions
# checkCheckIn-first → Code + Test → Test/Run
```

---

## 9️⃣ 문제 해결

### 알림이 전송되지 않음

**증상:**
```
[TeamsBot] ❌ Conversation Reference 없음: user@example.com
```

**해결:**
1. 사용자가 봇에게 메시지를 보냈는지 확인
2. Table Storage에 Conversation Reference가 있는지 확인
3. UPN이 정확한지 확인 (대소문자 구분 안 함)

### Bot Endpoint 오류

**증상:**
```
502 Bad Gateway
```

**해결:**
1. Function App이 실행 중인지 확인
2. Messaging Endpoint URL이 정확한지 확인
3. BOT_APP_ID와 BOT_APP_PASSWORD가 올바른지 확인

### Table Storage 연결 오류

**증상:**
```
AZURE_STORAGE_CONNECTION_STRING 환경변수가 설정되지 않았습니다.
```

**해결:**
1. Connection String이 환경변수에 설정되었는지 확인
2. Storage Account가 생성되었는지 확인
3. Function App 재시작

---

## 🎯 체크리스트

설정 완료 전 확인:

- [ ] Azure Bot Service 생성 완료
- [ ] BOT_APP_ID 및 BOT_APP_PASSWORD 저장
- [ ] Teams Channel 추가
- [ ] Messaging Endpoint 설정
- [ ] Azure Storage Account 생성
- [ ] Connection String 환경변수 설정
- [ ] Bot Manifest ZIP 패키지 생성
- [ ] Teams에 Bot 배포
- [ ] 전체 직원이 봇 추가 및 첫 메시지 전송
- [ ] Table Storage에 Conversation Reference 저장 확인
- [ ] 테스트 알림 전송 성공

---

## 📚 참고 자료

- [Azure Bot Service 문서](https://learn.microsoft.com/azure/bot-service/)
- [Teams Bot 개발 가이드](https://learn.microsoft.com/microsoftteams/platform/bots/what-are-bots)
- [Proactive Messages](https://learn.microsoft.com/azure/bot-service/bot-builder-howto-proactive-messages)
