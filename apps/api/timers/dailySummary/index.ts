/**
 * Daily Summary Timer Function
 * 당일 누적 요약 알림
 * 
 * 실행 시간:
 * - 22:10 (당일 누락 발생자에게만 DM)
 */

import { app, InvocationContext, Timer } from '@azure/functions';
import { getFlexClient, Employee } from '../../shared/flexClient';
import {
  getCurrentDate,
  filterOutVacationEmployees,
  findMissingCheckIns,
  findMissingCheckOuts,
  createDailySummaryMessage,
  sendTeamsNotifications,
} from '../../shared/rules';

/**
 * 당일 누적 요약 타이머 핸들러
 */
async function dailySummaryHandler(myTimer: Timer, context: InvocationContext): Promise<void> {
  const currentTime = new Date().toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: process.env.TZ || 'Asia/Seoul',
  });

  context.log(`[DailySummary] 실행 시작: ${currentTime}`);

  try {
    // 1. 전체 직원 조회
    const flexClient = getFlexClient();
    const allEmployees = await flexClient.getEmployees();
    context.log(`[DailySummary] 전체 직원: ${allEmployees.length}명`);

    // 2. 휴가자 제외
    const today = getCurrentDate();
    const activeEmployees = await filterOutVacationEmployees(allEmployees, today);
    context.log(`[DailySummary] 근무 직원: ${activeEmployees.length}명`);

    // 3. 출근 누락자 확인
    const missingCheckInEmployees = await findMissingCheckIns(activeEmployees, today);
    const missingCheckInIds = new Set(missingCheckInEmployees.map(e => e.id));

    // 4. 퇴근 누락자 확인
    const missingCheckOutEmployees = await findMissingCheckOuts(activeEmployees, today);
    const missingCheckOutIds = new Set(missingCheckOutEmployees.map(e => e.id));

    // 5. 누락이 있는 직원 목록 생성
    const employeesWithMissing: Array<{
      employee: Employee;
      missingCheckIn: boolean;
      missingCheckOut: boolean;
    }> = [];

    for (const employee of activeEmployees) {
      const missingCheckIn = missingCheckInIds.has(employee.id);
      const missingCheckOut = missingCheckOutIds.has(employee.id);

      if (missingCheckIn || missingCheckOut) {
        employeesWithMissing.push({
          employee,
          missingCheckIn,
          missingCheckOut,
        });
      }
    }

    context.log(`[DailySummary] 누락 발생: ${employeesWithMissing.length}명`);

    if (employeesWithMissing.length === 0) {
      context.log('[DailySummary] 누락자 없음. 알림 종료.');
      return;
    }

    // 6. Teams DM 발송
    await sendTeamsNotifications(
      employeesWithMissing.map(e => e.employee),
      (name) => {
        const empInfo = employeesWithMissing.find(e => e.employee.name === name);
        return createDailySummaryMessage(
          name,
          empInfo?.missingCheckIn || false,
          empInfo?.missingCheckOut || false
        );
      }
    );

    context.log(`[DailySummary] 알림 발송 완료: ${employeesWithMissing.length}명`);

    // 7. 통계 로깅
    context.log(`[DailySummary] 출근 누락: ${missingCheckInEmployees.length}명`);
    context.log(`[DailySummary] 퇴근 누락: ${missingCheckOutEmployees.length}명`);
  } catch (error) {
    context.error('[DailySummary] 실행 중 오류 발생:', error);
    throw error;
  }
}

// Azure Functions 타이머 등록
// CRON: 0 10 22 * * 1-5 (월~금 22:10)
app.timer('dailySummary', {
  schedule: '0 10 22 * * 1-5', // 월~금 22:10
  handler: dailySummaryHandler,
});

export default dailySummaryHandler;
