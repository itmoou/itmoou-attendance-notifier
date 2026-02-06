/**
 * Daily Summary Timer Function
 * 당일 누적 요약 알림 (22:10)
 * 당일 누락이 있는 사용자에게만 발송
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
 * 당일 누적 요약 알림 처리
 */
async function dailySummaryHandler(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  const triggerTime = new Date();
  context.log(`[DailySummary] 실행 시작: ${triggerTime.toISOString()}`);

  try {
    // 테이블 존재 확인
    await ensureEmployeeMapTableExists();
    await ensureNotifyStateTableExists();

    const date = getCurrentDate();
    const notifyType: NotifyType = 'dailySummary2210';

    context.log(`[DailySummary] 당일 요약 처리 시작 (${notifyType})`);

    // 1. 전체 사원 목록 조회
    const employeeMaps = await getAllEmployeeMaps();
    const allEmployeeNumbers = Array.from(employeeMaps.values()).map(
      (e) => e.employeeNumber
    );

    if (allEmployeeNumbers.length === 0) {
      context.warn('[DailySummary] 사원 목록이 비어있습니다.');
      return;
    }

    context.log(`[DailySummary] 전체 사원: ${allEmployeeNumbers.length}명`);

    // 2. Flex API로 근태 상태 조회
    const flexClient = getFlexClient();
    const attendanceStatuses = await flexClient.getAttendanceStatuses(
      date,
      allEmployeeNumbers
    );

    // 3. 누락이 있는 사원 필터링 (휴가자 제외)
    const employeesWithMissing = attendanceStatuses.filter(
      (status) =>
        !status.isOnVacation && (!status.hasCheckIn || !status.hasCheckOut)
    );

    if (employeesWithMissing.length === 0) {
      context.log('[DailySummary] 누락자 없음');
      return;
    }

    context.log(`[DailySummary] 누락 발생: ${employeesWithMissing.length}명`);

    // 4. 중복 발송 방지
    const unsentEmployeeNumbers = [];
    for (const status of employeesWithMissing) {
      const sent = await wasSent(date, status.employeeNumber, notifyType);
      if (!sent) {
        unsentEmployeeNumbers.push(status.employeeNumber);
      }
    }

    if (unsentEmployeeNumbers.length === 0) {
      context.log(`[DailySummary] 모두 발송 완료 (${notifyType})`);
      return;
    }

    context.log(`[DailySummary] 미발송: ${unsentEmployeeNumbers.length}명`);

    // 5. UPN 매핑 및 메시지 생성
    const messages: Array<{ userUpn: string; message: string; employeeNumber: string }> = [];
    const unmappedEmployees: string[] = [];

    for (const [upn, empMap] of employeeMaps.entries()) {
      const status = employeesWithMissing.find(
        (s) => s.employeeNumber === empMap.employeeNumber
      );

      if (status && unsentEmployeeNumbers.includes(empMap.employeeNumber)) {
        const missingItems: string[] = [];
        if (!status.hasCheckIn) missingItems.push('출근 체크');
        if (!status.hasCheckOut) missingItems.push('퇴근 체크');

        const message = `📊 **당일 근태 누락 요약**\n\n오늘 누락된 항목:\n- ${missingItems.join('\n- ')}\n\n내일은 정시에 체크해 주세요!`;

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
      context.warn(`[DailySummary] 매핑 누락 사원: ${unmappedEmployees.join(', ')}`);
    }

    // 6. Teams Bot으로 메시지 전송
    if (messages.length > 0) {
      const result = await sendBulkProactiveMessages(messages);

      // 7. 발송 완료 표시 (성공한 것만)
      const successEmployeeNumbers = messages
        .filter((m) => !result.failedUsers.includes(m.userUpn))
        .map((m) => m.employeeNumber);

      if (successEmployeeNumbers.length > 0) {
        await markMultipleSent(date, successEmployeeNumbers, notifyType);
      }

      context.log(
        `[DailySummary] 발송 완료: 성공 ${result.successCount}명, 실패 ${result.failedCount}명`
      );

      // 온보딩 미완료자 로깅
      if (result.failedUsers.length > 0) {
        context.warn(`[DailySummary] 온보딩 미완료(봇 대화 필요): ${result.failedUsers.join(', ')}`);
      }
    }

    context.log(`[DailySummary] 당일 요약 처리 완료`);
  } catch (error) {
    context.error('[DailySummary] 처리 중 오류:', error);
    throw error;
  }
}

// Azure Functions Timer Trigger 등록
// 22:10 KST = 13:10 UTC
app.timer('dailySummary', {
  schedule: '0 10 13 * * 1-5',  // 월~금 13:10 UTC (한국 22:10)
  handler: dailySummaryHandler,
});

export default dailySummaryHandler;
