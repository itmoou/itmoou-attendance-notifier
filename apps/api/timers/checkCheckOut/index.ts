/**
 * Check-Out Timer Function
 * 퇴근 누락 체크 및 알림
 * 
 * 실행 시간:
 * - 20:30 (1차 알림)
 * - 22:00 (2차 최종 알림)
 */

import { app, InvocationContext, Timer } from '@azure/functions';
import { getFlexClient } from '../../shared/flexClient';
import {
  getCurrentDate,
  filterOutVacationEmployees,
  findMissingCheckOuts,
  createCheckOutNotificationMessage,
  sendTeamsNotifications,
} from '../../shared/rules';

/**
 * 퇴근 체크 타이머 핸들러
 */
async function checkCheckOutHandler(myTimer: Timer, context: InvocationContext): Promise<void> {
  const currentTime = new Date().toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: process.env.TZ || 'Asia/Seoul',
  });

  context.log(`[CheckCheckOut] 실행 시작: ${currentTime}`);

  try {
    // 1. 전체 직원 조회
    const flexClient = getFlexClient();
    const allEmployees = await flexClient.getEmployees();
    context.log(`[CheckCheckOut] 전체 직원: ${allEmployees.length}명`);

    // 2. 휴가자 제외
    const today = getCurrentDate();
    const activeEmployees = await filterOutVacationEmployees(allEmployees, today);
    context.log(`[CheckCheckOut] 근무 직원: ${activeEmployees.length}명`);

    // 3. 퇴근 누락자 확인
    const missingEmployees = await findMissingCheckOuts(activeEmployees, today);
    context.log(`[CheckCheckOut] 퇴근 누락: ${missingEmployees.length}명`);

    if (missingEmployees.length === 0) {
      context.log('[CheckCheckOut] 퇴근 누락자 없음. 알림 종료.');
      return;
    }

    // 4. 알림 차수 판단 (시간 기반)
    const hour = new Date().getHours();
    const minute = new Date().getMinutes();
    const attempt = (hour === 22 && minute >= 0) ? 2 : 1;

    context.log(`[CheckCheckOut] ${attempt}차 알림 발송`);

    // 5. Teams DM 발송
    await sendTeamsNotifications(
      missingEmployees,
      (name) => createCheckOutNotificationMessage(name, attempt)
    );

    context.log(`[CheckCheckOut] 알림 발송 완료: ${missingEmployees.length}명`);
  } catch (error) {
    context.error('[CheckCheckOut] 실행 중 오류 발생:', error);
    throw error;
  }
}

// Azure Functions 타이머 등록
// CRON: 0 30 20 * * 1-5 (월~금 20:30)
// CRON: 0 0 22 * * 1-5 (월~금 22:00)
app.timer('checkCheckOut-first', {
  schedule: '0 30 20 * * 1-5', // 월~금 20:30
  handler: checkCheckOutHandler,
});

app.timer('checkCheckOut-second', {
  schedule: '0 0 22 * * 1-5', // 월~금 22:00
  handler: checkCheckOutHandler,
});

export default checkCheckOutHandler;
