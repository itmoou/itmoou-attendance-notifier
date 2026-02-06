#!/bin/bash

# Bot 인증 테스트
# Azure Portal에서 BOT_APP_ID와 BOT_APP_PASSWORD를 확인하여 입력하세요

BOT_APP_ID="52a8b283-875d-45ed-8282-f275c652f498"
BOT_APP_PASSWORD="여기에_실제_패스워드_입력"

echo "Testing Bot Framework authentication..."
echo "Bot App ID: $BOT_APP_ID"

# Token 획득 시도
curl -X POST "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=$BOT_APP_ID&client_secret=$BOT_APP_PASSWORD&scope=https://api.botframework.com/.default" \
  -v 2>&1 | grep -E "access_token|error"

echo ""
echo "If you see 'access_token', authentication is working!"
echo "If you see 'error', BOT_APP_PASSWORD is wrong or expired!"
