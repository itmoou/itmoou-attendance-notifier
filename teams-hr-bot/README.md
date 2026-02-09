# HR 관리 봇 - Teams 앱 설치 가이드

## 📦 앱 패키지

`hr-bot-app.zip` 파일에 다음이 포함되어 있습니다:
- `manifest.json` - Teams 앱 정의
- `icon-color.png` - 192x192 컬러 아이콘
- `icon-outline.png` - 32x32 아웃라인 아이콘

## 🚀 설치 방법

### 1️⃣ Teams 앱 업로드

1. **Microsoft Teams** 열기
2. 왼쪽 사이드바에서 **"앱"** 클릭
3. 하단의 **"앱 관리"** 클릭
4. **"앱 업로드"** → **"사용자 지정 앱 업로드"** 선택
5. `hr-bot-app.zip` 파일 선택
6. **"추가"** 버튼 클릭

### 2️⃣ 봇과 대화 시작

1. 앱이 설치되면 자동으로 봇과 대화 시작
2. 환영 메시지 수신

### 3️⃣ Super Admin 확인

Super Admin으로 설정된 계정(`ymsim@itmoou.com`)으로 로그인한 경우:

```
안녕
```

**예상 응답:**
```
**ITMOOU HR 관리 봇**

안녕하세요! 👋

저는 **HR 관리자 전용 문서 관리 봇**입니다.

📊 **사용 가능한 기능:**
- 근태 리포트 조회
- 휴가 현황 조회
- SharePoint 문서 링크 제공

💡 **명령어:**
- "리포트" 또는 "근태리포트" - 최근 근태 리포트 보기
- "휴가" 또는 "휴가현황" - 최근 휴가 현황 보기
- "도움말" - 명령어 목록 보기

🔧 **관리자 명령어:**
- "권한부여 user@itmoou.com" - 사용자 권한 부여
- "권한제거 user@itmoou.com" - 사용자 권한 제거
- "권한목록" - 권한 있는 사용자 목록 보기

🔒 이 봇은 HR 관리자만 사용할 수 있습니다.
```

## 📝 사용 예시

### 근태 리포트 조회
```
리포트
```

### 휴가 현황 조회
```
휴가
```

### 사용자 권한 부여 (Super Admin만)
```
권한부여 kim@itmoou.com
```

### 권한 목록 보기 (Super Admin만)
```
권한목록
```

### 사용자 권한 제거 (Super Admin만)
```
권한제거 lee@itmoou.com
```

## 🔧 권한 관리

- **Super Admin**: 환경 변수 `HR_BOT_SUPER_ADMIN`에 설정된 사용자
  - 현재: `ymsim@itmoou.com`
  - Super Admin은 봇 명령어로 다른 사용자에게 권한 부여/제거 가능

- **일반 사용자**: Super Admin이 권한을 부여한 사용자
  - 근태 리포트, 휴가 현황 조회 가능
  - 권한 관리 불가

## ⚠️ 주의사항

1. 이 봇은 **개인 채팅(Personal)**에서만 작동합니다
2. 팀 채널에서는 사용할 수 없습니다
3. 권한이 없는 사용자는 접근 거부 메시지를 받게 됩니다

## 🆘 문제 해결

### "접근 권한이 없습니다" 메시지가 나옵니다
- Super Admin에게 권한 부여 요청
- 또는 IT 관리자에게 문의

### Super Admin 명령어가 보이지 않습니다
- 환경 변수 `HR_BOT_SUPER_ADMIN`이 올바르게 설정되었는지 확인
- Function App을 재시작했는지 확인
- Teams에서 로그인한 이메일 주소가 Super Admin과 일치하는지 확인

### 봇이 응답하지 않습니다
- Azure Function App이 실행 중인지 확인
- Bot Service의 Messaging Endpoint 설정 확인:
  `https://itmoou-attendance-func-ate3csagf3c4hyas.koreacentral-01.azurewebsites.net/api/bot/hr-messages`

## 📚 추가 정보

- Bot ID: `3b1bc06d-6a4a-4596-aae7-e8cb55844a6b`
- Messaging Endpoint: `https://itmoou-attendance-func-ate3csagf3c4hyas.koreacentral-01.azurewebsites.net/api/bot/hr-messages`
- 권한 관리: Azure Table Storage (`HRBotPermissions`)
