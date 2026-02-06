# Bot ID 불일치 문제 해결 가이드

## 문제 요약
- Azure Bot Service의 Microsoft App ID와 Function App의 BOT_APP_ID가 다름
- Teams 앱의 Bot ID도 다름
- 3개의 ID가 모두 일치해야 함!

## 해결 단계

### 1. Azure Portal - Function App 환경변수 수정

**Azure Portal** → **Function App** (`itmoou-attendance-func`) → **환경 변수**

#### 현재 잘못된 값:
```
BOT_APP_ID=53ab2b34-975c-40cc-b332-c275cc52f498  ❌
```

#### 올바른 값으로 변경:
```
BOT_APP_ID=52a8b283-875d-45ed-8282-f275c652f498  ✅
```

**변경 방법**:
1. 환경 변수 목록에서 `BOT_APP_ID` 찾기
2. 편집(✏️) 클릭
3. 값을 `52a8b283-875d-45ed-8282-f275c652f498`로 변경
4. **저장** 클릭
5. **Function App 재시작** (중요!)

---

### 2. Teams Developer Portal - Bot 설정 수정

**Developer Portal** → `근태알림` 앱 → **App features** → **Bot**

#### 현재 잘못된 Bot ID:
```
57d807db76ce54e6181f3d7fe21947b8  ❌
```

#### 올바른 Bot ID로 변경:
```
52a8b283-875d-45ed-8282-f275c652f498  ✅
```

**변경 방법**:
1. Developer Portal → Apps → `근태알림` 클릭
2. 왼쪽 메뉴 **"Configure" → "App features"** 클릭
3. **"Bot"** 타일 클릭 (또는 편집 버튼)
4. **Bot ID 변경**:
   - 기존 Bot ID 삭제
   - 새 Bot ID 입력: `52a8b283-875d-45ed-8282-f275c652f498`
5. **Bot endpoint address 확인**:
   ```
   https://itmoou-attendance-func-ate3csagf3c4hyas.koreacentral-01.azurewebsites.net/api/bot/messages
   ```
6. **Scopes**: `Personal` 체크 ✅
7. **저장** 클릭

---

### 3. Teams 앱 업데이트

Developer Portal에서:
1. 왼쪽 메뉴 **"Publish" → "Publish to org"** 클릭
2. 또는 **"Update"** 버튼 클릭 (이미 publish된 경우)
3. 업데이트 완료 대기

---

### 4. Teams에서 앱 재설치 (선택사항)

기존 앱이 캐시되었을 수 있으므로:
1. Teams → Apps → `근태알림` 앱 찾기
2. 앱 위에서 마우스 오른쪽 클릭 → **"제거"** (Uninstall)
3. 다시 설치: Apps → "Built for your org" → `근태알림` → **"추가"**

---

### 5. Function App 재시작

환경변수 변경 후 반드시 재시작 필요:

**Azure Portal** → **Function App** (`itmoou-attendance-func`) → **개요** → **재시작** 버튼 클릭

---

## 확인 체크리스트

변경 후 다음을 확인:

- [ ] Azure Bot Service Microsoft App ID: `52a8b283-875d-45ed-8282-f275c652f498`
- [ ] Function App BOT_APP_ID: `52a8b283-875d-45ed-8282-f275c652f498`
- [ ] Teams Developer Portal Bot ID: `52a8b283-875d-45ed-8282-f275c652f498`
- [ ] Function App 재시작 완료
- [ ] Teams 앱 업데이트 완료

---

## 테스트

모든 변경 후:

1. **Teams에서 `근태알림` 봇 열기**
2. **메시지 전송**: `테스트`
3. **예상 응답**:
   ```
   **근태알림(자동 알림) / 회신 불필요**
   
   안녕하세요! 👋
   
   저는 **근태 누락 알림 봇**입니다.
   ...
   ```

4. **Application Insights 확인**:
   ```kusto
   traces
   | where timestamp > ago(5m)
   | where message contains "BotMessages"
   | order by timestamp desc
   | take 10
   ```

   예상 로그:
   ```
   [BotMessages] 요청 수신
   [BotMessages] Activity type: message
   [BotMessages] 메시지: "테스트" from <사용자 AAD ID>
   ```

---

## 올바른 ID 정리

**모든 곳에서 사용해야 하는 ID**:
```
52a8b283-875d-45ed-8282-f275c652f498
```

이 ID는:
- Azure Bot Service의 **Microsoft App ID**
- Azure Active Directory에 등록된 앱의 **Application (client) ID**
- Function App의 **BOT_APP_ID** 환경변수
- Teams Developer Portal의 **Bot ID**

**모두 동일해야 합니다!**

