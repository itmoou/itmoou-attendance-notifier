/**
 * Attendance System Diagnostics
 * 근태 알림 시스템 진단 (인증 불필요)
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getFlexClient } from '../../shared/flexClient';
import { getAllEmployeeMaps } from '../../shared/storage/employeeMapRepo';
import { checkConversationReference } from '../../shared/teamsClient';

async function diagnoseHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('[Diagnose] 시스템 진단 시작');

  const diagnosis: any = {
    timestamp: new Date().toISOString(),
    checks: {},
    errors: [],
  };

  try {
    // 1. 환경변수 확인
    const envVars = {
      FLEX_API_BASE_URL: !!process.env.FLEX_API_BASE_URL,
      FLEX_API_TOKEN: !!process.env.FLEX_API_TOKEN,
      MICROSOFT_APP_ID: !!process.env.MICROSOFT_APP_ID,
      MICROSOFT_APP_PASSWORD: !!process.env.MICROSOFT_APP_PASSWORD,
      MICROSOFT_APP_TENANT_ID: !!process.env.MICROSOFT_APP_TENANT_ID,
      AZURE_STORAGE_CONNECTION_STRING: !!process.env.AZURE_STORAGE_CONNECTION_STRING,
      GRAPH_CLIENT_ID: !!process.env.GRAPH_CLIENT_ID,
      GRAPH_CLIENT_SECRET: !!process.env.GRAPH_CLIENT_SECRET,
    };

    diagnosis.checks.environmentVariables = envVars;

    const missingVars = Object.entries(envVars)
      .filter(([key, exists]) => !exists)
      .map(([key]) => key);

    if (missingVars.length > 0) {
      diagnosis.errors.push(`환경변수 누락: ${missingVars.join(', ')}`);
    }

    // 2. Employee Map 확인
    try {
      const employeeMaps = await getAllEmployeeMaps();
      diagnosis.checks.employeeMap = {
        status: 'OK',
        count: employeeMaps.size,
        sample: Array.from(employeeMaps.entries()).slice(0, 3).map(([upn, emp]) => ({
          upn,
          employeeNumber: emp.employeeNumber,
          name: emp.name,
        })),
      };
    } catch (error: any) {
      diagnosis.checks.employeeMap = {
        status: 'ERROR',
        error: error.message,
      };
      diagnosis.errors.push(`Employee Map 조회 실패: ${error.message}`);
    }

    // 3. Conversation Reference 확인
    try {
      const employeeMaps = await getAllEmployeeMaps();
      const upns = Array.from(employeeMaps.keys()).slice(0, 5);
      const conversationChecks = [];

      for (const upn of upns) {
        const hasConversation = await checkConversationReference(upn);
        conversationChecks.push({ upn, hasConversation });
      }

      const readyCount = conversationChecks.filter(c => c.hasConversation).length;

      diagnosis.checks.conversationReferences = {
        status: readyCount > 0 ? 'OK' : 'WARNING',
        ready: readyCount,
        total: conversationChecks.length,
        sample: conversationChecks,
      };

      if (readyCount === 0) {
        diagnosis.errors.push('Conversation Reference가 없습니다. 사용자들이 봇과 대화를 시작해야 합니다.');
      }
    } catch (error: any) {
      diagnosis.checks.conversationReferences = {
        status: 'ERROR',
        error: error.message,
      };
      diagnosis.errors.push(`Conversation Reference 확인 실패: ${error.message}`);
    }

    // 4. Flex API 연결 확인
    try {
      const flexClient = getFlexClient();
      const today = new Date().toISOString().split('T')[0];

      // 테스트용으로 빈 배열로 조회 (API 연결만 확인)
      await flexClient.getMissingCheckInEmployees(today, []);

      diagnosis.checks.flexApi = {
        status: 'OK',
        message: 'Flex API 연결 성공',
      };
    } catch (error: any) {
      diagnosis.checks.flexApi = {
        status: 'ERROR',
        error: error.message,
      };
      diagnosis.errors.push(`Flex API 연결 실패: ${error.message}`);
    }

    // 5. 전체 상태 평가
    diagnosis.overallStatus = diagnosis.errors.length === 0 ? '✅ 정상' : '❌ 문제 발견';
    diagnosis.errorCount = diagnosis.errors.length;

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(diagnosis, null, 2),
    };
  } catch (error: any) {
    context.error('[Diagnose] 진단 중 오류:', error);

    return {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        ...diagnosis,
        overallStatus: '❌ 심각한 오류',
        fatalError: {
          message: error.message,
          stack: error.stack,
        },
      }, null, 2),
    };
  }
}

app.http('diagnose', {
  methods: ['GET'],
  authLevel: 'anonymous', // 인증 불필요
  route: 'diagnose',
  handler: diagnoseHandler,
});

export default diagnoseHandler;
