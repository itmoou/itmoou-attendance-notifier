# 아이콘 생성 가이드

## 온라인 도구 사용 (가장 쉬움)

### 1. Canva
1. https://www.canva.com 접속
2. "Create a design" → "Custom size"
3. 192 x 192 픽셀 입력
4. 파란색 배경 추가
5. 텍스트 "📅" 또는 "휴가" 추가 (흰색)
6. Download → PNG
7. 파일명: `icon-color.png`

### 2. 32x32 아이콘
1. 동일하게 Canva에서
2. 32 x 32 픽셀
3. 투명 배경 + 흰색 달력 아이콘
4. 파일명: `icon-outline.png`

---

## 임시 아이콘 (테스트용)

단색 PNG 파일만 있어도 작동합니다:
- `icon-color.png`: 파란색 사각형 (192x192)
- `icon-outline.png`: 흰색 사각형 (32x32)

---

## ImageMagick 사용 (Linux)

```bash
# 컬러 아이콘 (파란색 배경)
convert -size 192x192 xc:'#4A90E2' icon-color.png

# 아웃라인 아이콘 (흰색)
convert -size 32x32 xc:'white' -alpha set -channel RGBA icon-outline.png
```

---

## 아이콘 준비 완료 후

```bash
# ZIP 패키지 생성
cd /home/user/webapp/teams-app
zip vacation-calendar-app.zip manifest.json icon-color.png icon-outline.png
```
