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
    } as any // Type workaround for botbuilder ConfigurationServiceClientCredentialFactoryOptions
  );

  botAdapter = new CloudAdapter(botFrameworkAuthentication);
  
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

    // Response 상태와 body를 저장할 변수
    let responseStatus = 200;
    let responseBody: any = '';

    // Node.js 스타일의 Response 객체 생성
    const res = {
      status: (code: number) => {
        responseStatus = code;
        return res;
      },
      send: (body: any) => {
        responseBody = body;
        return res;
      },
      json: (obj: any) => {
        responseBody = JSON.stringify(obj);
        return res;
      },
      end: () => {
        return res;
      },
    };

    // CloudAdapter process 호출
    await adapter.process(req as any, res as any, async (turnContext: TurnContext) => {
      if (turnContext.activity.type === ActivityTypes.Message) {
        await handleMessage(turnContext, context);
      } else if (turnContext.activity.type === ActivityTypes.ConversationUpdate) {
        await handleConversationUpdate(turnContext, context);
      } else {
        context.log(`[BotMessages] 처리하지 않는 Activity Type: ${turnContext.activity.type}`);
      }
    });

    // CloudAdapter가 설정한 response 반환
    return {
      status: responseStatus,
      body: responseBody || '',
      headers: {
        'Content-Type': 'application/json',
      },
    };
  } catch (error: any) {
    context.error('[BotMessages] 처리 중 오류:', error);
    return {
      status: 500,
      body: JSON.stringify({
        error: error.message,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
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
  
  // 사용자 정보 추출
  const aadObjectId = turnContext.activity.from.aadObjectId || null;
  const teamsUserId = turnContext.activity.from.id || null;
  const userUpn = await getUserUpnFromContext(turnContext);

  context.log(`[BotMessages] 메시지 수신: "${text}" from AAD:${aadObjectId} UPN:${userUpn} TeamsID:${teamsUserId}`);

  // Conversation Reference 저장
  const conversationRef = TurnContext.getConversationReference(turnContext.activity);
  
  if (aadObjectId || userUpn || teamsUserId) {
    await saveConversationReference(aadObjectId, userUpn, teamsUserId, conversationRef);
    context.log(`[BotMessages] Conversation Reference 저장 완료`);
  } else {
    context.warn('[BotMessages] 사용자 식별자를 찾을 수 없습니다.');
  }

  // 간단한 응답
  const replyMessage = `
**근태알림(자동 알림) / 회신 불필요**

안녕하세요! 👋

저는 **근태 누락 알림 봇**입니다.

📌 이 봇은 다음과 같은 경우에 자동으로 메시지를 보냅니다:
- 출근 체크 누락 시 (11:05, 11:30)
- 퇴근 체크 누락 시 (20:30, 22:00)
- 당일 누적 요약 (22:10)

✅ 알림을 받을 준비가 완료되었습니다!
`.trim();

  await turnContext.sendActivity(replyMessage);
}

/**
 * Conversation Update 처리 (봇 추가/제거)
 */
async function handleConversationUpdate(
  turnContext: TurnContext,
  context: InvocationContext
): Promise<void> {
  const membersAdded = turnContext.activity.membersAdded || [];
  const botId = turnContext.activity.recipient.id;

  for (const member of membersAdded) {
    if (member.id !== botId) {
      // 사용자가 봇을 추가한 경우
      context.log(`[BotMessages] 새 사용자 추가: ${member.name}`);
      
      // 사용자 정보 추출
      const aadObjectId = turnContext.activity.from.aadObjectId || null;
      const teamsUserId = turnContext.activity.from.id || null;
      const userUpn = await getUserUpnFromContext(turnContext);
      
      // Conversation Reference 저장
      const conversationRef = TurnContext.getConversationReference(turnContext.activity);
      
      if (aadObjectId || userUpn || teamsUserId) {
        await saveConversationReference(aadObjectId, userUpn, teamsUserId, conversationRef);
        context.log(`[BotMessages] Conversation Reference 저장 (추가 이벤트)`);
      }

      // 환영 메시지
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
 * Turn Context로부터 사용자 UPN 추출
 */
async function getUserUpnFromContext(turnContext: TurnContext): Promise<string | null> {
  try {
    // Teams 컨텍스트에서 사용자 정보 조회
    const member = await TeamsInfo.getMember(
      turnContext,
      turnContext.activity.from.id
    );
    
    return member.userPrincipalName || member.email || null;
  } catch (error) {
    console.error('[BotMessages] 사용자 UPN 조회 실패:', error);
    
    // Fallback: activity에서 직접 추출 시도
    return turnContext.activity.from.aadObjectId || null;
  }
}

// Azure Functions HTTP Trigger 등록
app.http('botMessages', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'bot/messages',
  handler: botMessagesHandler,
});

export default botMessagesHandler;
