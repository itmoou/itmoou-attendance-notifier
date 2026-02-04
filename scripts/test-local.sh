#!/bin/bash

# Flex 근태 누락 알림 시스템 - 로컬 테스트 스크립트
# Usage: ./scripts/test-local.sh [function-name]
# 예: ./scripts/test-local.sh checkCheckIn-first

set -e

# 색상 코드
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

FUNCTION_NAME=${1:-"all"}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Flex 근태 알림 시스템 로컬 테스트${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 1. 환경 변수 체크
echo -e "${YELLOW}[1/4] 환경 설정 확인 중...${NC}"

if [ ! -f ".env" ] && [ ! -f "local.settings.json" ]; then
    echo -e "${RED}Error: .env 또는 local.settings.json 파일이 없습니다.${NC}"
    echo -e "${YELLOW}local.settings.json.example을 참고하여 파일을 생성해주세요.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 환경 설정 확인 완료${NC}"
echo ""

# 2. 의존성 설치
echo -e "${YELLOW}[2/4] 의존성 설치 중...${NC}"
npm install
echo -e "${GREEN}✓ 의존성 설치 완료${NC}"
echo ""

# 3. TypeScript 빌드
echo -e "${YELLOW}[3/4] TypeScript 빌드 중...${NC}"
npm run build
echo -e "${GREEN}✓ 빌드 완료${NC}"
echo ""

# 4. 로컬 실행
echo -e "${YELLOW}[4/4] Azure Functions 로컬 실행 중...${NC}"
echo ""

if [ "$FUNCTION_NAME" = "all" ]; then
    echo -e "${GREEN}모든 Functions를 로컬에서 실행합니다.${NC}"
    echo -e "${YELLOW}Ctrl+C로 종료할 수 있습니다.${NC}"
    echo ""
    func start
else
    echo -e "${GREEN}Function: ${FUNCTION_NAME}${NC}"
    echo -e "${YELLOW}Ctrl+C로 종료할 수 있습니다.${NC}"
    echo ""
    func start --functions $FUNCTION_NAME
fi
