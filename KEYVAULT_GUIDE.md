# Azure Key Vault 연동 가이드

## 개요

민감한 비밀값(Secret)을 Azure Key Vault에 저장하고 Function App에서 참조하는 방법을 설명합니다.

## 저장해야 할 비밀값

- `FLEX_REFRESH_TOKEN`: Flex API Refresh Token
- `BOT_APP_PASSWORD`: Teams Bot Password (Client Secret)
- `AZURE_CLIENT_SECRET`: Microsoft Graph API Client Secret
- `AZURE_STORAGE_CONNECTION_STRING`: Azure Storage 연결 문자열

## 1. Azure Key Vault 생성

### Azure Portal

```bash
# Resource Group 생성 (이미 있으면 생략)
az group create \
  --name rg-flex-attendance \
  --location koreacentral

# Key Vault 생성
az keyvault create \
  --name kv-flex-attendance \
  --resource-group rg-flex-attendance \
  --location koreacentral \
  --enable-rbac-authorization false
```

## 2. Secret 저장

### Azure CLI

```bash
# Flex Refresh Token
az keyvault secret set \
  --vault-name kv-flex-attendance \
  --name flex-refresh-token \
  --value "your_actual_refresh_token_here"

# Bot App Password
az keyvault secret set \
  --vault-name kv-flex-attendance \
  --name bot-app-password \
  --value "your_bot_password_here"

# Azure Client Secret
az keyvault secret set \
  --vault-name kv-flex-attendance \
  --name azure-client-secret \
  --value "your_client_secret_here"

# Azure Storage Connection String
az keyvault secret set \
  --vault-name kv-flex-attendance \
  --name azure-storage-connection \
  --value "DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net"
```

### Azure Portal

1. Key Vault → Secrets → + Generate/Import
2. Name: `flex-refresh-token`
3. Value: 실제 토큰 값
4. Create

## 3. Function App Managed Identity 설정

### System Assigned Identity 활성화

```bash
# Function App에 System Assigned Identity 활성화
az functionapp identity assign \
  --name func-flex-attendance \
  --resource-group rg-flex-attendance

# Principal ID 확인 (출력값 저장)
PRINCIPAL_ID=$(az functionapp identity show \
  --name func-flex-attendance \
  --resource-group rg-flex-attendance \
  --query principalId -o tsv)

echo "Principal ID: $PRINCIPAL_ID"
```

### Azure Portal

1. Function App → Settings → Identity
2. System assigned → Status: **On**
3. Save
4. Object ID 복사

## 4. Key Vault Access Policy 설정

### Azure CLI

```bash
# Function App에 Key Vault Secret 읽기 권한 부여
az keyvault set-policy \
  --name kv-flex-attendance \
  --object-id $PRINCIPAL_ID \
  --secret-permissions get list
```

### Azure Portal

1. Key Vault → Access policies → + Add Access Policy
2. Secret permissions: **Get**, **List**
3. Select principal: Function App의 Managed Identity 선택
4. Add → Save

## 5. Function App 환경변수 설정

### Key Vault Reference 형식

```
@Microsoft.KeyVault(SecretUri=https://kv-flex-attendance.vault.azure.net/secrets/secret-name/)
```

### Azure CLI

```bash
az functionapp config appsettings set \
  --name func-flex-attendance \
  --resource-group rg-flex-attendance \
  --settings \
    "FLEX_REFRESH_TOKEN=@Microsoft.KeyVault(SecretUri=https://kv-flex-attendance.vault.azure.net/secrets/flex-refresh-token/)" \
    "BOT_APP_PASSWORD=@Microsoft.KeyVault(SecretUri=https://kv-flex-attendance.vault.azure.net/secrets/bot-app-password/)" \
    "AZURE_CLIENT_SECRET=@Microsoft.KeyVault(SecretUri=https://kv-flex-attendance.vault.azure.net/secrets/azure-client-secret/)" \
    "AZURE_STORAGE_CONNECTION_STRING=@Microsoft.KeyVault(SecretUri=https://kv-flex-attendance.vault.azure.net/secrets/azure-storage-connection/)"
```

### Azure Portal

1. Function App → Configuration → Application settings
2. New application setting 또는 기존 설정 편집
3. Name: `FLEX_REFRESH_TOKEN`
4. Value: `@Microsoft.KeyVault(SecretUri=https://kv-flex-attendance.vault.azure.net/secrets/flex-refresh-token/)`
5. OK → Save

## 6. 확인

### Function App에서 Secret 접근 확인

```bash
# Function App 로그 확인
az functionapp log tail \
  --name func-flex-attendance \
  --resource-group rg-flex-attendance
```

또는

1. Function App → Functions → 아무 Function 선택
2. Code + Test → Test/Run
3. Logs 확인

## 보안 체크리스트

- [ ] Key Vault 생성 완료
- [ ] 모든 비밀값 Key Vault에 저장
- [ ] Function App Managed Identity 활성화
- [ ] Key Vault Access Policy 설정 완료
- [ ] Function App 환경변수를 Key Vault Reference로 변경
- [ ] .env 파일은 Git에 포함되지 않음 (`.gitignore` 확인)
- [ ] local.settings.json은 로컬 개발용만 사용
- [ ] GitHub/Azure DevOps에도 실제 비밀값 저장 금지
- [ ] CI/CD에서는 Key Vault 또는 Secret Store 사용

## 로컬 개발 시

로컬 개발 환경에서는 Key Vault 대신 `local.settings.json` 사용:

```json
{
  "IsEncrypted": false,
  "Values": {
    "FLEX_REFRESH_TOKEN": "actual_token_here",
    "BOT_APP_PASSWORD": "actual_password_here",
    "AZURE_CLIENT_SECRET": "actual_secret_here"
  }
}
```

⚠️ **주의**: `local.settings.json`은 절대 Git에 커밋하지 마세요!

## 참고 자료

- [Azure Key Vault 공식 문서](https://learn.microsoft.com/azure/key-vault/)
- [Function App에서 Key Vault 참조](https://learn.microsoft.com/azure/app-service/app-service-key-vault-references)
- [Managed Identity 개요](https://learn.microsoft.com/azure/active-directory/managed-identities-azure-resources/overview)
