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
import sharepointClient from '../../shared/sharepointClient';

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

  // 명령어 처리
  let replyText = '';

  const lowerText = text.toLowerCase();

  if (lowerText.includes('리포트') || lowerText.includes('근태')) {
    // 근태 리포트 명령어
    replyText = await handleAttendanceReportCommand(context);
  } else if (lowerText.includes('휴가')) {
    // 휴가 현황 명령어
    replyText = await handleVacationReportCommand(context);
  } else if (lowerText.includes('도움말') || lowerText.includes('help') || lowerText.includes('명령어')) {
    // 도움말 명령어
    replyText = getHelpMessage();
  } else {
    // 기본 환영 메시지
    replyText = getWelcomeMessage();
  }

  await sendActivity(activity, {
    type: 'message',
    text: replyText,
    from: activity.recipient,
    recipient: activity.from,
    conversation: activity.conversation,
  });
}

/**
 * 환영 메시지
 */
function getWelcomeMessage(): string {
  return `
**근태알림(자동 알림) / 회신 불필요**

안녕하세요! 👋

저는 **근태 누락 알림 봇**입니다.

📌 이 봇은 다음과 같은 경우에 자동으로 메시지를 보냅니다:
- 출근 체크 누락 시 (11:05, 11:30)
- 퇴근 체크 누락 시 (20:30, 22:00)
- 당일 누적 요약 (22:10)

💡 **사용 가능한 명령어:**
- "리포트" 또는 "근태리포트" - 최근 근태 리포트 보기
- "휴가" 또는 "휴가현황" - 최근 휴가 현황 보기
- "도움말" - 명령어 목록 보기

✅ 알림을 받을 준비가 완료되었습니다!
`.trim();
}

/**
 * 도움말 메시지
 */
function getHelpMessage(): string {
  return `
**📋 사용 가능한 명령어**

🔍 **문서 검색:**
- "리포트" 또는 "근태리포트" - 최근 근태 리포트 목록
- "휴가" 또는 "휴가현황" - 최근 휴가 현황 목록

ℹ️ **정보:**
- "도움말" 또는 "help" - 이 도움말 표시

⏰ **자동 알림:**
이 봇은 다음과 같은 경우에 자동으로 알림을 보냅니다:
- 출근 체크 누락 (11:05, 11:30)
- 퇴근 체크 누락 (20:30, 22:00)
- 당일 누적 요약 (22:10)
`.trim();
}

/**
 * 근태 리포트 명령어 처리
 */
async function handleAttendanceReportCommand(context: InvocationContext): Promise<string> {
  try {
    context.log('[BotMessages] 근태 리포트 조회 시작');

    // SharePoint에서 최근 근태 리포트 파일 조회
    const files = await sharepointClient.listFiles('근태 리포트');

    if (files.length === 0) {
      return `
📊 **근태 리포트**

현재 저장된 근태 리포트가 없습니다.

리포트는 매일 자동으로 생성되어 SharePoint에 저장됩니다.
`.trim();
    }

    // 최근 5개 파일만 표시
    const recentFiles = files
      .sort((a, b) => {
        const dateA = new Date(a.lastModifiedDateTime || 0);
        const dateB = new Date(b.lastModifiedDateTime || 0);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 5);

    const siteUrl = 'https://itmoou.sharepoint.com/sites/itmoou-groupware';
    const folderUrl = `${siteUrl}/Shared%20Documents/%EA%B7%BC%ED%83%9C%20%EB%A6%AC%ED%8F%AC%ED%8A%B8`;

    let message = `
📊 **최근 근태 리포트**

`;

    recentFiles.forEach((file, idx) => {
      const fileName = file.name || '알 수 없음';
      const fileUrl = file.webUrl || folderUrl;
      message += `${idx + 1}. [${fileName}](${fileUrl})\n`;
    });

    message += `\n📁 [SharePoint 폴더 열기](${folderUrl})`;

    return message.trim();
  } catch (error: any) {
    context.error('[BotMessages] 근태 리포트 조회 실패:', error);
    return `
❌ **오류**

근태 리포트를 조회하는 중 오류가 발생했습니다.
잠시 후 다시 시도해주세요.
`.trim();
  }
}

/**
 * 휴가 현황 명령어 처리
 */
async function handleVacationReportCommand(context: InvocationContext): Promise<string> {
  try {
    context.log('[BotMessages] 휴가 현황 조회 시작');

    // SharePoint에서 최근 휴가 현황 파일 조회
    const files = await sharepointClient.listFiles('휴가 현황');

    if (files.length === 0) {
      return `
📅 **휴가 현황**

현재 저장된 휴가 현황이 없습니다.

휴가 현황은 매주 월요일 자동으로 생성되어 SharePoint에 저장됩니다.
`.trim();
    }

    // 최근 5개 파일만 표시
    const recentFiles = files
      .sort((a, b) => {
        const dateA = new Date(a.lastModifiedDateTime || 0);
        const dateB = new Date(b.lastModifiedDateTime || 0);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 5);

    const siteUrl = 'https://itmoou.sharepoint.com/sites/itmoou-groupware';
    const folderUrl = `${siteUrl}/Shared%20Documents/%ED%9C%B4%EA%B0%80%20%ED%98%84%ED%99%A9`;

    let message = `
📅 **최근 휴가 현황**

`;

    recentFiles.forEach((file, idx) => {
      const fileName = file.name || '알 수 없음';
      const fileUrl = file.webUrl || folderUrl;
      message += `${idx + 1}. [${fileName}](${fileUrl})\n`;
    });

    message += `\n📁 [SharePoint 폴더 열기](${folderUrl})`;

    return message.trim();
  } catch (error: any) {
    context.error('[BotMessages] 휴가 현황 조회 실패:', error);
    return `
❌ **오류**

휴가 현황을 조회하는 중 오류가 발생했습니다.
잠시 후 다시 시도해주세요.
`.trim();
  }
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
