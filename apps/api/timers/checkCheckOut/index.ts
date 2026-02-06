/**
 * Check-Out Timer Function
 * 퇴근 누락 알림 (20:30, 22:00)
 */

import { app, InvocationContext, Timer } from '@azure/functions';
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

/**
 * 퇴근 누락 알림 처리
 */
async function checkCheckOutHandler(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  const triggerTime = new Date();
  context.log(`[CheckCheckOut] 실행 시작: ${triggerTime.toISOString()}`);

  try {
    // 테이블 존재 확인
    await ensureEmployeeMapTableExists();
    await ensureNotifyStateTableExists();

    const date = getCurrentDate();
    const hour = triggerTime.getUTCHours();
    const minute = triggerTime.getUTCMinutes();

    // 11:30 UTC (한국 20:30) 또는 13:00 UTC (한국 22:00) 판정
    let notifyType: NotifyType;
    let messagePhase: string;

    if (hour === 11 && minute >= 25 && minute <= 35) {
      notifyType = 'checkOut2030';
      messagePhase = '1차';
    } else if (hour === 13 && minute >= 0 && minute < 10) {
      notifyType = 'checkOut2200';
      messagePhase = '최종';
    } else {
      context.log(`[CheckCheckOut] 실행 시간이 아님: ${hour}:${minute} UTC`);
      return;
    }

    context.log(`[CheckCheckOut] ${messagePhase} 알림 처리 시작 (${notifyType})`);

    // 1. 전체 사원 목록 조회
    const employeeMaps = await getAllEmployeeMaps();
    const allEmployeeNumbers = Array.from(employeeMaps.values()).map(
      (e) => e.employeeNumber
    );

    if (allEmployeeNumbers.length === 0) {
      context.warn('[CheckCheckOut] 사원 목록이 비어있습니다.');
      return;
    }

    context.log(`[CheckCheckOut] 전체 사원: ${allEmployeeNumbers.length}명`);

    // 2. Flex API로 퇴근 누락자 조회
    const flexClient = getFlexClient();
    const missingEmployeeNumbers = await flexClient.getMissingCheckOutEmployees(
      date,
      allEmployeeNumbers
    );

    if (missingEmployeeNumbers.length === 0) {
      context.log('[CheckCheckOut] 퇴근 누락자 없음');
      return;
    }

    context.log(`[CheckCheckOut] 퇴근 누락: ${missingEmployeeNumbers.length}명`);

    // 3. 중복 발송 방지: 미발송자만 필터링
    const unsentEmployeeNumbers = [];
    for (const empNum of missingEmployeeNumbers) {
      const sent = await wasSent(date, empNum, notifyType);
      if (!sent) {
        unsentEmployeeNumbers.push(empNum);
      }
    }

    if (unsentEmployeeNumbers.length === 0) {
      context.log(`[CheckCheckOut] 모두 발송 완료 (${notifyType})`);
      return;
    }

    context.log(`[CheckCheckOut] 미발송: ${unsentEmployeeNumbers.length}명`);

    // 4. UPN 매핑
    const messages: Array<{ userUpn: string; message: string; employeeNumber: string }> = [];
    const unmappedEmployees: string[] = [];

    for (const [upn, empMap] of employeeMaps.entries()) {
      if (unsentEmployeeNumbers.includes(empMap.employeeNumber)) {
        const message =
          messagePhase === '1차'
            ? `📢 **퇴근 체크 알림 (${messagePhase})**\n\n오늘 퇴근 체크가 누락되었습니다.\n확인 후 체크 부탁드립니다.`
            : `⚠️ **퇴근 체크 알림 (${messagePhase})**\n\n아직 퇴근 체크가 누락되어 있습니다.\n지금 바로 확인해 주세요!`;

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

    if (unmappedEmployees.length > 0) {
      context.warn(`[CheckCheckOut] 매핑 누락 사원: ${unmappedEmployees.join(', ')}`);
    }

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

      context.log(
        `[CheckCheckOut] 발송 완료: 성공 ${result.successCount}명, 실패 ${result.failedCount}명`
      );

      // 온보딩 미완료자 로깅
      if (result.failedUsers.length > 0) {
        context.warn(`[CheckCheckOut] 온보딩 미완료(봇 대화 필요): ${result.failedUsers.join(', ')}`);
      }
    }

    context.log(`[CheckCheckOut] ${messagePhase} 알림 처리 완료`);
  } catch (error) {
    context.error('[CheckCheckOut] 처리 중 오류:', error);
    throw error;
  }
}

// Azure Functions Timer Trigger 등록
// 첫 번째: 20:30 KST = 11:30 UTC
app.timer('checkCheckOut-first', {
  schedule: '0 30 11 * * 1-5',  // 월~금 11:30 UTC (한국 20:30)
  handler: checkCheckOutHandler,
});

// 두 번째: 22:00 KST = 13:00 UTC
app.timer('checkCheckOut-second', {
  schedule: '0 0 13 * * 1-5',  // 월~금 13:00 UTC (한국 22:00)
  handler: checkCheckOutHandler,
});

export default checkCheckOutHandler;
