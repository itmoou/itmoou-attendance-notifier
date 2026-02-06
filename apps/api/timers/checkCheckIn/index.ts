/**
 * Check-In Timer Function
 * 출근 누락 알림 (11:05, 11:30)
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
 * 출근 누락 알림 처리
 */
async function checkCheckInHandler(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  const triggerTime = new Date();
  context.log(`[CheckCheckIn] 실행 시작: ${triggerTime.toISOString()}`);

  try {
    // 테이블 존재 확인
    await ensureEmployeeMapTableExists();
    await ensureNotifyStateTableExists();

    const date = getCurrentDate();
    const hour = triggerTime.getUTCHours();
    const minute = triggerTime.getUTCMinutes();

    // 02:05 UTC (한국 11:05) 또는 02:30 UTC (한국 11:30) 판정
    let notifyType: NotifyType;
    let messagePhase: string;

    if (hour === 2 && minute >= 0 && minute < 15) {
      notifyType = 'checkIn1105';
      messagePhase = '1차';
    } else if (hour === 2 && minute >= 25) {
      notifyType = 'checkIn1130';
      messagePhase = '최종';
    } else {
      context.log(`[CheckCheckIn] 실행 시간이 아님: ${hour}:${minute} UTC`);
      return;
    }

    context.log(`[CheckCheckIn] ${messagePhase} 알림 처리 시작 (${notifyType})`);

    // 1. 전체 사원 목록 조회
    const employeeMaps = await getAllEmployeeMaps();
    const allEmployeeNumbers = Array.from(employeeMaps.values()).map(
      (e) => e.employeeNumber
    );

    if (allEmployeeNumbers.length === 0) {
      context.warn('[CheckCheckIn] 사원 목록이 비어있습니다.');
      return;
    }

    context.log(`[CheckCheckIn] 전체 사원: ${allEmployeeNumbers.length}명`);

    // 2. Flex API로 출근 누락자 조회
    const flexClient = getFlexClient();
    const missingEmployeeNumbers = await flexClient.getMissingCheckInEmployees(
      date,
      allEmployeeNumbers
    );

    if (missingEmployeeNumbers.length === 0) {
      context.log('[CheckCheckIn] 출근 누락자 없음');
      return;
    }

    context.log(`[CheckCheckIn] 출근 누락: ${missingEmployeeNumbers.length}명`);

    // 3. 중복 발송 방지: 미발송자만 필터링
    const unsentEmployeeNumbers = [];
    for (const empNum of missingEmployeeNumbers) {
      const sent = await wasSent(date, empNum, notifyType);
      if (!sent) {
        unsentEmployeeNumbers.push(empNum);
      }
    }

    if (unsentEmployeeNumbers.length === 0) {
      context.log(`[CheckCheckIn] 모두 발송 완료 (${notifyType})`);
      return;
    }

    context.log(`[CheckCheckIn] 미발송: ${unsentEmployeeNumbers.length}명`);

    // 4. UPN 매핑
    const messages: Array<{ userUpn: string; message: string; employeeNumber: string }> = [];
    const unmappedEmployees: string[] = [];

    for (const [upn, empMap] of employeeMaps.entries()) {
      if (unsentEmployeeNumbers.includes(empMap.employeeNumber)) {
        const message =
          messagePhase === '1차'
            ? `📢 **출근 체크 알림 (${messagePhase})**\n\n오늘 출근 체크가 누락되었습니다.\n확인 후 체크 부탁드립니다.`
            : `⚠️ **출근 체크 알림 (${messagePhase})**\n\n아직 출근 체크가 누락되어 있습니다.\n지금 바로 확인해 주세요!`;

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
      context.warn(`[CheckCheckIn] 매핑 누락 사원: ${unmappedEmployees.join(', ')}`);
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
        `[CheckCheckIn] 발송 완료: 성공 ${result.successCount}명, 실패 ${result.failedCount}명`
      );

      // 온보딩 미완료자 로깅
      if (result.failedUsers.length > 0) {
        context.warn(`[CheckCheckIn] 온보딩 미완료(봇 대화 필요): ${result.failedUsers.join(', ')}`);
      }
    }

    context.log(`[CheckCheckIn] ${messagePhase} 알림 처리 완료`);
  } catch (error) {
    context.error('[CheckCheckIn] 처리 중 오류:', error);
    throw error;
  }
}

// Azure Functions Timer Trigger 등록
// 첫 번째: 11:05 KST = 02:05 UTC (cron: 초 분 시 일 월 요일)
app.timer('checkCheckIn-first', {
  schedule: '0 5 2 * * 1-5',  // 월~금 02:05 UTC (한국 11:05)
  handler: checkCheckInHandler,
});

// 두 번째: 11:30 KST = 02:30 UTC
app.timer('checkCheckIn-second', {
  schedule: '0 30 2 * * 1-5',  // 월~금 02:30 UTC (한국 11:30)
  handler: checkCheckInHandler,
});

export default checkCheckInHandler;
