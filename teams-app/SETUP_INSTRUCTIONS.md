
# 📱 Teams Personal App 설정 가이드

## 🎯 현재 상태
- ✅ Manifest.json 업데이트 완료
- ✅ URL 설정 완료
- ⚠️ Function Key 입력 필요
- ⚠️ 아이콘 파일 생성 필요

---

## 📋 1단계: Function Key 입력

### manifest.json 파일 수정

**현재:**
```json
"contentUrl": "https://delightful-beach-0fa09b00f.2.azurestaticapps.net/index.html?key=FUNCTION_KEY_HERE"
```

**수정:**
```json
"contentUrl": "https://delightful-beach-0fa09b00f.2.azurestaticapps.net/index.html?key={실제_Function_Key}"
```

**예시:**
```json
"contentUrl": "https://delightful-beach-0fa09b00f.2.azurestaticapps.net/index.html?key=cdJOT21cx8_gzwvGhhW..."
```

---

## 🎨 2단계: 아이콘 생성

### 방법 1: 온라인 도구 사용 (가장 쉬움)

**Canva (무료):**
1. https://www.canva.com 접속
2. "사용자 지정 크기" → 192 x 192 픽셀
3. 배경: 파란색 (#4A90E2)
4. 이모지: 🏖️ 또는 📅 추가
5. 다운로드: PNG
6. 파일명: `icon-color.png`

**흰색 아웃라인 아이콘:**
1. "사용자 지정 크기" → 32 x 32 픽셀
2. 배경: 투명
3. 달력 아이콘 (흰색 선)
4. 다운로드: PNG
5. 파일명: `icon-outline.png`

---

### 방법 2: 임시 아이콘 다운로드 (빠름)

**icon-color.png (192x192):**
- 파란색 배경 + 흰색 달력 이모지
- 다운로드: https://via.placeholder.com/192/4A90E2/FFFFFF?text=🏖️

**icon-outline.png (32x32):**
- 투명 배경 + 흰색 선 달력
- 다운로드: https://via.placeholder.com/32/FFFFFF/000000?text=📅

---

### 방법 3: PowerPoint (Windows)

**icon-color.png:**
1. PowerPoint 새 슬라이드
2. 슬라이드 크기: 192 x 192 픽셀
3. 배경: 파란색 (#4A90E2)
4. 삽입 → 아이콘 → 달력
5. 파일 → 내보내기 → PNG
6. 파일명: `icon-color.png`

**icon-outline.png:**
1. 32 x 32 픽셀
2. 배경: 투명
3. 흰색 선 달력 아이콘
4. PNG 저장: `icon-outline.png`

---

## 📦 3단계: Teams 앱 패키지 생성

### 필요한 파일 확인

teams-app 폴더에 다음 파일이 있어야 합니다:
```
teams-app/
  ├── manifest.json        ✅ (Function Key 입력 완료)
  ├── icon-color.png       ⚠️ (생성 필요, 192x192)
  └── icon-outline.png     ⚠️ (생성 필요, 32x32)
```

---

### ZIP 파일 생성

**Windows:**
```
1. teams-app 폴더 열기
2. 3개 파일 선택 (Ctrl+클릭)
   - manifest.json
   - icon-color.png
   - icon-outline.png
3. 마우스 오른쪽 버튼
4. "보내기" → "압축(ZIP) 폴더"
5. 파일명: vacation-list-app.zip
```

**Mac:**
```
1. teams-app 폴더 열기
2. 3개 파일 선택 (Cmd+클릭)
3. 마우스 오른쪽 버튼
4. "3개 항목 압축"
5. 파일명: vacation-list-app.zip
```

**중요:** ZIP 파일 안에 폴더가 없어야 합니다!
- ✅ 올바름: vacation-list-app.zip 안에 3개 파일
- ❌ 잘못됨: vacation-list-app.zip → teams-app 폴더 → 3개 파일

---

## 🚀 4단계: Teams에 앱 업로드

### 개인 사용 (테스트)

1. **Microsoft Teams 앱 열기**
   - 데스크톱 또는 웹: https://teams.microsoft.com

2. **앱 메뉴 열기**
   - 좌측 사이드바: "앱" (Apps) 클릭

3. **앱 업로드**
   - 좌측 하단: "조직용 앱 관리" 또는 "Manage your apps"
   - 또는 우측 상단: "..." → "앱 업로드"

4. **ZIP 파일 선택**
   - "사용자 지정 앱 업로드" (Upload a custom app)
   - vacation-list-app.zip 선택

5. **앱 추가**
   - "추가" 버튼 클릭
   - 좌측 사이드바에 "휴가자 현황" 아이콘 표시!

---

### 팀 전체 배포 (관리자)

**Teams Admin Center:**

1. **관리자 센터 접속**
   - https://admin.teams.microsoft.com

2. **앱 관리**
   - Teams 앱 → 앱 관리 (Manage apps)

3. **앱 업로드**
   - "+ 업로드" 버튼
   - vacation-list-app.zip 선택
   - "업로드" 클릭

4. **앱 승인**
   - 상태: "제출됨" → "허용됨"
   - 검토 후 승인

5. **사용자에게 배포**
   - 설정 정책 → 앱 정책
   - "휴가자 현황" 앱 추가
   - 모든 사용자 또는 특정 그룹 선택

---

## 🎊 5단계: 사용하기!

### 팀원이 앱을 사용하는 방법:

1. **Teams 앱 열기**
   - 좌측 사이드바에서 "휴가자 현황" 클릭

2. **또는 검색**
   - "앱" → 검색창에 "휴가자 현황" 입력
   - "추가" 클릭

3. **휴가자 확인**
   - 앱이 자동으로 열림
   - Function Key 입력 불필요! ✅
   - 검색 필터 사용
   - 휴가자 목록 확인

---

## 📱 최종 사용자 경험

```
팀원이 보는 화면:

Teams 좌측 사이드바
  ├── 활동
  ├── 채팅
  ├── 팀
  ├── 일정
  ├── 통화
  ├── 파일
  └── 🏖️ 휴가자 현황  ← 여기 클릭!

→ 바로 휴가자 목록 표시!
→ Function Key 입력 불필요!
→ 검색 기능 사용 가능!
```

---

## 🔒 보안

- ✅ Function Key는 manifest.json에 한 번만 저장
- ✅ 팀원들은 키를 볼 수 없음
- ✅ Teams 내에서만 접근 가능
- ✅ Azure Function App CORS 보호

---

## ❓ 문제 해결

**Q1: 앱을 업로드할 수 없어요**
A: Teams 관리자 권한 필요. IT 관리자에게 요청하세요.

**Q2: 앱이 로드되지 않아요**
A: 
- manifest.json에 Function Key 입력 확인
- CORS 설정 확인
- validDomains 확인

**Q3: 아이콘이 표시되지 않아요**
A:
- icon-color.png: 192x192 픽셀
- icon-outline.png: 32x32 픽셀
- ZIP 파일에 3개 파일 모두 포함 확인

**Q4: "유효하지 않은 앱 패키지" 에러**
A:
- manifest.json 구문 확인 (JSON 유효성)
- ZIP 파일 구조 확인 (폴더 없이 3개 파일만)
- 파일명 확인 (대소문자 정확히)

