# 보안 가이드

## ⚠️ 중요: 절대 Git에 커밋하면 안 되는 것

### 🚫 Git 제외 대상

다음 파일들은 **실제 토큰 값**이 들어있어 Git에 절대 포함하면 안 됩니다:

```
.env                    # 로컬 환경 변수 (실제 토큰)
.env.local              # 로컬 환경 변수
.env.*.local            # 환경별 로컬 설정
local.settings.json     # Azure Functions 로컬 설정 (실제 토큰)
```

### ✅ Git 포함 가능 (템플릿만)

다음 파일들은 **placeholder 값**만 들어있어 Git에 포함해도 됩니다:

```
.env.example                  # 환경 변수 템플릿
local.settings.json.example   # Azure Functions 설정 템플릿
```

---

## 🔐 토큰 관리 원칙

### 1. Refresh Token (최대 7일 유효)

**저장 위치:**
- ❌ Git 저장소
- ❌ 코드 파일
- ❌ 문서 파일
- ✅ `.env` 파일 (로컬, Git 제외됨)
- ✅ Azure Key Vault (프로덕션)
- ✅ Azure App Settings (프로덕션)
- ✅ GitHub Secrets (CI/CD)

**값 예시:**
```bash
# ❌ 잘못된 예 (실제 토큰을 문서에 넣으면 안 됨)
FLEX_REFRESH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ✅ 올바른 예 (템플릿 파일)
FLEX_REFRESH_TOKEN=your_flex_refresh_token_here
```

### 2. Access Token (최대 10분 유효)

**저장 위치:**
- ❌ 환경 변수
- ❌ 파일 시스템
- ❌ Git 저장소
- ✅ 메모리 캐시만 (tokenManager.ts)

**관리 방식:**
- Refresh Token으로 자동 재발급
- 메모리에만 캐시
- 만료 30초 전 자동 갱신

---

## 📂 프로젝트 사용 방법

### 로컬 개발 설정

```bash
# 1. 저장소 클론
git clone https://github.com/itmoou/itmoou-attendance-notifier.git
cd itmoou-attendance-notifier

# 2. 템플릿 파일 복사 (실제 파일 생성)
cp .env.example .env
cp local.settings.json.example local.settings.json

# 3. 실제 토큰 입력 (에디터로 열어서 수정)
# .env 파일:
FLEX_REFRESH_TOKEN=실제_리프레시_토큰_여기에_입력

# local.settings.json 파일:
{
  "Values": {
    "FLEX_REFRESH_TOKEN": "실제_리프레시_토큰_여기에_입력"
  }
}

# 4. Git 상태 확인 (.env가 나타나지 않아야 함)
git status

# 5. 개발 시작
npm install
npm run build
npm start
```

### Azure 배포 시 토큰 설정

**방법 1: Azure Portal (가장 쉬움)**

1. Azure Portal → Function App 선택
2. Configuration → Application settings
3. `+ New application setting` 클릭
4. Name: `FLEX_REFRESH_TOKEN`
5. Value: `실제_리프레시_토큰_입력`
6. OK → Save

**방법 2: Azure CLI**

```bash
az functionapp config appsettings set \
  --name func-flex-attendance \
  --resource-group rg-flex-attendance \
  --settings "FLEX_REFRESH_TOKEN=실제_리프레시_토큰"
```

**방법 3: Azure Key Vault (권장)**

```bash
# 1. Key Vault에 시크릿 저장
az keyvault secret set \
  --vault-name my-keyvault \
  --name flex-refresh-token \
  --value "실제_리프레시_토큰"

# 2. Function App에서 Key Vault 참조
az functionapp config appsettings set \
  --name func-flex-attendance \
  --resource-group rg-flex-attendance \
  --settings \
    "FLEX_REFRESH_TOKEN=@Microsoft.KeyVault(SecretUri=https://my-keyvault.vault.azure.net/secrets/flex-refresh-token/)"
```

---

## 🔍 보안 체크리스트

### ✅ 배포 전 확인 사항

- [ ] `.env` 파일이 `.gitignore`에 포함되어 있는가?
- [ ] `local.settings.json` 파일이 `.gitignore`에 포함되어 있는가?
- [ ] `git status` 실행 시 `.env` 또는 `local.settings.json`이 나타나지 않는가?
- [ ] `.env.example`에는 placeholder 값만 있는가?
- [ ] Azure Key Vault 또는 App Settings에 토큰을 저장했는가?

### ❌ 절대 하면 안 되는 것

- [ ] 실제 토큰을 `.env.example`에 넣기
- [ ] 실제 토큰을 문서 파일에 넣기
- [ ] 실제 토큰을 코드 파일에 하드코딩하기
- [ ] `.env` 파일을 Git에 커밋하기
- [ ] 토큰을 Slack, 이메일 등으로 평문 전송하기

---

## 🚨 토큰 노출 시 대응

### 실수로 Git에 토큰을 커밋한 경우

**즉시 조치:**

1. **토큰 무효화**
   - Flex 콘솔에 로그인
   - 기존 Refresh Token 폐기
   - 새 Refresh Token 발급

2. **Git 히스토리 정리**
   ```bash
   # 해당 커밋 되돌리기
   git reset --hard HEAD~1
   
   # 또는 특정 파일만 제거
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env" \
     --prune-empty --tag-name-filter cat -- --all
   
   # 강제 푸시 (주의: 협업 시 팀원과 협의)
   git push origin --force --all
   ```

3. **GitHub에 노출된 경우**
   - GitHub Support에 연락하여 캐시 삭제 요청
   - Repository를 private으로 변경
   - 토큰 무효화 (위 1번)

---

## 🔑 GitHub Secrets 사용 (CI/CD)

GitHub Actions에서 토큰을 사용할 경우:

1. **GitHub Secrets 설정**
   - Repository → Settings → Secrets and variables → Actions
   - `New repository secret` 클릭
   - Name: `FLEX_REFRESH_TOKEN`
   - Value: 실제 토큰 입력

2. **Workflow에서 사용**
   ```yaml
   - name: Deploy to Azure Functions
     env:
       FLEX_REFRESH_TOKEN: ${{ secrets.FLEX_REFRESH_TOKEN }}
     run: |
       # 배포 스크립트
   ```

---

## 📞 도움말

토큰 관련 문제 발생 시:
1. [AUTH_GUIDE.md](./AUTH_GUIDE.md) 참조
2. Azure Portal에서 App Settings 확인
3. 로그에서 토큰 값이 노출되지 않는지 확인

**절대 토큰 값을 평문으로 공유하지 마세요!**
