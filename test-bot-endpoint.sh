#!/bin/bash

echo "=== Testing Bot Endpoint with Real Teams Message ==="
echo ""

ENDPOINT="https://itmoou-attendance-func-ate3csagf3c4hyas.koreacentral-01.azurewebsites.net/api/bot/messages"

# Create a realistic Teams message payload
PAYLOAD=$(cat << 'PAYLOAD_END'
{
  "type": "message",
  "id": "test-msg-teams-001",
  "timestamp": "2026-02-06T06:00:00.000Z",
  "channelId": "msteams",
  "from": {
    "id": "29:1test-user-id",
    "name": "Test User",
    "aadObjectId": "test-aad-12345"
  },
  "conversation": {
    "id": "19:test-conversation-id",
    "tenantId": "test-tenant-id"
  },
  "recipient": {
    "id": "28:52a8b283-875d-45ed-8282-f275c652f498",
    "name": "근태알림"
  },
  "text": "안녕하세요",
  "serviceUrl": "https://smba.trafficmanager.net/apac/"
}
PAYLOAD_END
)

echo "Sending POST request..."
echo "Endpoint: $ENDPOINT"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token-teams-123" \
  -d "$PAYLOAD")

HTTP_BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')
HTTP_STATUS=$(echo "$RESPONSE" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')

echo "HTTP Status: $HTTP_STATUS"
echo "Response Body:"
echo "$HTTP_BODY" | jq '.' 2>/dev/null || echo "$HTTP_BODY"
echo ""
echo "=== Test Complete ==="
