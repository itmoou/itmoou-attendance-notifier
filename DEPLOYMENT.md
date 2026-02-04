# 배포 가이드

Azure Functions에 Flex 근태 누락 알림 시스템을 배포하는 방법을 안내합니다.

---

## 목차

1. [사전 준비](#사전-준비)
2. [Azure 리소스 생성](#azure-리소스-생성)
3. [환경 변수 설정](#환경-변수-설정)
4. [배포 방법](#배포-방법)
5. [배포 후 확인](#배포-후-확인)
6. [CI/CD 설정](#cicd-설정)
7. [모니터링 및 로깅](#모니터링-및-로깅)

---

## 사전 준비

### 필수 도구 설치

1. **Azure CLI**
   ```bash
   # macOS
   brew install azure-cli
   
   # Windows
   winget install Microsoft.AzureCLI
   
   # Linux
   curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
   ```

2. **Azure Functions Core Tools**
   ```bash
   # macOS
   brew tap azure/functions
   brew install azure-functions-core-tools@4
   
   # Windows
   npm install -g azure-functions-core-tools@4
   
   # Linux
   npm install -g azure-functions-core-tools@4
   ```

3. **Node.js 18+**
   ```bash
   # nvm 사용
   nvm install 18
   nvm use 18
   ```

### Azure 로그인

```bash
az login
az account list --output table
az account set --subscription "Your-Subscription-Name"
```

---

## Azure 리소스 생성

### 1. 리소스 그룹 생성

```bash
# 변수 설정
RESOURCE_GROUP="rg-flex-attendance"
LOCATION="koreacentral"

# 리소스 그룹 생성
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION
```

### 2. Storage Account 생성

```bash
STORAGE_NAME="stflexattendance$(date +%s)"

az storage account create \
  --name $STORAGE_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2
```

### 3. Function App 생성

```bash
FUNCTION_APP_NAME="func-flex-attendance"

az functionapp create \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --storage-account $STORAGE_NAME \
  --consumption-plan-location $LOCATION \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --os-type Linux
```

### 4. Application Insights 생성 (선택 사항, 권장)

```bash
APP_INSIGHTS_NAME="appi-flex-attendance"

az monitor app-insights component create \
  --app $APP_INSIGHTS_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --application-type web

# Instrumentation Key 조회
INSTRUMENTATION_KEY=$(az monitor app-insights component show \
  --app $APP_INSIGHTS_NAME \
  --resource-group $RESOURCE_GROUP \
  --query instrumentationKey \
  --output tsv)

# Function App에 연결
az functionapp config appsettings set \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings "APPINSIGHTS_INSTRUMENTATIONKEY=$INSTRUMENTATION_KEY"
```

---

## 환경 변수 설정

### Azure Portal을 통한 설정

1. **Azure Portal 접속**
   - https://portal.azure.com

2. **Function App으로 이동**
   - 리소스 그룹 → Function App 선택

3. **Configuration 메뉴**
   - 왼쪽 메뉴 → Configuration → Application settings

4. **환경 변수 추가**
   - `+ New application setting` 클릭
   - 각 변수 추가 후 `OK` → `Save`

### Azure CLI를 통한 설정

```bash
# 한 번에 여러 설정 추가
az functionapp config appsettings set \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    "FLEX_API_BASE_URL=https://your-flex-api.com" \
    "FLEX_ACCESS_TOKEN=your_access_token" \
    "FLEX_REFRESH_TOKEN=your_refresh_token" \
    "FLEX_CLIENT_ID=your_client_id" \
    "FLEX_CLIENT_SECRET=your_client_secret" \
    "AZURE_TENANT_ID=your_tenant_id" \
    "AZURE_CLIENT_ID=your_azure_client_id" \
    "AZURE_CLIENT_SECRET=your_azure_client_secret" \
    "HR_EMAIL=hr@itmoou.com" \
    "CEO_EMAIL=ceo@itmoou.com" \
    "REFRESH_TOKEN_WARNING_DAYS=2" \
    "TZ=Asia/Seoul" \
    "LOG_LEVEL=info"
```

### 환경 변수 목록

| 변수명 | 필수 | 설명 |
|--------|------|------|
| `FLEX_API_BASE_URL` | ✅ | Flex API Base URL |
| `FLEX_ACCESS_TOKEN` | ✅ | Flex Access Token |
| `FLEX_REFRESH_TOKEN` | ✅ | Flex Refresh Token |
| `FLEX_CLIENT_ID` | ✅ | Flex Client ID |
| `FLEX_CLIENT_SECRET` | ✅ | Flex Client Secret |
| `AZURE_TENANT_ID` | ✅ | Azure AD Tenant ID |
| `AZURE_CLIENT_ID` | ✅ | Azure AD Client ID |
| `AZURE_CLIENT_SECRET` | ✅ | Azure AD Client Secret |
| `HR_EMAIL` | ✅ | HR 담당자 이메일 |
| `CEO_EMAIL` | ✅ | CEO 이메일 |
| `REFRESH_TOKEN_WARNING_DAYS` | ❌ | Token 만료 경고 (기본: 2) |
| `TZ` | ❌ | Timezone (기본: Asia/Seoul) |
| `LOG_LEVEL` | ❌ | 로그 레벨 (기본: info) |

---

## 배포 방법

### 방법 1: Azure Functions Core Tools (권장)

```bash
# 프로젝트 디렉토리로 이동
cd flex-attendance-alert

# 의존성 설치
npm install

# TypeScript 빌드
npm run build

# Azure에 배포
func azure functionapp publish $FUNCTION_APP_NAME

# 배포 완료 메시지 예시:
# Getting site publishing info...
# Uploading package...
# Upload completed successfully.
# Deployment completed successfully.
# Syncing triggers...
# Functions in func-flex-attendance:
#     checkCheckIn-first - [timerTrigger]
#     checkCheckIn-second - [timerTrigger]
#     checkCheckOut-first - [timerTrigger]
#     checkCheckOut-second - [timerTrigger]
#     dailySummary - [timerTrigger]
#     outlookReport - [timerTrigger]
```

### 방법 2: Azure CLI

```bash
# ZIP 파일로 패키징
npm install --production
npm run build
zip -r deployment.zip .

# ZIP 배포
az functionapp deployment source config-zip \
  --resource-group $RESOURCE_GROUP \
  --name $FUNCTION_APP_NAME \
  --src deployment.zip
```

### 방법 3: VS Code Extension

1. **Azure Functions Extension 설치**
   - VS Code → Extensions → "Azure Functions" 검색 및 설치

2. **배포**
   - Azure 아이콘 클릭
   - "Deploy to Function App..." 선택
   - Function App 선택
   - 배포 확인

---

## 배포 후 확인

### 1. Functions 목록 확인

```bash
az functionapp function list \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --output table
```

**예상 출력:**
```
Name                   Status  
---------------------  --------
checkCheckIn-first     Enabled 
checkCheckIn-second    Enabled 
checkCheckOut-first    Enabled 
checkCheckOut-second   Enabled 
dailySummary           Enabled 
outlookReport          Enabled
```

### 2. 로그 확인

```bash
# 실시간 로그 스트림
az webapp log tail \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP
```

### 3. Azure Portal에서 확인

1. **Function App으로 이동**
2. **Functions 메뉴**
   - 모든 함수가 "Enabled" 상태인지 확인
3. **Monitor 메뉴**
   - 각 함수 클릭 → Monitor 탭
   - 실행 내역 확인

### 4. 수동 테스트 실행

```bash
# 특정 함수 수동 실행
az functionapp function keys list \
  --function-name checkCheckIn-first \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP

# Function URL 확인 후 POST 요청
curl -X POST "https://$FUNCTION_APP_NAME.azurewebsites.net/admin/functions/checkCheckIn-first" \
  -H "x-functions-key: YOUR_MASTER_KEY"
```

---

## CI/CD 설정

### GitHub Actions

`.github/workflows/deploy.yml` 생성:

```yaml
name: Deploy to Azure Functions

on:
  push:
    branches:
      - main
  workflow_dispatch:

env:
  AZURE_FUNCTIONAPP_NAME: func-flex-attendance
  NODE_VERSION: '18.x'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build TypeScript
      run: npm run build
    
    - name: Deploy to Azure Functions
      uses: Azure/functions-action@v1
      with:
        app-name: ${{ env.AZURE_FUNCTIONAPP_NAME }}
        package: .
        publish-profile: ${{ secrets.AZURE_FUNCTIONAPP_PUBLISH_PROFILE }}
```

**Publish Profile 설정:**

1. Azure Portal → Function App → Get publish profile 다운로드
2. GitHub → Settings → Secrets and variables → Actions
3. New repository secret 클릭
4. Name: `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`
5. Value: publish profile 파일 내용 붙여넣기

### Azure DevOps

`azure-pipelines.yml` 생성:

```yaml
trigger:
  branches:
    include:
      - main

pool:
  vmImage: 'ubuntu-latest'

variables:
  azureSubscription: 'Your-Service-Connection'
  functionAppName: 'func-flex-attendance'
  nodeVersion: '18.x'

steps:
- task: NodeTool@0
  inputs:
    versionSpec: $(nodeVersion)
  displayName: 'Install Node.js'

- script: |
    npm ci
    npm run build
  displayName: 'Build project'

- task: ArchiveFiles@2
  inputs:
    rootFolderOrFile: '$(System.DefaultWorkingDirectory)'
    includeRootFolder: false
    archiveType: 'zip'
    archiveFile: '$(Build.ArtifactStagingDirectory)/$(Build.BuildId).zip'
  displayName: 'Archive files'

- task: AzureFunctionApp@1
  inputs:
    azureSubscription: $(azureSubscription)
    appType: 'functionAppLinux'
    appName: $(functionAppName)
    package: '$(Build.ArtifactStagingDirectory)/$(Build.BuildId).zip'
  displayName: 'Deploy to Azure Functions'
```

---

## 모니터링 및 로깅

### Application Insights 쿼리

**1. 최근 실행 내역**
```kusto
requests
| where timestamp > ago(24h)
| where cloud_RoleName == "func-flex-attendance"
| project timestamp, name, success, duration, resultCode
| order by timestamp desc
```

**2. 에러 로그**
```kusto
traces
| where timestamp > ago(24h)
| where severityLevel >= 3
| project timestamp, message, severityLevel
| order by timestamp desc
```

**3. 함수별 성공률**
```kusto
requests
| where timestamp > ago(7d)
| summarize 
    Total = count(),
    Success = countif(success == true),
    Failed = countif(success == false)
  by name
| extend SuccessRate = (Success * 100.0) / Total
```

### 알림 설정

**Azure Portal에서 Alert Rule 생성:**

1. Function App → Alerts → New alert rule
2. Condition 추가:
   - Signal: `Failed requests`
   - Threshold: 3 failures in 5 minutes
3. Action group 추가:
   - Email/SMS 알림 설정
4. Alert rule details:
   - Name: "Function Failure Alert"
   - Severity: Error

---

## 문제 해결

### 배포 실패

```bash
# 로그 확인
az functionapp log deployment list \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP

# 상세 로그
az functionapp log deployment show \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --deployment-id <deployment-id>
```

### 함수가 실행되지 않음

1. **타이머 상태 확인**
   ```bash
   az functionapp function show \
     --name $FUNCTION_APP_NAME \
     --resource-group $RESOURCE_GROUP \
     --function-name checkCheckIn-first
   ```

2. **환경 변수 확인**
   ```bash
   az functionapp config appsettings list \
     --name $FUNCTION_APP_NAME \
     --resource-group $RESOURCE_GROUP
   ```

### Function App 재시작

```bash
az functionapp restart \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP
```

---

## 리소스 정리

```bash
# 리소스 그룹 전체 삭제 (주의!)
az group delete \
  --name $RESOURCE_GROUP \
  --yes \
  --no-wait
```

---

## 참고 자료

- [Azure Functions 공식 문서](https://learn.microsoft.com/azure/azure-functions/)
- [Azure CLI 레퍼런스](https://learn.microsoft.com/cli/azure/)
- [Function App 가격 정책](https://azure.microsoft.com/pricing/details/functions/)
