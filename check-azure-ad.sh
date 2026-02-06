#!/bin/bash

echo "=========================================="
echo "Azure AD Bot 인증 진단 스크립트"
echo "=========================================="
echo ""

# 환경변수 확인
echo "📋 1. 환경변수 확인"
echo "-------------------------------------------"
if [ -z "$BOT_APP_ID" ]; then
  echo "❌ BOT_APP_ID: 설정되지 않음"
else
  echo "✅ BOT_APP_ID: $BOT_APP_ID"
fi

if [ -z "$BOT_APP_PASSWORD" ]; then
  echo "❌ BOT_APP_PASSWORD: 설정되지 않음"
else
  echo "✅ BOT_APP_PASSWORD: [설정됨] (길이: ${#BOT_APP_PASSWORD}자)"
fi
echo ""

# Bot 정보 요약
echo "📊 2. Bot 구성 정보"
echo "-------------------------------------------"
echo "Bot ID: 52a8b283-875d-45ed-8282-f275c652f498"
echo "Token Endpoint: https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token"
echo "Scope: https://api.botframework.com/.default"
echo "Messaging Endpoint: https://itmoou-attendance-func-ate3csagf3c4hyas.koreacentral-01.azurewebsites.net/api/bot/messages"
echo ""

# 토큰 획득 시도 (비밀번호가 설정된 경우)
if [ ! -z "$BOT_APP_ID" ] && [ ! -z "$BOT_APP_PASSWORD" ]; then
  echo "🔐 3. Bot Framework 토큰 획득 테스트"
  echo "-------------------------------------------"
  
  RESPONSE=$(curl -s -X POST \
    "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token" \
    -d "grant_type=client_credentials" \
    -d "client_id=$BOT_APP_ID" \
    -d "client_secret=$BOT_APP_PASSWORD" \
    -d "scope=https://api.botframework.com/.default")
  
  if echo "$RESPONSE" | grep -q "access_token"; then
    echo "✅ 토큰 획득 성공!"
    TOKEN_LENGTH=$(echo "$RESPONSE" | grep -o '"access_token":"[^"]*"' | head -1 | cut -d'"' -f4 | wc -c)
    echo "   토큰 길이: $TOKEN_LENGTH 자"
    echo ""
    echo "🎉 Bot Framework 인증이 정상 작동합니다!"
  else
    echo "❌ 토큰 획득 실패"
    echo ""
    echo "응답:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    echo ""
    
    # 오류 분석
    if echo "$RESPONSE" | grep -q "AADSTS700016"; then
      echo "⚠️  오류 분석: Application이 Azure AD에 등록되지 않음"
      echo ""
      echo "해결 방법:"
      echo "1. Azure Portal → Azure Active Directory → App registrations"
      echo "2. 'All applications'에서 '$BOT_APP_ID' 검색"
      echo "3. 앱이 없으면: 새로 생성 필요"
      echo "4. 앱이 있으면: Certificates & secrets에서 새 Secret 생성"
    elif echo "$RESPONSE" | grep -q "AADSTS7000215"; then
      echo "⚠️  오류 분석: Client Secret이 유효하지 않음"
      echo ""
      echo "해결 방법:"
      echo "1. Azure Portal → App registration → Certificates & secrets"
      echo "2. 기존 Secret 만료 확인"
      echo "3. 새 Client Secret 생성"
      echo "4. Function App 환경변수 BOT_APP_PASSWORD 업데이트"
    elif echo "$RESPONSE" | grep -q "unauthorized_client"; then
      echo "⚠️  오류 분석: Client 인증 오류"
      echo ""
      echo "해결 방법:"
      echo "1. Azure Bot Service → Configuration"
      echo "2. Microsoft App Type: Multi Tenant 확인"
      echo "3. Microsoft App ID 일치 확인"
    fi
  fi
else
  echo "⚠️  환경변수가 설정되지 않아 토큰 테스트를 건너뜁니다."
fi

echo ""
echo "=========================================="
echo "진단 완료"
echo "=========================================="
echo ""
echo "📝 다음 단계:"
echo "1. 위의 오류 메시지를 확인하세요"
echo "2. AZURE_AD_FIX_GUIDE.md 파일을 참조하세요"
echo "3. Azure Portal에서 설정을 확인/수정하세요"
echo ""
