/**
 * Teams Bot Client
 * Teams Bot을 사용한 Proactive Message 전송
 * 
 * ⚠️ 중요: Microsoft Graph API 방식이 아닌 Bot Framework 사용
 */

import {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  ConversationReference,
  TurnContext,
  TeamsInfo,
} from 'botbuilder';
import axios from 'axios';
import {
  getConversationReference,
  getConversationReferenceByAadObjectId,
  getConversationReferences,
} from './storage/teamsConversationRepo';
import { getGraphAccessToken } from './graphClient';
import { validateBotEnvs } from './utils/envUtil';

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
    } as any // Type workaround
  );

  botAdapter = new CloudAdapter(botFrameworkAuthentication);
  return botAdapter;
}

/**
 * UPN으로 Azure AD Object ID 조회 (Graph API 사용)
 * @param userUpn 사용자 UPN (예: ymsim@itmoou.com)
 * @returns AAD Object ID 또는 null
 */
async function getAadObjectIdByUpn(userUpn: string): Promise<string | null> {
  try {
    const accessToken = await getGraphAccessToken();
    const graphBaseUrl = process.env.GRAPH_API_BASE_URL || 'https://graph.microsoft.com/v1.0';
    
    const response = await axios.get(
      `${graphBaseUrl}/users/${encodeURIComponent(userUpn)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          $select: 'id,userPrincipalName',
        },
      }
    );

    const aadObjectId = response.data.id;
    console.log(`[TeamsBot] AAD Object ID 조회 성공: ${userUpn} -> ${aadObjectId}`);
    return aadObjectId;
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.warn(`[TeamsBot] 사용자를 찾을 수 없음: ${userUpn}`);
    } else {
      console.error(`[TeamsBot] AAD Object ID 조회 실패: ${userUpn}`, error);
    }
    return null;
  }
}

/**
 * 단일 사용자에게 Proactive Message 전송
 * @param userUpn 사용자 UPN (예: ymsim@itmoou.com)
 * @param message 전송할 메시지 (HTML 지원)
 * @returns { success: boolean, error?: string }
 */
export async function sendProactiveMessage(
  userUpn: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[TeamsBot] Proactive Message 전송 시작: ${userUpn}`);

    // 첫 줄에 "근태알림(자동 알림) / 회신 불필요" 추가
    const finalMessage = `**근태알림(자동 알림) / 회신 불필요**\n\n${message}`;

    // 1. UPN으로 직접 Conversation Reference 조회 시도 (구 방식 호환)
    let conversationRef = await getConversationReference(userUpn);
    
    // 2. AAD Object ID로 조회 시도 (신 방식)
    if (!conversationRef) {
      const aadObjectId = await getAadObjectIdByUpn(userUpn);
      if (aadObjectId) {
        conversationRef = await getConversationReferenceByAadObjectId(aadObjectId);
      }
    }
    
    if (!conversationRef) {
      const errorMsg = `Conversation Reference 없음: 사용자가 먼저 봇에게 메시지를 보내야 합니다.`;
      console.warn(`[TeamsBot] ${errorMsg} (${userUpn})`);
      return { success: false, error: errorMsg };
    }

    const adapter = getBotAdapter();

    // Proactive Message 전송
    await adapter.continueConversationAsync(
      process.env.BOT_APP_ID!,
      conversationRef as ConversationReference,
      async (turnContext: TurnContext) => {
        await turnContext.sendActivity({
          type: 'message',
          text: finalMessage,
          textFormat: 'plain',
        });
        console.log(`[TeamsBot] 메시지 전송 완료: ${userUpn}`);
      }
    );

    return { success: true };
  } catch (error: any) {
    const errorMsg = error.message || '알 수 없는 오류';
    console.error(`[TeamsBot] 메시지 전송 실패: ${userUpn}`, error);
    return { success: false, error: errorMsg };
  }
}

/**
 * 여러 사용자에게 일괄 Proactive Message 전송
 * @param messages UPN과 메시지 쌍의 배열
 * @returns { successCount, failedCount, failedUsers }
 */
export async function sendBulkProactiveMessages(
  messages: Array<{ userUpn: string; message: string }>
): Promise<{ successCount: number; failedCount: number; failedUsers: string[] }> {
  console.log(`[TeamsBot] 일괄 메시지 전송 시작: ${messages.length}명`);

  const results = await Promise.all(
    messages.map(async (msg) => {
      const result = await sendProactiveMessage(msg.userUpn, msg.message);
      return { userUpn: msg.userUpn, ...result };
    })
  );

  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;
  const failedUsers = results.filter((r) => !r.success).map((r) => r.userUpn);

  console.log(`[TeamsBot] 일괄 전송 완료: 성공 ${successCount}명, 실패 ${failedCount}명`);

  if (failedCount > 0) {
    console.warn(`[TeamsBot] ${failedCount}명에게 메시지 전송 실패:`);
    console.warn(`[TeamsBot] 실패 목록: ${failedUsers.join(', ')}`);
  }

  return { successCount, failedCount, failedUsers };
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
    
    if (!conversationRef) {
      // AAD Object ID로 재시도
      const aadObjectId = await getAadObjectIdByUpn(userUpn);
      if (aadObjectId) {
        const refByAad = await getConversationReferenceByAadObjectId(aadObjectId);
        if (refByAad) {
          console.log(`[TeamsBot] ✅ Conversation Reference 존재 (AAD): ${userUpn}`);
          return true;
        }
      }
    }
    
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
