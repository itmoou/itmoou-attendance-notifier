/**
 * Teams Bot Messages Endpoint
 * Teams Bot이 메시지를 받는 HTTP Trigger
 * 
 * 역할:
 * 1. 사용자가 처음 봇에게 메시지를 보낼 때 Conversation Reference 저장
 * 2. 간단한 응답 메시지 전송
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  ConversationReference,
  TurnContext,
  TeamsInfo,
  ActivityTypes,
  Activity,
} from 'botbuilder';
import {
  saveConversationReference,
  ensureTableExists,
} from '../../shared/storage/teamsConversationRepo';
import { validateBotEnvs } from '../../shared/utils/envUtil';

/**
 * Bot Adapter 생성 (Singleton)
 */
let botAdapter: CloudAdapter | null = null;

function getBotAdapter(): CloudAdapter {
  if (botAdapter) {
    return botAdapter;
  }

  const { appId, appPassword } = validateBotEnvs();

  const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication(
    {},
    {
      MicrosoftAppId: appId,
      MicrosoftAppPassword: appPassword,
      MicrosoftAppType: 'MultiTenant',
      MicrosoftAppTenantId: '',
    } as any
  );

  botAdapter = new CloudAdapter(botFrameworkAuthentication);
  
  // 오류 핸들러
  botAdapter.onTurnError = async (context, error) => {
    console.error('[BotAdapter] onTurnError:', error);
    await context.sendActivity('죄송합니다. 오류가 발생했습니다.');
  };
  
  return botAdapter;
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
    // 테이블 존재 확인
    await ensureTableExists();

    const adapter = getBotAdapter();

    // Request body와 헤더 추출
    const bodyText = await req.text();
    const activity: Activity = JSON.parse(bodyText);
    const authHeader = req.headers.get('authorization') || '';

    context.log(`[BotMessages] Activity Type: ${activity.type}`);

    // Node.js HTTP 스타일 req/res 객체 생성
    const nodeReq: any = {
      headers: Object.fromEntries(req.headers.entries()),
      body: activity,
      method: req.method,
      url: req.url,
    };

    const nodeRes: any = {
      end: () => {},
      send: () => {},
      status: (code: number) => {
        nodeRes.statusCode = code;
        return nodeRes;
      },
      statusCode: 200,
    };

    // CloudAdapter.process() 호출
    await adapter.process(nodeReq, nodeRes, async (turnContext: TurnContext) => {
      if (turnContext.activity.type === ActivityTypes.Message) {
        await handleMessage(turnContext, context);
      } else if (turnContext.activity.type === ActivityTypes.ConversationUpdate) {
        await handleConversationUpdate(turnContext, context);
      } else {
        context.log(`[BotMessages] 알 수 없는 Activity Type: ${turnContext.activity.type}`);
      }
    });

    return {
      status: nodeRes.statusCode || 200,
      body: '',
    };
  } catch (error: any) {
    context.error('[BotMessages] 오류:', error);
    
    if (error.statusCode === 401) {
      return { status: 401, body: 'Unauthorized' };
    }
    
    return {
      status: 500,
      body: JSON.stringify({ error: error.message }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
}

/**
 * 메시지 처리
 */
async function handleMessage(
  turnContext: TurnContext,
  context: InvocationContext
): Promise<void> {
  const text = turnContext.activity.text?.trim().toLowerCase() || '';
  
  const aadObjectId = turnContext.activity.from.aadObjectId || null;
  const teamsUserId = turnContext.activity.from.id || null;
  const userUpn = await getUserUpnFromContext(turnContext);

  context.log(`[BotMessages] 메시지: "${text}" from ${userUpn}`);

  const conversationRef = TurnContext.getConversationReference(turnContext.activity);
  
  if (aadObjectId || userUpn || teamsUserId) {
    await saveConversationReference(aadObjectId, userUpn, teamsUserId, conversationRef);
    context.log('[BotMessages] Conversation Reference 저장');
  }

  await turnContext.sendActivity(`
**근태알림(자동 알림) / 회신 불필요**

안녕하세요! 👋

저는 **근태 누락 알림 봇**입니다.

📌 이 봇은 다음과 같은 경우에 자동으로 메시지를 보냅니다:
- 출근 체크 누락 시 (11:05, 11:30)
- 퇴근 체크 누락 시 (20:30, 22:00)
- 당일 누적 요약 (22:10)

✅ 알림을 받을 준비가 완료되었습니다!
`.trim());
}

/**
 * Conversation Update 처리
 */
async function handleConversationUpdate(
  turnContext: TurnContext,
  context: InvocationContext
): Promise<void> {
  const membersAdded = turnContext.activity.membersAdded || [];
  const botId = turnContext.activity.recipient.id;

  for (const member of membersAdded) {
    if (member.id !== botId) {
      context.log(`[BotMessages] 새 사용자: ${member.name}`);
      
      const aadObjectId = turnContext.activity.from.aadObjectId || null;
      const teamsUserId = turnContext.activity.from.id || null;
      const userUpn = await getUserUpnFromContext(turnContext);
      
      const conversationRef = TurnContext.getConversationReference(turnContext.activity);
      
      if (aadObjectId || userUpn || teamsUserId) {
        await saveConversationReference(aadObjectId, userUpn, teamsUserId, conversationRef);
        context.log('[BotMessages] Conversation Reference 저장 (추가)');
      }

      await turnContext.sendActivity(`
**근태알림(자동 알림) / 회신 불필요**

안녕하세요! 👋

근태 누락 알림 봇에 오신 것을 환영합니다!

이제 출퇴근 체크 누락 시 자동으로 알림을 받게 됩니다.
`.trim());
    }
  }
}

/**
 * 사용자 UPN 추출
 */
async function getUserUpnFromContext(turnContext: TurnContext): Promise<string | null> {
  try {
    const member = await TeamsInfo.getMember(
      turnContext,
      turnContext.activity.from.id
    );
    
    return member.userPrincipalName || member.email || null;
  } catch (error) {
    console.error('[BotMessages] UPN 조회 실패:', error);
    return turnContext.activity.from.aadObjectId || null;
  }
}

// HTTP Trigger 등록
app.http('botMessages', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'bot/messages',
  handler: botMessagesHandler,
});

export default botMessagesHandler;
