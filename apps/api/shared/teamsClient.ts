/**
 * Teams Bot Client
 * Teams Bot을 사용한 Proactive Message 전송
 * 
 * ⚠️ 중요: Microsoft Graph API 방식이 아닌 Bot Framework 사용
 */

import {
  CloudAdapter,
  ConversationReference,
  TurnContext,
  TeamsInfo,
} from 'botbuilder';
import {
  getConversationReference,
  getConversationReferences,
} from './storage/teamsConversationRepo';

/**
 * Bot Adapter 생성
 */
function getBotAdapter(): CloudAdapter {
  const appId = process.env.BOT_APP_ID;
  const appPassword = process.env.BOT_APP_PASSWORD;

  if (!appId || !appPassword) {
    throw new Error('BOT_APP_ID 또는 BOT_APP_PASSWORD 환경변수가 설정되지 않았습니다.');
  }

  return new CloudAdapter({
    appId,
    appPassword,
  });
}

/**
 * 단일 사용자에게 Proactive Message 전송
 * @param userUpn 사용자 UPN (예: ymsim@itmoou.com)
 * @param message 전송할 메시지 (HTML 지원)
 */
export async function sendProactiveMessage(
  userUpn: string,
  message: string
): Promise<void> {
  try {
    console.log(`[TeamsBot] Proactive Message 전송 시작: ${userUpn}`);

    // Conversation Reference 조회
    const conversationRef = await getConversationReference(userUpn);
    
    if (!conversationRef) {
      console.warn(`[TeamsBot] Conversation Reference 없음: ${userUpn}`);
      console.warn(`[TeamsBot] 사용자가 먼저 봇에게 메시지를 보내야 합니다.`);
      return;
    }

    const adapter = getBotAdapter();

    // Proactive Message 전송
    await adapter.continueConversationAsync(
      process.env.BOT_APP_ID!,
      conversationRef as ConversationReference,
      async (turnContext: TurnContext) => {
        await turnContext.sendActivity({
          type: 'message',
          text: message,
          textFormat: 'plain',
        });
        console.log(`[TeamsBot] 메시지 전송 완료: ${userUpn}`);
      }
    );
  } catch (error) {
    console.error(`[TeamsBot] 메시지 전송 실패: ${userUpn}`, error);
    throw error;
  }
}

/**
 * 여러 사용자에게 일괄 Proactive Message 전송
 * @param messages UPN과 메시지 쌍의 배열
 */
export async function sendBulkProactiveMessages(
  messages: Array<{ userUpn: string; message: string }>
): Promise<void> {
  console.log(`[TeamsBot] 일괄 메시지 전송 시작: ${messages.length}명`);

  const results = await Promise.allSettled(
    messages.map((msg) => sendProactiveMessage(msg.userUpn, msg.message))
  );

  const successCount = results.filter((r) => r.status === 'fulfilled').length;
  const failedCount = results.filter((r) => r.status === 'rejected').length;

  console.log(`[TeamsBot] 일괄 전송 완료: 성공 ${successCount}명, 실패 ${failedCount}명`);

  if (failedCount > 0) {
    console.warn(`[TeamsBot] ${failedCount}명에게 메시지 전송 실패`);
    console.warn(`[TeamsBot] 사용자들이 먼저 봇에게 메시지를 보냈는지 확인하세요.`);
  }
}

/**
 * 사용자 UPN으로부터 Teams User ID 조회
 * @param turnContext Bot Turn Context
 * @param userUpn 사용자 UPN
 */
export async function getTeamsUserIdByUpn(
  turnContext: TurnContext,
  userUpn: string
): Promise<string | null> {
  try {
    const members = await TeamsInfo.getPagedMembers(turnContext);
    const user = members.members.find(
      (m) => m.userPrincipalName?.toLowerCase() === userUpn.toLowerCase()
    );
    return user?.id || null;
  } catch (error) {
    console.error(`[TeamsBot] Teams User ID 조회 실패: ${userUpn}`, error);
    return null;
  }
}

/**
 * Conversation Reference를 통한 사용자 정보 확인 (디버깅용)
 * @param userUpn 사용자 UPN
 */
export async function checkConversationReference(userUpn: string): Promise<boolean> {
  try {
    const conversationRef = await getConversationReference(userUpn);
    if (conversationRef) {
      console.log(`[TeamsBot] ✅ Conversation Reference 존재: ${userUpn}`);
      return true;
    } else {
      console.log(`[TeamsBot] ❌ Conversation Reference 없음: ${userUpn}`);
      console.log(`[TeamsBot] 사용자가 먼저 봇에게 메시지를 보내야 합니다.`);
      return false;
    }
  } catch (error) {
    console.error(`[TeamsBot] Conversation Reference 확인 실패: ${userUpn}`, error);
    return false;
  }
}
