# Teams Bot 설정 가이드

## 현재 상황
- Azure Bot Service: ✅ 생성됨 (itmoou-attendance-bot)
- Messaging Endpoint: ✅ 설정됨
- Teams Channel: ✅ 활성화됨
- Bot Framework Portal: ❌ 봇이 보이지 않음
- Teams 앱: ❌ 설치되지 않음

## 해결 방법

### 옵션 1: Teams Developer Portal로 앱 생성 (권장)

1. **Teams Developer Portal 접속**
   - URL: https://dev.teams.microsoft.com/
   - 로그인 (Azure Bot과 동일한 계정)

2. **새 앱 생성**
   - "Apps" → "New app" 클릭
   - App name: `근태 알림 봇`
   - Short description: `출퇴근 체크 누락 시 자동 알림`
   - Long description: `Flex 근태 시스템과 연동하여 출퇴근 체크 누락 시 Teams DM으로 자동 알림을 보냅니다.`
   - Developer information: 회사 정보 입력
   - App URLs: 회사 웹사이트 (또는 임시로 https://itmoou.com)

3. **Bot 기능 추가**
   - 왼쪽 메뉴: "App features" 클릭
   - "Bot" 선택
   
   **Bot 설정**:
   - Select an existing bot: "Enter a bot ID"
   - Bot ID: `<BOT_APP_ID 값 입력>` (Azure Portal → Bot Service → Configuration → Microsoft App ID)
   - Scope: **Personal** 체크 ✅
   - Commands 추가 (선택사항):
     ```
     Command: help
     Description: 봇 사용법 안내
     ```

4. **Publish**
   - "Publish" → "Publish to org" 클릭
   - 또는 "Download app package" (.zip 파일) 다운로드 후 수동 설치

5. **Teams에 설치**
   - Teams → Apps → "Built for your org" (조직용으로 빌드됨)
   - `근태 알림 봇` 찾아서 "Add" 클릭

---

### 옵션 2: App Studio 사용 (레거시)

1. **Teams에서 App Studio 설치**
   - Teams → Apps → "App Studio" 검색
   - "Add" 클릭

2. **Manifest editor 열기**
   - App Studio → "Manifest editor" 탭
   - "Create a new app" 클릭

3. **App details 입력**
   - App names: `근태 알림 봇`
   - App ID: Generate 클릭 (또는 기존 GUID 사용)
   - Package name: `com.itmoou.attendance.bot`
   - Version: `1.0.0`
   - Short/Long description 입력
   - Developer information 입력

4. **Capabilities → Bots**
   - "Set up" 클릭
   - "Existing bot" 선택
   - Bot ID: `<BOT_APP_ID>` 입력
   - Scope: **Personal** 체크 ✅

5. **Test and distribute**
   - "Install" 클릭하여 Teams에 설치

---

### 옵션 3: 수동으로 Manifest 생성

아래 manifest.json 파일을 생성하고 ZIP으로 압축 후 Teams에 업로드:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
  "manifestVersion": "1.16",
  "version": "1.0.0",
  "id": "<BOT_APP_ID>",
  "packageName": "com.itmoou.attendance.bot",
  "developer": {
    "name": "ITMOOU",
    "websiteUrl": "https://itmoou.com",
    "privacyUrl": "https://itmoou.com/privacy",
    "termsOfUseUrl": "https://itmoou.com/terms"
  },
  "name": {
    "short": "근태 알림 봇",
    "full": "ITMOOU 근태 누락 자동 알림 봇"
  },
  "description": {
    "short": "출퇴근 체크 누락 시 자동 알림",
    "full": "Flex 근태 시스템과 연동하여 출퇴근 체크 누락 시 Teams DM으로 자동 알림을 보냅니다."
  },
  "icons": {
    "outline": "outline.png",
    "color": "color.png"
  },
  "accentColor": "#FFFFFF",
  "bots": [
    {
      "botId": "<BOT_APP_ID>",
      "scopes": [
        "personal"
      ],
      "supportsFiles": false,
      "isNotificationOnly": true
    }
  ],
  "permissions": [
    "identity",
    "messageTeamMembers"
  ],
  "validDomains": [
    "itmoou-attendance-func-ate3csagf3c4hyas.koreacentral-01.azurewebsites.net"
  ]
}
```

**필요한 파일**:
1. `manifest.json` (위 내용)
2. `color.png` (192x192 컬러 아이콘)
3. `outline.png` (32x32 투명 아웃라인 아이콘)

위 3개 파일을 ZIP으로 압축 → Teams → Apps → "Upload a custom app"

---

## 환경변수 확인 필요

Azure Portal → Function App → Environment variables에서 다음 값 확인:

```bash
BOT_APP_ID=<Microsoft App ID>
BOT_APP_PASSWORD=<Microsoft App Password>
```

**Microsoft App ID 찾는 법**:
Azure Portal → Bot Service → Configuration → "Microsoft App ID" 복사

---

## 테스트 순서

1. ✅ Bot Framework Portal에서 "Test in Web Chat"
2. ✅ Teams에 앱 설치
3. ✅ Teams에서 봇에게 메시지 전송
4. ✅ Application Insights에서 로그 확인
5. ✅ Azure Table Storage에서 ConversationReference 확인

---

## 다음 단계

이 가이드에 따라 설정 후 결과를 공유해주세요!
