# 🚀 휴가자 현황 - Azure 배포 및 Teams 통합 가이드

## 📋 배포 순서

1. ✅ CORS 설정
2. ⏳ Azure Static Web Apps 배포
3. ⏳ Function Key 확인
4. ⏳ 웹페이지 테스트
5. ⏳ Teams 앱 통합

---

## 1️⃣ CORS 설정 (필수, 1분)

### Azure CLI로 실행

```bash
az functionapp cors add \
  --name itmoou-attendance-func \
  --resource-group rg-itmoou-hr-prod \
  --allowed-origins "*"
```

### 또는 Azure Portal에서

```
1. Azure Portal → itmoou-attendance-func
2. 좌측 메뉴: CORS
3. "허용된 원본"에 "*" 추가
4. 저장
```

**결과 확인**:
```bash
az functionapp cors show \
  --name itmoou-attendance-func \
  --resource-group rg-itmoou-hr-prod
```

---

## 2️⃣ Azure Static Web Apps 배포 (5-10분)

### 방법 A: Azure Portal (권장, 가장 쉬움)

#### Step 1: Static Web App 생성

1. **Azure Portal 접속**: https://portal.azure.com
2. 검색창에 **"Static Web Apps"** 입력
3. **"만들기"** 클릭

#### Step 2: 기본 설정

```
구독: (현재 구독)
리소스 그룹: rg-itmoou-hr-prod
이름: itmoou-vacation-list
호스팅 플랜 유형: Free
지역: East Asia
```

#### Step 3: GitHub 배포 설정

```
배포 원본: GitHub
GitHub 계정: (로그인)
조직: itmoou
리포지토리: itmoou-attendance-notifier
분기: main
```

#### Step 4: 빌드 구성

```
빌드 사전 설정: Custom

앱 위치: /public
API 위치: (비워둠)
출력 위치: (비워둠)
```

#### Step 5: 검토 및 만들기

1. **"검토 + 만들기"** 클릭
2. **"만들기"** 클릭
3. 배포 시작 (5-10분 소요)

#### Step 6: URL 확인

배포 완료 후:
```
1. "리소스로 이동" 클릭
2. Overview 탭에서 URL 확인
3. 예: https://gray-sea-xxxxx.1.azurestaticapps.net
```

---

### 방법 B: Azure CLI (빠름)

```bash
# Static Web App 생성
az staticwebapp create \
  --name itmoou-vacation-list \
  --resource-group rg-itmoou-hr-prod \
  --source https://github.com/itmoou/itmoou-attendance-notifier \
  --location "East Asia" \
  --branch main \
  --app-location "public" \
  --skip-api-build

# URL 확인
az staticwebapp show \
  --name itmoou-vacation-list \
  --resource-group rg-itmoou-hr-prod \
  --query defaultHostname \
  --output tsv
```

---

## 3️⃣ Function Key 확인

### Azure Portal에서

```
1. itmoou-attendance-func 열기
2. 좌측 메뉴: App keys (또는 Functions → vacationCalendar → Function Keys)
3. "default" 키 복사
```

**예시**:
```
ABC123XYZ456def789ghi012jkl345mno678pqr901stu234vwx567yza890bcd123==
```

---

## 4️⃣ 웹페이지 테스트

### 최종 URL 구성

```
https://[Static-Web-Apps-URL]/?key=[Function_Key]
```

**실제 예시**:
```
https://gray-sea-xxxxx.1.azurestaticapps.net/?key=ABC123XYZ456def789ghi012jkl345mno678pqr901stu234vwx567yza890bcd123==
```

### 브라우저에서 확인

1. 위 URL을 브라우저에 입력
2. 휴가자 목록 페이지 로드 확인
3. 검색 필터 동작 확인
4. 테이블에 데이터 표시 확인

---

## 5️⃣ Teams Personal App 통합

### Step 1: manifest.json 수정

파일 경로: `teams-app/manifest.json`

**변경 사항**:

```json
{
  "staticTabs": [
    {
      "entityId": "vacation-list-tab",
      "name": "휴가자 현황",
      "contentUrl": "https://[실제_배포_URL]/index.html?key=[실제_Function_Key]",
      "websiteUrl": "https://[실제_배포_URL]/index.html?key=[실제_Function_Key]",
      "scopes": ["personal"]
    }
  ],
  "validDomains": [
    "[Static_Web_Apps_도메인]",
    "itmoou-attendance-func.azurewebsites.net"
  ]
}
```

**실제 예시**:
```json
{
  "staticTabs": [
    {
      "contentUrl": "https://gray-sea-xxxxx.1.azurestaticapps.net/index.html?key=ABC123...",
      "websiteUrl": "https://gray-sea-xxxxx.1.azurestaticapps.net/index.html?key=ABC123..."
    }
  ],
  "validDomains": [
    "gray-sea-xxxxx.1.azurestaticapps.net",
    "itmoou-attendance-func.azurewebsites.net"
  ]
}
```

---

### Step 2: 아이콘 준비

`teams-app/` 폴더에 2개 아이콘 필요:

#### icon-color.png (192x192 픽셀)

**Canva로 만들기**:
1. https://www.canva.com 접속
2. Custom size: 192 x 192 픽셀
3. 파란색 배경 (#4A90E2)
4. 흰색 텍스트 "📊" 또는 "휴가"
5. PNG로 다운로드

#### icon-outline.png (32x32 픽셀)

**Canva로 만들기**:
1. Custom size: 32 x 32 픽셀
2. 투명 배경
3. 흰색 아이콘
4. PNG로 다운로드

**또는 임시 아이콘**:
- 온라인에서 파란색/흰색 PNG 다운로드
- 크기만 맞으면 작동

---

### Step 3: ZIP 패키지 생성

```bash
cd /home/user/webapp/teams-app

# manifest.json, icon-color.png, icon-outline.png를 ZIP으로
zip vacation-list-app.zip manifest.json icon-color.png icon-outline.png
```

**결과**: `vacation-list-app.zip` 파일 생성

---

### Step 4: Teams에 앱 업로드

#### 개인 사용 (테스트)

1. **Microsoft Teams** 열기 (데스크톱 또는 웹)
2. 좌측 **Apps** 클릭
3. **Manage your apps** → **Upload an app**
4. **Upload a custom app** 선택
5. `vacation-list-app.zip` 업로드
6. **Add** 클릭

#### 팀 전체 사용 (관리자)

1. **Teams Admin Center**: https://admin.teams.microsoft.com
2. **Teams apps** → **Manage apps**
3. **Upload** 클릭
4. `vacation-list-app.zip` 업로드
5. **Approve** (승인)

---

## ✅ 배포 완료 체크리스트

### Backend
- [x] Azure Functions 배포됨
- [x] Flex API 인증 작동
- [x] vacationCalendar API 테스트 성공

### Frontend
- [ ] Azure Static Web Apps 배포 완료
- [ ] 배포 URL 확인
- [ ] Function Key 추가한 URL 접속 성공
- [ ] 휴가자 목록 표시 확인

### CORS
- [ ] CORS 설정 완료
- [ ] API 호출 에러 없음

### Teams (선택사항)
- [ ] manifest.json 수정 (URL + Function Key)
- [ ] 아이콘 준비 (192x192, 32x32)
- [ ] ZIP 패키지 생성
- [ ] Teams에 업로드
- [ ] Teams 좌측 사이드바에 앱 표시

---

## 🧪 테스트 시나리오

### 1. 웹페이지 직접 접속

```
https://[배포_URL]/?key=[Function_Key]
```

**확인 사항**:
- [ ] 페이지 로드
- [ ] 이번 달 휴가자 목록 표시
- [ ] 검색 필터 작동
- [ ] 테이블 정렬

### 2. Teams 앱에서 접속

```
Teams → 좌측 사이드바 → 휴가자 현황 클릭
```

**확인 사항**:
- [ ] 앱 아이콘 표시
- [ ] 클릭 시 페이지 로드
- [ ] 동일한 기능 작동
- [ ] 모바일 Teams에서도 작동

---

## 🔧 문제 해결

### CORS 에러

**증상**: `Access to fetch ... has been blocked by CORS policy`

**해결**:
```bash
az functionapp cors add \
  --name itmoou-attendance-func \
  --resource-group rg-itmoou-hr-prod \
  --allowed-origins "*"
```

### Function Key 에러

**증상**: `401 Unauthorized`

**해결**:
- Function Key 재확인
- URL에 `?key=` 파라미터 포함 확인

### Teams 앱이 로드되지 않음

**증상**: Teams에서 빈 화면

**해결**:
1. manifest.json의 validDomains 확인
2. CORS 설정 확인
3. URL에 Function Key 포함 확인

---

## 📊 시스템 구성도

```
┌─────────────────────────────────────────────────┐
│   Microsoft Teams (선택사항)                     │
│   - 좌측 사이드바: 휴가자 현황 아이콘            │
└────────────────┬────────────────────────────────┘
                 │ iframe 로드
                 ▼
┌─────────────────────────────────────────────────┐
│   Azure Static Web Apps                         │
│   https://gray-sea-xxxxx.1.azurestaticapps.net │
│   + ?key=Function_Key                           │
└────────────────┬────────────────────────────────┘
                 │ HTTPS + Function Key
                 ▼
┌─────────────────────────────────────────────────┐
│   Azure Functions                               │
│   GET /api/vacation/calendar?year=X&month=Y     │
└────────────────┬────────────────────────────────┘
                 │ Bearer Token (client_id=open-api)
                 ▼
┌─────────────────────────────────────────────────┐
│   Flex API                                      │
│   /users/time-off-uses/dates/{date}             │
└─────────────────────────────────────────────────┘
```

---

## 🎉 완료 후 사용 방법

### 웹 브라우저
```
https://[배포_URL]/?key=[Function_Key]
```

### Teams 앱
```
Teams → 휴가자 현황 클릭 → 목록 확인
```

### 검색 예시
- **오늘 휴가자**: 날짜를 오늘로 설정
- **이번 주 개발팀**: 부서=개발팀, 날짜=이번 주
- **특정 직원 연차**: 사원명 입력, 휴가유형=연차

---

## 📞 지원

문제 발생 시:

1. **Azure Portal Log Stream**:
   ```
   itmoou-attendance-func → Log stream
   ```

2. **브라우저 Console** (F12):
   ```
   Console 탭에서 에러 확인
   ```

3. **GitHub Actions**:
   ```
   https://github.com/itmoou/itmoou-attendance-notifier/actions
   ```

---

**배포 준비 완료!** 🚀

위 단계를 순서대로 진행하면 됩니다!
