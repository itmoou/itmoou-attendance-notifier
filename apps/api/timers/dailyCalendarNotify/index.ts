/**
 * Daily Calendar Notify Timer
 * 매일 아침 9시에 모든 직원에게 오늘의 일정을 Teams로 알림
 */

import { app, InvocationContext, Timer } from '@azure/functions';
import { getAllEmployeeMaps } from '../../shared/storage/employeeMapRepo';
import outlookCalendarClient from '../../shared/outlookCalendarClient';
import { sendProactiveMessage } from '../../shared/teamsClient';

async function dailyCalendarNotifyHandler(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  const triggerTime = new Date(myTimer.scheduleStatus?.last || new Date());
  context.log(`[DailyCalendarNotify] 실행 시작: ${triggerTime.toISOString()}`);

  try {
    // 모든 직원 조회 (Map<upn, {employeeNumber, name}>)
    const employeeMaps = await getAllEmployeeMaps();
    context.log(`[DailyCalendarNotify] 전체 직원: ${employeeMaps.size}명`);

    if (employeeMaps.size === 0) {
      context.warn('[DailyCalendarNotify] 직원 정보가 없습니다.');
      return;
    }

    let successCount = 0;
    let failCount = 0;
    const failedUsers: string[] = [];

    // 각 직원에게 일정 알림 전송
    for (const [upn, employee] of employeeMaps) {
      const userEmail = upn; // Map의 key가 UPN(이메일)

      if (!userEmail) {
        context.warn(`[DailyCalendarNotify] 이메일 정보 없음: ${employee.employeeNumber}`);
        failCount++;
        continue;
      }

      try {
        // 오늘의 일정 조회
        const events = await outlookCalendarClient.getTodayCalendar(userEmail);
        context.log(`[DailyCalendarNotify] ${userEmail}: ${events.length}개 일정`);

        // 메시지 생성
        const message = outlookCalendarClient.formatTodayCalendarMessage(events);

        // Teams로 알림 전송
        await sendProactiveMessage(userEmail, message);

        successCount++;
        context.log(`[DailyCalendarNotify] 전송 성공: ${userEmail}`);
      } catch (error: any) {
        failCount++;
        failedUsers.push(userEmail);
        context.error(`[DailyCalendarNotify] 전송 실패 (${userEmail}):`, error.message);
      }
    }

    context.log(`[DailyCalendarNotify] 완료 - 성공: ${successCount}명, 실패: ${failCount}명`);

    if (failedUsers.length > 0) {
      context.warn(`[DailyCalendarNotify] 실패 목록: ${failedUsers.join(', ')}`);
    }
  } catch (error: any) {
    context.error('[DailyCalendarNotify] 오류:', error);
    throw error;
  }
}

// Timer: 매일 아침 9:00 KST (0:00 UTC)
// Cron: 0 0 0 * * * (매일 00:00 UTC = 09:00 KST)
app.timer('dailyCalendarNotify', {
  schedule: '0 0 0 * * *', // 매일 00:00 UTC (09:00 KST)
  handler: dailyCalendarNotifyHandler,
});

export default dailyCalendarNotifyHandler;
