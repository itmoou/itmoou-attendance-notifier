/**
 * Test Check-In Alert
 * 출근 누락 알림 테스트 (HTTP 트리거)
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getFlexClient } from '../../shared/flexClient';
import { sendBulkProactiveMessages } from '../../shared/teamsClient';
import {
  getAllEmployeeMaps,
  ensureEmployeeMapTableExists,
} from '../../shared/storage/employeeMapRepo';
import {
  wasSent,
  markMultipleSent,
  ensureNotifyStateTableExists,
  NotifyType,
} from '../../shared/storage/notifyStateRepo';

/**
 * 현재 날짜 반환 (YYYY-MM-DD)
 */
function getCurrentDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function testCheckInHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('[Test] 출근 체크 테스트 시작');

  const results: any = {
    success: false,
    timestamp: new Date().toISOString(),
    date: getCurrentDate(),
    steps: {},
  };

  try {
    // 테이블 존재 확인
    await ensureEmployeeMapTableExists();
    await ensureNotifyStateTableExists();
    results.steps.tablesReady = true;

    const date = getCurrentDate();

    // 알림 타입은 테스트용으로 1차로 설정
    const notifyType: NotifyType = 'checkIn1105';
    const messagePhase = '테스트';

    // 1. 전체 사원 목록 조회
    const employeeMaps = await getAllEmployeeMaps();
    const allEmployeeNumbers = Array.from(employeeMaps.values()).map(
      (e) => e.employeeNumber
    );

    results.steps.totalEmployees = allEmployeeNumbers.length;

    if (allEmployeeNumbers.length === 0) {
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...results,
          message: '사원 목록이 비어있습니다.',
        }, null, 2),
      };
    }

    context.log(`[Test] 전체 사원: ${allEmployeeNumbers.length}명`);

    // 2. Flex API로 출근 누락자 조회
    const flexClient = getFlexClient();
    const missingEmployeeNumbers = await flexClient.getMissingCheckInEmployees(
      date,
      allEmployeeNumbers
    );

    results.steps.missingEmployees = missingEmployeeNumbers.length;
    results.steps.missingList = missingEmployeeNumbers;

    if (missingEmployeeNumbers.length === 0) {
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...results,
          success: true,
          message: '출근 누락자 없음',
        }, null, 2),
      };
    }

    context.log(`[Test] 출근 누락: ${missingEmployeeNumbers.length}명`);

    // 3. 중복 발송 방지: 미발송자만 필터링
    const unsentEmployeeNumbers = [];
    for (const empNum of missingEmployeeNumbers) {
      const sent = await wasSent(date, empNum, notifyType);
      if (!sent) {
        unsentEmployeeNumbers.push(empNum);
      }
    }

    results.steps.unsentEmployees = unsentEmployeeNumbers.length;

    if (unsentEmployeeNumbers.length === 0) {
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...results,
          success: true,
          message: '모두 발송 완료됨 (중복 방지)',
        }, null, 2),
      };
    }

    context.log(`[Test] 미발송: ${unsentEmployeeNumbers.length}명`);

    // 4. UPN 매핑
    const messages: Array<{ userUpn: string; message: string; employeeNumber: string }> = [];
    const unmappedEmployees: string[] = [];

    for (const [upn, empMap] of employeeMaps.entries()) {
      if (unsentEmployeeNumbers.includes(empMap.employeeNumber)) {
        const message = `🧪 **출근 체크 테스트 알림**\n\n이것은 테스트 메시지입니다.\n오늘 출근 체크가 누락되었습니다.\n확인 후 체크 부탁드립니다.`;

        messages.push({
          userUpn: upn,
          message,
          employeeNumber: empMap.employeeNumber,
        });
      }
    }

    // 매핑 누락자 확인
    for (const empNum of unsentEmployeeNumbers) {
      const mapped = Array.from(employeeMaps.values()).some(
        (e) => e.employeeNumber === empNum
      );
      if (!mapped) {
        unmappedEmployees.push(empNum);
      }
    }

    results.steps.mappedMessages = messages.length;
    results.steps.unmappedEmployees = unmappedEmployees;

    // 5. Teams Bot으로 메시지 전송
    if (messages.length > 0) {
      const result = await sendBulkProactiveMessages(messages);

      // 6. 발송 완료 표시 (성공한 것만)
      const successEmployeeNumbers = messages
        .filter((m) => !result.failedUsers.includes(m.userUpn))
        .map((m) => m.employeeNumber);

      if (successEmployeeNumbers.length > 0) {
        await markMultipleSent(date, successEmployeeNumbers, notifyType);
      }

      results.steps.sendResult = {
        successCount: result.successCount,
        failedCount: result.failedCount,
        failedUsers: result.failedUsers,
      };

      context.log(
        `[Test] 발송 완료: 성공 ${result.successCount}명, 실패 ${result.failedCount}명`
      );
    }

    results.success = true;
    results.message = '테스트 완료';

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(results, null, 2),
    };
  } catch (error: any) {
    context.error('[Test] 테스트 중 오류:', error);

    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...results,
        success: false,
        error: error.message,
        stack: error.stack,
      }, null, 2),
    };
  }
}

app.http('testCheckIn', {
  methods: ['GET', 'POST'],
  authLevel: 'function',
  route: 'test/check-in',
  handler: testCheckInHandler,
});

export default testCheckInHandler;
