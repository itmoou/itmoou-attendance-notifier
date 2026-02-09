/**
 * Check Stored Conversations
 * 저장된 Conversation Reference 확인
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ensureTableExists } from '../../shared/storage/teamsConversationRepo';
import { getAllEmployeeMaps } from '../../shared/storage/employeeMapRepo';
import { checkConversationReference } from '../../shared/teamsClient';

async function checkConversationsHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('[Test] Conversation Reference 확인 시작');

  try {
    await ensureTableExists();

    // 사원 목록 조회
    const employeeMaps = await getAllEmployeeMaps();
    const upns = Array.from(employeeMaps.keys());

    context.log(`[Test] 전체 사원: ${upns.length}명`);

    // 각 사원의 Conversation Reference 확인
    const matchResults = [];

    for (const [upn, empMap] of employeeMaps.entries()) {
      context.log(`[Test] 확인 중: ${upn} (${empMap.employeeNumber})`);

      // Conversation Reference 확인
      const hasConversation = await checkConversationReference(upn);

      matchResults.push({
        userUpn: upn,
        employeeNumber: empMap.employeeNumber,
        hasConversation,
        status: hasConversation ? '✅ 준비됨' : '❌ 온보딩 필요',
      });
    }

    const readyCount = matchResults.filter(r => r.hasConversation).length;
    const notReadyCount = matchResults.filter(r => !r.hasConversation).length;

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        summary: {
          total: matchResults.length,
          ready: readyCount,
          notReady: notReadyCount,
        },
        employees: matchResults,
      }, null, 2),
    };
  } catch (error: any) {
    context.error('[Test] Conversation Reference 확인 실패:', error);

    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
      }, null, 2),
    };
  }
}

app.http('checkConversations', {
  methods: ['GET', 'POST'],
  authLevel: 'function',
  route: 'test/check-conversations',
  handler: checkConversationsHandler,
});

export default checkConversationsHandler;
