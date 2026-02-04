#!/bin/bash

# Flex 근태 누락 알림 시스템 - 배포 스크립트
# Usage: ./scripts/deploy.sh [환경]
# 예: ./scripts/deploy.sh production

set -e

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 환경 변수
ENVIRONMENT=${1:-"production"}
RESOURCE_GROUP="rg-flex-attendance-${ENVIRONMENT}"
FUNCTION_APP_NAME="func-flex-attendance-${ENVIRONMENT}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Flex 근태 알림 시스템 배포${NC}"
echo -e "${GREEN}환경: ${ENVIRONMENT}${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 1. 사전 체크
echo -e "${YELLOW}[1/6] 사전 체크 중...${NC}"

if ! command -v az &> /dev/null; then
    echo -e "${RED}Error: Azure CLI가 설치되어 있지 않습니다.${NC}"
    exit 1
fi

if ! command -v func &> /dev/null; then
    echo -e "${RED}Error: Azure Functions Core Tools가 설치되어 있지 않습니다.${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js가 설치되어 있지 않습니다.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 모든 도구가 설치되어 있습니다.${NC}"
echo ""

# 2. Azure 로그인 확인
echo -e "${YELLOW}[2/6] Azure 로그인 확인 중...${NC}"
az account show &> /dev/null || {
    echo -e "${YELLOW}Azure에 로그인이 필요합니다.${NC}"
    az login
}
echo -e "${GREEN}✓ Azure 로그인 완료${NC}"
echo ""

# 3. 의존성 설치
echo -e "${YELLOW}[3/6] 의존성 설치 중...${NC}"
npm ci
echo -e "${GREEN}✓ 의존성 설치 완료${NC}"
echo ""

# 4. TypeScript 빌드
echo -e "${YELLOW}[4/6] TypeScript 빌드 중...${NC}"
npm run build
echo -e "${GREEN}✓ 빌드 완료${NC}"
echo ""

# 5. Function App 존재 여부 확인
echo -e "${YELLOW}[5/6] Function App 확인 중...${NC}"
if az functionapp show --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
    echo -e "${GREEN}✓ Function App이 존재합니다: ${FUNCTION_APP_NAME}${NC}"
else
    echo -e "${RED}Error: Function App이 존재하지 않습니다: ${FUNCTION_APP_NAME}${NC}"
    echo -e "${YELLOW}먼저 Azure에서 Function App을 생성해주세요.${NC}"
    exit 1
fi
echo ""

# 6. 배포
echo -e "${YELLOW}[6/6] Azure Functions에 배포 중...${NC}"
func azure functionapp publish $FUNCTION_APP_NAME

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}배포 완료!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${GREEN}다음 명령어로 로그를 확인하세요:${NC}"
echo -e "  az webapp log tail --name ${FUNCTION_APP_NAME} --resource-group ${RESOURCE_GROUP}"
echo ""
echo -e "${GREEN}Function App URL:${NC}"
echo -e "  https://${FUNCTION_APP_NAME}.azurewebsites.net"
echo ""
