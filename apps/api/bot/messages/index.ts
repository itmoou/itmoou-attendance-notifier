/**
 * Teams Bot Messages Endpoint  
 * Bot Framework REST API 직접 호출 (SDK 우회)
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import axios from 'axios';
import crypto from 'crypto';
import {
  saveConversationReference,
  ensureTableExists,
} from '../../shared/storage/teamsConversationRepo';
import { validateBotEnvs } from '../../shared/utils/envUtil';

interface Activity {
  type: string;
  id?: string;
  timestamp?: string;
  channelId?: string;
  from?: {
    id: string;
    name?: string;
    aadObjectId?: string;
  };
  conversation?: {
    id: string;
    isGroup?: boolean;
    conversationType?: string;
    tenantId?: string;
  };
  recipient?: {
    id: string;
    name?: string;
  };
  text?: string;
  attachments?: any[];
  entities?: any[];
  channelData?: any;
  serviceUrl?: string;
  membersAdded?: Array<{ id: string; name?: string }>;
  membersRemoved?: Array<{ id: string; name?: string }>;
}

interface ConversationReference {
  activityId?: string;
  user?: { id: string; name?: string; aadObjectId?: string };
  bot?: { id: string; name?: string };
  conversation?: { id: string; isGroup?: boolean; conversationType?: string; tenantId?: string };
  channelId?: string;
  serviceUrl?: string;
}

/**
 * Bot Framework 인증 토큰 캐시
 */
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getBotToken(): Promise<string> {
  const now = Date.now();
  
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.token;
  }

  const { appId, appPassword, tenantId } = validateBotEnvs();

  // Tenant ID가 있으면 Single-tenant, 없으면 Multi-tenant (Bot Framework 기본)
  const tokenEndpoint = tenantId
    ? `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
    : 'https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token';

  const response = await axios.post(
    tokenEndpoint,
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: appId,
      client_secret: appPassword,
      scope: 'https://api.botframework.com/.default',
    }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  const token = response.data.access_token;
  const expiresIn = response.data.expires_in || 3600;

  cachedToken = {
    token,
    expiresAt: now + (expiresIn - 300) * 1000, // 5분 일찍 갱신
  };

  return token;
}

/**
 * Activity 서명 검증 (JWT)
 */
function verifyActivitySignature(req: HttpRequest): boolean {
  // 프로덕션에서는 JWT 검증 필요
  // 현재는 Bot Framework의 서명을 신뢰
  const authHeader = req.headers.get('authorization');
  return !!authHeader && authHeader.startsWith('Bearer ');
}

/**
 * Bot Framework에 응답 전송
 */
async function sendActivity(activity: Activity, replyActivity: Partial<Activity>): Promise<void> {
  if (!activity.serviceUrl || !activity.conversation?.id) {
    throw new Error('Invalid activity: missing serviceUrl or conversation.id');
  }

  const token = await getBotToken();
  
  // serviceUrl의 trailing slash 제거
  const serviceUrl = activity.serviceUrl.replace(/\/$/, '');
  
  // Reply to activity (활동에 대한 답장)
  const url = activity.id
    ? `${serviceUrl}/v3/conversations/${activity.conversation.id}/activities/${activity.id}`
    : `${serviceUrl}/v3/conversations/${activity.conversation.id}/activities`;

  await axios.post(url, replyActivity, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Conversation Reference 생성
 */
function getConversationReference(activity: Activity): ConversationReference {
  return {
    activityId: activity.id,
    user: activity.from,
    bot: activity.recipient,
    conversation: activity.conversation,
    channelId: activity.channelId,
    serviceUrl: activity.serviceUrl,
  };
}

/**
 * Bot Messages Handler
 */
async function botMessagesHandler(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('[BotMessages] 요청 수신');

  try {
    // 서명 검증
    if (!verifyActivitySignature(req)) {
      context.warn('[BotMessages] 서명 검증 실패');
      return { status: 401, body: 'Unauthorized' };
    }

    await ensureTableExists();

    const bodyText = await req.text();
    const activity: Activity = JSON.parse(bodyText);

    context.log(`[BotMessages] Activity type: ${activity.type}`);

    // Activity 타입별 처리
    if (activity.type === 'message') {
      await handleMessage(activity, context);
    } else if (activity.type === 'conversationUpdate') {
      await handleConversationUpdate(activity, context);
    }

    return {
      status: 200,
      body: JSON.stringify({ status: 'ok' }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error: any) {
    context.error('[BotMessages] 오류:', error);
    
    return {
      status: 500,
      body: JSON.stringify({ error: error.message }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
}

async function handleMessage(
  activity: Activity,
  context: InvocationContext
): Promise<void> {
  const text = activity.text?.trim() || '';
  const aadObjectId = activity.from?.aadObjectId || null;
  const teamsUserId = activity.from?.id || null;
  const userUpn = aadObjectId; // 간단히 aadObjectId 사용

  context.log(`[BotMessages] 메시지: "${text}" from ${userUpn}`);

  const conversationRef = getConversationReference(activity);
  
  if (aadObjectId || userUpn || teamsUserId) {
    await saveConversationReference(aadObjectId, userUpn, teamsUserId, conversationRef as any);
    context.log('[BotMessages] Conversation Reference 저장');
  }

  const replyText = `
**근태알림(자동 알림) / 회신 불필요**

안녕하세요! 👋

저는 **근태 누락 알림 봇**입니다.

📌 이 봇은 다음과 같은 경우에 자동으로 메시지를 보냅니다:
- 출근 체크 누락 시 (11:05, 11:30)
- 퇴근 체크 누락 시 (20:30, 22:00)
- 당일 누적 요약 (22:10)

✅ 알림을 받을 준비가 완료되었습니다!
`.trim();

  await sendActivity(activity, {
    type: 'message',
    text: replyText,
    from: activity.recipient,
    recipient: activity.from,
    conversation: activity.conversation,
  });
}

async function handleConversationUpdate(
  activity: Activity,
  context: InvocationContext
): Promise<void> {
  const membersAdded = activity.membersAdded || [];
  const botId = activity.recipient?.id;

  for (const member of membersAdded) {
    if (member.id !== botId) {
      context.log(`[BotMessages] 새 사용자: ${member.name}`);
      
      const aadObjectId = activity.from?.aadObjectId || null;
      const teamsUserId = activity.from?.id || null;
      const userUpn = aadObjectId;
      
      const conversationRef = getConversationReference(activity);
      
      if (aadObjectId || userUpn || teamsUserId) {
        await saveConversationReference(aadObjectId, userUpn, teamsUserId, conversationRef as any);
      }

      const welcomeText = `
**근태알림(자동 알림) / 회신 불필요**

안녕하세요! 👋

근태 누락 알림 봇에 오신 것을 환영합니다!

이제 출퇴근 체크 누락 시 자동으로 알림을 받게 됩니다.
`.trim();

      await sendActivity(activity, {
        type: 'message',
        text: welcomeText,
        from: activity.recipient,
        recipient: activity.from,
        conversation: activity.conversation,
      });
    }
  }
}



app.http('botMessages', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'bot/messages',
  handler: botMessagesHandler,
});

export default botMessagesHandler;
