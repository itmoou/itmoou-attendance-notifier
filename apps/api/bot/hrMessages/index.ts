/**
 * HR Bot Messages Endpoint
 * HR 관리자 전용 Bot - 문서 검색 및 관리 기능
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import axios from 'axios';
import {
  saveConversationReference,
  ensureTableExists,
} from '../../shared/storage/teamsConversationRepo';
import {
  ensurePermissionTableExists,
  addAuthorizedUser,
  removeAuthorizedUser,
  listAuthorizedUsers,
  isUserAuthorizedInStorage,
  isSuperAdmin,
} from '../../shared/storage/hrBotPermissionRepo';
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
let cachedHrBotToken: { token: string; expiresAt: number } | null = null;

async function getHrBotToken(): Promise<string> {
  const now = Date.now();

  if (cachedHrBotToken && cachedHrBotToken.expiresAt > now) {
    return cachedHrBotToken.token;
  }

  const appId = process.env.HR_BOT_APP_ID;
  const appPassword = process.env.HR_BOT_APP_PASSWORD;
  const tenantId = process.env.HR_BOT_TENANT_ID || process.env.BOT_TENANT_ID;

  if (!appId || !appPassword) {
    throw new Error('HR_BOT_APP_ID 또는 HR_BOT_APP_PASSWORD가 설정되지 않았습니다.');
  }

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

  cachedHrBotToken = {
    token,
    expiresAt: now + (expiresIn - 300) * 1000,
  };

  return token;
}

/**
 * Activity 서명 검증
 */
function verifyActivitySignature(req: HttpRequest): boolean {
  const authHeader = req.headers.get('authorization');
  return !!authHeader && authHeader.startsWith('Bearer ');
}

/**
 * 사용자 이메일 추출
 */
async function getUserEmail(activity: Activity, context: InvocationContext): Promise<string | null> {
  // channelData에서 이메일 추출 시도 (Teams의 경우)
  let userEmail: string | null = null;
  try {
    if (activity.channelData?.user?.email) {
      userEmail = activity.channelData.user.email.toLowerCase();
    } else if (activity.channelData?.teamsChannelData?.user?.email) {
      userEmail = activity.channelData.teamsChannelData.user.email.toLowerCase();
    }
  } catch (e) {
    context.log('[HRBotMessages] channelData에서 이메일 추출 실패');
  }

  // channelData에 이메일이 없으면 AAD Object ID로 Graph API 조회
  if (!userEmail && activity.from?.aadObjectId) {
    try {
      const { getGraphAccessToken } = await import('../../shared/graphClient');
      const token = await getGraphAccessToken();

      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/users/${activity.from.aadObjectId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.mail) {
        userEmail = response.data.mail.toLowerCase();
        context.log(`[HRBotMessages] Graph API로 이메일 조회: ${userEmail}`);
      } else if (response.data.userPrincipalName) {
        userEmail = response.data.userPrincipalName.toLowerCase();
        context.log(`[HRBotMessages] Graph API로 UPN 조회: ${userEmail}`);
      }
    } catch (error) {
      context.error('[HRBotMessages] Graph API 이메일 조회 실패:', error);
    }
  }

  return userEmail;
}

/**
 * 사용자 권한 확인
 * 1. Super Admin 체크 (환경 변수)
 * 2. Table Storage 권한 체크
 */
async function isUserAuthorized(activity: Activity, context: InvocationContext): Promise<boolean> {
  const userEmail = await getUserEmail(activity, context);
  const aadObjectId = activity.from?.aadObjectId?.toLowerCase();
  const userName = activity.from?.name?.toLowerCase();

  context.log(`[HRBotMessages] 사용자 확인 - AAD: ${aadObjectId}, Email: ${userEmail}, Name: ${userName}`);

  // Super Admin 체크
  if (userEmail && isSuperAdmin(userEmail)) {
    context.log(`[HRBotMessages] Super Admin 접근: ${userEmail}`);
    return true;
  }

  // Table Storage 권한 체크
  if (userEmail) {
    const isAuthorized = await isUserAuthorizedInStorage(userEmail);
    if (isAuthorized) {
      context.log(`[HRBotMessages] 권한 있는 사용자 접근: ${userEmail}`);
      return true;
    }
  }

  context.warn(`[HRBotMessages] 권한 없는 사용자 접근 시도 - Email: ${userEmail}`);
  return false;
}

/**
 * Bot Framework에 응답 전송
 */
async function sendActivity(activity: Activity, replyActivity: Partial<Activity>): Promise<void> {
  if (!activity.serviceUrl || !activity.conversation?.id) {
    throw new Error('Invalid activity: missing serviceUrl or conversation.id');
  }

  const token = await getHrBotToken();

  const serviceUrl = activity.serviceUrl.replace(/\/$/, '');

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
 * HR Bot Messages Handler
 */
async function hrBotMessagesHandler(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('[HRBotMessages] 요청 수신');

  try {
    // 서명 검증
    if (!verifyActivitySignature(req)) {
      context.warn('[HRBotMessages] 서명 검증 실패');
      return { status: 401, body: 'Unauthorized' };
    }

    await ensureTableExists();
    await ensurePermissionTableExists();

    const bodyText = await req.text();
    const activity: Activity = JSON.parse(bodyText);

    context.log(`[HRBotMessages] Activity type: ${activity.type}`);

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
    context.error('[HRBotMessages] 오류:', error);

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
  const userUpn = aadObjectId;
  const userEmail = await getUserEmail(activity, context);

  context.log(`[HRBotMessages] 메시지: "${text}" from ${userEmail || userUpn}`);

  // 사용자 권한 확인
  const isAuthorized = await isUserAuthorized(activity, context);
  if (!isAuthorized) {
    const unauthorizedText = `
🔒 **접근 권한이 없습니다**

죄송합니다. 이 봇은 HR 관리자만 사용할 수 있습니다.

접근 권한이 필요하시면 IT 관리자에게 문의해주세요.
`.trim();

    await sendActivity(activity, {
      type: 'message',
      text: unauthorizedText,
      from: activity.recipient,
      recipient: activity.from,
      conversation: activity.conversation,
    });
    return;
  }

  const conversationRef = getConversationReference(activity);

  if (aadObjectId || userUpn || teamsUserId) {
    await saveConversationReference(aadObjectId, userUpn, teamsUserId, conversationRef as any);
    context.log('[HRBotMessages] Conversation Reference 저장');
  }

  // 명령어 처리
  let replyText = '';
  const lowerText = text.toLowerCase();

  // Super Admin 여부 확인
  const isSuperAdminUser = !!(userEmail && isSuperAdmin(userEmail));

  // Super Admin 전용 명령어
  if (isSuperAdminUser) {
    if (lowerText.startsWith('권한부여')) {
      replyText = await handleGrantPermissionCommand(text, userEmail!, context);
    } else if (lowerText.startsWith('권한제거')) {
      replyText = await handleRevokePermissionCommand(text, context);
    } else if (lowerText === '권한목록') {
      replyText = await handleListPermissionsCommand(context);
    }
  }

  // 일반 명령어
  if (!replyText) {
    if (lowerText.includes('리포트') || lowerText.includes('근태')) {
      // 근태 리포트 명령어
      replyText = await handleAttendanceReportCommand(context);
    } else if (lowerText.includes('휴가')) {
      // 휴가 현황 명령어
      replyText = await handleVacationReportCommand(context);
    } else if (lowerText.includes('도움말') || lowerText.includes('help') || lowerText.includes('명령어')) {
      // 도움말 명령어
      replyText = getHelpMessage(isSuperAdminUser);
    } else {
      // 기본 환영 메시지
      replyText = getWelcomeMessage(isSuperAdminUser);
    }
  }

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
      context.log(`[HRBotMessages] 새 사용자: ${member.name}`);

      // 사용자 권한 확인
      const isAuthorized = await isUserAuthorized(activity, context);
      if (!isAuthorized) {
        const unauthorizedText = `
🔒 **접근 권한이 없습니다**

죄송합니다. 이 봇은 HR 관리자만 사용할 수 있습니다.

접근 권한이 필요하시면 IT 관리자에게 문의해주세요.
`.trim();

        await sendActivity(activity, {
          type: 'message',
          text: unauthorizedText,
          from: activity.recipient,
          recipient: activity.from,
          conversation: activity.conversation,
        });
        return;
      }

      const aadObjectId = activity.from?.aadObjectId || null;
      const teamsUserId = activity.from?.id || null;
      const userUpn = aadObjectId;
      const userEmail = await getUserEmail(activity, context);

      const conversationRef = getConversationReference(activity);

      if (aadObjectId || userUpn || teamsUserId) {
        await saveConversationReference(aadObjectId, userUpn, teamsUserId, conversationRef as any);
      }

      const isSuperAdminUser = !!(userEmail && isSuperAdmin(userEmail));
      const welcomeText = getWelcomeMessage(isSuperAdminUser);

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

/**
 * 환영 메시지
 */
function getWelcomeMessage(isSuperAdminUser: boolean = false): string {
  let message = `
**ITMOOU HR 관리 봇**

안녕하세요! 👋

저는 **HR 관리자 전용 문서 관리 봇**입니다.

📊 **사용 가능한 기능:**
- 근태 리포트 조회
- 휴가 현황 조회
- SharePoint 문서 링크 제공

💡 **명령어:**
- "리포트" 또는 "근태리포트" - 최근 근태 리포트 보기
- "휴가" 또는 "휴가현황" - 최근 휴가 현황 보기
- "도움말" - 명령어 목록 보기`;

  if (isSuperAdminUser) {
    message += `

🔧 **관리자 명령어:**
- "권한부여 user@itmoou.com" - 사용자 권한 부여
- "권한제거 user@itmoou.com" - 사용자 권한 제거
- "권한목록" - 권한 있는 사용자 목록 보기`;
  }

  message += `

🔒 이 봇은 HR 관리자만 사용할 수 있습니다.`;

  return message.trim();
}

/**
 * 도움말 메시지
 */
function getHelpMessage(isSuperAdminUser: boolean = false): string {
  let message = `
**📋 HR Bot 사용 가능한 명령어**

🔍 **문서 검색:**
- "리포트" 또는 "근태리포트" - 최근 근태 리포트 목록
- "휴가" 또는 "휴가현황" - 최근 휴가 현황 목록

ℹ️ **정보:**
- "도움말" 또는 "help" - 이 도움말 표시

📊 **제공 기능:**
- SharePoint에 저장된 근태 리포트 조회
- SharePoint에 저장된 휴가 현황 조회
- 직접 링크 제공으로 빠른 접근`;

  if (isSuperAdminUser) {
    message += `

🔧 **관리자 전용 명령어:**
- "권한부여 user@itmoou.com" - 사용자에게 봇 사용 권한 부여
- "권한제거 user@itmoou.com" - 사용자의 봇 사용 권한 제거
- "권한목록" - 현재 권한이 있는 모든 사용자 목록 보기

💡 **권한 관리 예시:**
\`\`\`
권한부여 kim@itmoou.com
권한제거 lee@itmoou.com
권한목록
\`\`\``;
  }

  message += `

🔒 이 봇은 HR 관리자 전용입니다.`;

  return message.trim();
}

/**
 * 권한 부여 명령어 처리 (Super Admin 전용)
 */
async function handleGrantPermissionCommand(
  text: string,
  grantedBy: string,
  context: InvocationContext
): Promise<string> {
  try {
    // "권한부여 user@itmoou.com" 형식에서 이메일 추출
    const parts = text.trim().split(/\s+/);
    if (parts.length < 2) {
      return `
❌ **사용법 오류**

올바른 사용법: \`권한부여 user@itmoou.com\`

예시:
\`\`\`
권한부여 kim@itmoou.com
\`\`\`
`.trim();
    }

    const targetEmail = parts[1].trim().toLowerCase();

    // 이메일 형식 간단 검증
    if (!targetEmail.includes('@')) {
      return `
❌ **이메일 형식 오류**

올바른 이메일 주소를 입력해주세요.

예시: \`권한부여 kim@itmoou.com\`
`.trim();
    }

    await addAuthorizedUser(targetEmail, grantedBy);

    return `
✅ **권한 부여 완료**

사용자: ${targetEmail}
부여자: ${grantedBy}

해당 사용자가 이제 HR Bot을 사용할 수 있습니다.
`.trim();
  } catch (error: any) {
    context.error('[HRBotMessages] 권한 부여 실패:', error);
    return `
❌ **오류**

권한 부여 중 오류가 발생했습니다.
잠시 후 다시 시도해주세요.
`.trim();
  }
}

/**
 * 권한 제거 명령어 처리 (Super Admin 전용)
 */
async function handleRevokePermissionCommand(
  text: string,
  context: InvocationContext
): Promise<string> {
  try {
    // "권한제거 user@itmoou.com" 형식에서 이메일 추출
    const parts = text.trim().split(/\s+/);
    if (parts.length < 2) {
      return `
❌ **사용법 오류**

올바른 사용법: \`권한제거 user@itmoou.com\`

예시:
\`\`\`
권한제거 kim@itmoou.com
\`\`\`
`.trim();
    }

    const targetEmail = parts[1].trim().toLowerCase();

    await removeAuthorizedUser(targetEmail);

    return `
✅ **권한 제거 완료**

사용자: ${targetEmail}

해당 사용자의 HR Bot 접근 권한이 제거되었습니다.
`.trim();
  } catch (error: any) {
    context.error('[HRBotMessages] 권한 제거 실패:', error);
    return `
❌ **오류**

권한 제거 중 오류가 발생했습니다.
잠시 후 다시 시도해주세요.
`.trim();
  }
}

/**
 * 권한 목록 조회 명령어 처리 (Super Admin 전용)
 */
async function handleListPermissionsCommand(context: InvocationContext): Promise<string> {
  try {
    const users = await listAuthorizedUsers();

    if (users.length === 0) {
      return `
📋 **권한 있는 사용자 목록**

현재 권한이 부여된 사용자가 없습니다.

\`권한부여 user@itmoou.com\` 명령어로 사용자를 추가할 수 있습니다.
`.trim();
    }

    let message = `
📋 **권한 있는 사용자 목록** (총 ${users.length}명)

`;

    users.forEach((user, idx) => {
      const grantedAt = new Date(user.grantedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      message += `${idx + 1}. ${user.email}\n   - 부여자: ${user.grantedBy}\n   - 부여일: ${grantedAt}\n\n`;
    });

    message += `💡 사용자 제거: \`권한제거 user@itmoou.com\``;

    return message.trim();
  } catch (error: any) {
    context.error('[HRBotMessages] 권한 목록 조회 실패:', error);
    return `
❌ **오류**

권한 목록을 조회하는 중 오류가 발생했습니다.
잠시 후 다시 시도해주세요.
`.trim();
  }
}

/**
 * 근태 리포트 명령어 처리
 */
async function handleAttendanceReportCommand(context: InvocationContext): Promise<string> {
  try {
    context.log('[HRBotMessages] 근태 리포트 조회 시작');

    const files = await sharepointClient.listFiles('근태 리포트');

    if (files.length === 0) {
      return `
📊 **근태 리포트**

현재 저장된 근태 리포트가 없습니다.

리포트는 매일 자동으로 생성되어 SharePoint에 저장됩니다.
`.trim();
    }

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
    context.error('[HRBotMessages] 근태 리포트 조회 실패:', error);
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
    context.log('[HRBotMessages] 휴가 현황 조회 시작');

    const files = await sharepointClient.listFiles('휴가 현황');

    if (files.length === 0) {
      return `
📅 **휴가 현황**

현재 저장된 휴가 현황이 없습니다.

휴가 현황은 매주 월요일 자동으로 생성되어 SharePoint에 저장됩니다.
`.trim();
    }

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
    context.error('[HRBotMessages] 휴가 현황 조회 실패:', error);
    return `
❌ **오류**

휴가 현황을 조회하는 중 오류가 발생했습니다.
잠시 후 다시 시도해주세요.
`.trim();
  }
}

app.http('hrBotMessages', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'bot/hr-messages',
  handler: hrBotMessagesHandler,
});

export default hrBotMessagesHandler;
