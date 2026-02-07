# 🎉 Teams Personal App - 휴가 캘린더

## ✨ 개요

Teams 앱 내에서 휴가 캘린더를 직접 확인할 수 있는 Personal App입니다.

**사용자 경험**:
```
Teams 앱 열기
→ 좌측 사이드바에서 "휴가 캘린더" 클릭
→ 달력 표시 (웹페이지와 동일)
→ 월 변경, 날짜 클릭으로 상세 확인
```

---

## 🚀 배포 단계

### 1단계: 웹페이지 배포 (Azure Static Web Apps)

```bash
# Static Web App 생성
az staticwebapp create \
  --name itmoou-vacation-calendar \
  --resource-group rg-itmoou-hr-prod \
  --source https://github.com/itmoou/itmoou-attendance-notifier \
  --location "East Asia" \
  --branch main \
  --app-location "public" \
  --skip-api-build
```

**배포 완료 후 URL 확인**:
```
https://itmoou-vacation-calendar.azurestaticapps.net
```

---

### 2단계: CORS 설정

```bash
az functionapp cors add \
  --name itmoou-attendance-func \
  --resource-group rg-itmoou-hr-prod \
  --allowed-origins "https://itmoou-vacation-calendar.azurestaticapps.net"
```

---

### 3단계: Teams Manifest 수정

`teams-app/manifest.json` 파일 수정:

```json
{
  "staticTabs": [
    {
      "entityId": "vacation-calendar-tab",
      "name": "휴가 캘린더",
      "contentUrl": "https://itmoou-vacation-calendar.azurestaticapps.net/index.html?key=YOUR_FUNCTION_KEY",
      "websiteUrl": "https://itmoou-vacation-calendar.azurestaticapps.net/index.html?key=YOUR_FUNCTION_KEY",
      "scopes": ["personal"]
    }
  ],
  "validDomains": [
    "itmoou-vacation-calendar.azurestaticapps.net",
    "itmoou-attendance-func.azurewebsites.net"
  ]
}
```

**변경 사항**:
- `DEPLOYMENT_URL` → 실제 배포된 URL
- `FUNCTION_KEY` → Azure Portal에서 확인한 Function Key

---

### 4단계: 앱 아이콘 준비

`teams-app/` 폴더에 아이콘 2개 필요:

#### `icon-color.png` (192x192)
- 컬러 아이콘
- PNG 형식
- 투명 배경 권장

#### `icon-outline.png` (32x32)
- 단색 아이콘 (흰색 + 투명 배경)
- PNG 형식

**간단한 아이콘 생성**:
```
📅 (달력 이모지)
또는 회사 로고
```

온라인 도구:
- https://www.canva.com
- https://www.figma.com
- https://iconscout.com

---

### 5단계: Teams App 패키지 생성

```bash
# teams-app 폴더로 이동
cd /home/user/webapp/teams-app

# ZIP 파일 생성
zip -r vacation-calendar-app.zip manifest.json icon-color.png icon-outline.png

# 또는 모든 파일을 ZIP으로
zip vacation-calendar-app.zip *
```

**결과**: `vacation-calendar-app.zip` 파일 생성

---

### 6단계: Teams에 앱 업로드

#### 방법 A: Teams 앱에서 직접 업로드

1. **Teams 열기** (데스크톱 또는 웹)
2. **좌측 사이드바** → **Apps** (앱) 클릭
3. **Manage your apps** (앱 관리) → **Upload an app** (앱 업로드)
4. **Upload a custom app** (사용자 지정 앱 업로드)
5. `vacation-calendar-app.zip` 선택
6. **Add** (추가) 클릭

#### 방법 B: Teams Admin Center (관리자)

1. **Teams Admin Center** 접속
   ```
   https://admin.teams.microsoft.com
   ```
2. **Teams apps** → **Manage apps**
3. **Upload** → `vacation-calendar-app.zip` 선택
4. **Approve** (승인)
5. 모든 팀원이 사용 가능

---

## 🎯 사용 방법

### 팀원 입장

1. Teams 앱 열기
2. 좌측 사이드바에서 **휴가 캘린더** 아이콘 클릭
3. 달력 페이지 표시
4. 월 변경, 날짜 클릭으로 휴가자 확인

### 모바일에서도 동일

- iOS/Android Teams 앱
- 좌측 메뉴에서 앱 찾기
- 동일한 경험

---

## 🛠️ 아이콘이 없는 경우

임시 아이콘을 생성하겠습니다:

### 간단한 텍스트 아이콘

**icon-color.png** (192x192):
```
파란색 배경 + 흰색 "📅" 이모지
또는
파란색 배경 + 흰색 "휴가"
```

**icon-outline.png** (32x32):
```
투명 배경 + 흰색 달력 아이콘
```

**온라인 생성 도구**:
1. https://www.canva.com/create/icons/
2. 192x192 또는 32x32 크기 설정
3. 달력 또는 "휴가" 텍스트 추가
4. PNG로 다운로드

---

## 📊 시스템 구성도

```
┌─────────────────────────────────────────────────┐
│   Microsoft Teams 앱                            │
│   (데스크톱, 웹, 모바일)                         │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│   Teams Personal App (Tab)                      │
│   - 앱 이름: 휴가 캘린더                         │
│   - 아이콘: 📅                                  │
│   - URL: Static Web Apps + Function Key        │
└────────────────┬────────────────────────────────┘
                 │ iframe으로 로드
                 ▼
┌─────────────────────────────────────────────────┐
│   Azure Static Web Apps                         │
│   https://itmoou-vacation-calendar...           │
│   - 휴가 캘린더 웹페이지                         │
└────────────────┬────────────────────────────────┘
                 │ API 호출 (Function Key)
                 ▼
┌─────────────────────────────────────────────────┐
│   Azure Functions                               │
│   /api/vacation/calendar                        │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│   Flex API                                      │
│   휴가 데이터                                    │
└─────────────────────────────────────────────────┘
```

---

## 🔒 보안 고려사항

### Function Key 노출 문제

Teams Manifest에 Function Key가 포함되므로 주의 필요:

#### 해결 방법 1: Azure AD 인증 (권장)

Function App에서 Azure AD 인증 활성화:
```bash
az functionapp auth update \
  --name itmoou-attendance-func \
  --resource-group rg-itmoou-hr-prod \
  --enabled true \
  --action LoginWithAzureActiveDirectory
```

그 후 `public/app.js`에서 MSAL.js로 토큰 획득

#### 해결 방법 2: 제한된 Function Key

휴가 캘린더 전용 Function Key 생성:
```
Azure Portal → itmoou-attendance-func
→ Functions → vacationCalendar
→ Function Keys → Add new key
→ 이름: "teams-app-key"
```

이 키는 **vacationCalendar Function만** 접근 가능

---

## ✅ 배포 체크리스트

### 웹페이지 배포
- [ ] Azure Static Web Apps 생성
- [ ] 배포 URL 확인
- [ ] CORS 설정

### Teams 앱 준비
- [ ] manifest.json 수정 (URL, Function Key)
- [ ] icon-color.png 준비 (192x192)
- [ ] icon-outline.png 준비 (32x32)
- [ ] ZIP 파일 생성

### Teams 업로드
- [ ] Teams에 앱 업로드
- [ ] 앱 테스트 (본인)
- [ ] 팀원 접근 확인

---

## 🎉 완료 후

**Teams 좌측 사이드바**에 **"휴가 캘린더"** 아이콘이 표시됩니다!

클릭하면:
- 현재 월 휴가 현황
- 날짜별 휴가자 목록
- 이전/다음 월 네비게이션

**모든 팀원이 동일하게 사용 가능**합니다! 🚀

---

## 🔧 트러블슈팅

### 앱이 로드되지 않음

**원인**: CORS 설정 누락

**해결**:
```bash
az functionapp cors add \
  --name itmoou-attendance-func \
  --resource-group rg-itmoou-hr-prod \
  --allowed-origins "https://itmoou-vacation-calendar.azurestaticapps.net"
```

### 아이콘이 표시되지 않음

**원인**: 아이콘 크기 또는 형식 오류

**해결**:
- icon-color.png: 정확히 192x192 픽셀
- icon-outline.png: 정확히 32x32 픽셀
- PNG 형식 필수

### Function Key 401 에러

**원인**: Function Key가 잘못됨

**해결**:
- Azure Portal에서 키 재확인
- manifest.json에 올바르게 입력

---

## 📚 참고 자료

- [Teams Personal App 개발 가이드](https://learn.microsoft.com/microsoftteams/platform/tabs/what-are-tabs)
- [Teams App Manifest 스키마](https://learn.microsoft.com/microsoftteams/platform/resources/schema/manifest-schema)
- [Teams 앱 업로드](https://learn.microsoft.com/microsoftteams/platform/concepts/deploy-and-publish/apps-upload)

---

**이제 Teams에서 휴가 캘린더를 사용할 수 있습니다!** 🎊
