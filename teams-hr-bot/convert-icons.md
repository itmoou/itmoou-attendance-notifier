# 아이콘 변환 가이드

## 방법 1: 온라인 도구 사용 (가장 빠름)

### 1️⃣ SVG를 PNG로 변환

**웹사이트:** https://cloudconvert.com/svg-to-png

1. `icon-template.svg` 파일 업로드
2. Width: 192 입력
3. "Convert" 클릭
4. 다운로드한 파일을 `icon-color.png`로 이름 변경

### 2️⃣ 아웃라인 아이콘 만들기

**웹사이트:** https://www.iloveimg.com/resize-image

1. 위에서 만든 `icon-color.png` 업로드
2. Width: 32, Height: 32로 리사이즈
3. 다운로드한 파일을 `icon-outline.png`로 이름 변경

---

## 방법 2: Canva 사용

**웹사이트:** https://www.canva.com

1. "사용자 지정 크기" → 192x192 선택
2. 디자인:
   - 주황색 원형 배경 (#FF7043)
   - 흰색 클립보드 아이콘
   - 체크마크 3개
3. PNG로 다운로드 → `icon-color.png`
4. 32x32로 다시 만들기 → `icon-outline.png`

---

## 방법 3: 임시 아이콘 사용

당장 테스트하려면 기존 아이콘을 그대로 사용하고, 나중에 디자이너에게 의뢰해서 교체할 수 있습니다.

---

## 완료 후

새 아이콘 파일을 다음 위치에 저장:
```
teams-hr-bot/
├── icon-color.png    (192x192)
└── icon-outline.png  (32x32)
```

그 다음 zip 파일 재생성:
```powershell
cd C:\Users\심영민.AzureAD\itmoou-attendance-notifier\teams-hr-bot
Remove-Item hr-bot-app.zip
Compress-Archive -Path manifest.json,icon-color.png,icon-outline.png -DestinationPath hr-bot-app.zip
```
