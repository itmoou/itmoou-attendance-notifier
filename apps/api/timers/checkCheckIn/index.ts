/**
 * Check-In Timer Function
 * 출근 누락 체크 및 알림
 * 
 * 실행 시간:
 * - 11:05 (1차 알림)
 * - 11:30 (2차 최종 알림)
 */

import { app, InvocationContext, Timer } from '@azure/functions';
import { getFlexClient } from '../../shared/flexClient';
import { getTokenManager } from '../../shared/tokenManager';
import { getOutlookClient } from '../../shared/outlookClient';
import {
  getCurrentDate,
  filterOutVacationEmployees,
  findMissingCheckIns,
  createCheckInNotificationMessage,
  sendTeamsNotifications,
} from '../../shared/rules';

/**
 * 출근 체크 타이머 핸들러
 */
async function checkCheckInHandler(myTimer: Timer, context: InvocationContext): Promise<void> {
  const currentTime = new Date().toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: process.env.TZ || 'Asia/Seoul',
  });

  context.log(`[CheckCheckIn] 실행 시작: ${currentTime}`);

  try {
    // 1. Refresh Token 만료 체크
    const tokenManager = getTokenManager();
    const warningDays = parseInt(process.env.REFRESH_TOKEN_WARNING_DAYS || '2', 10);
    
    if (tokenManager.isRefreshTokenExpiringSoon(warningDays)) {
      const daysRemaining = tokenManager.getRefreshTokenDaysRemaining();
      context.log(`[CheckCheckIn] ⚠️ Refresh Token 만료 임박: ${daysRemaining}일 남음`);
      
      const outlookClient = getOutlookClient();
      await outlookClient.sendRefreshTokenWarning(daysRemaining);
    }

    // 2. 전체 직원 조회
    const flexClient = getFlexClient();
    const allEmployees = await flexClient.getEmployees();
    context.log(`[CheckCheckIn] 전체 직원: ${allEmployees.length}명`);

    // 3. 휴가자 제외
    const today = getCurrentDate();
    const activeEmployees = await filterOutVacationEmployees(allEmployees, today);
    context.log(`[CheckCheckIn] 근무 직원: ${activeEmployees.length}명`);

    // 4. 출근 누락자 확인
    const missingEmployees = await findMissingCheckIns(activeEmployees, today);
    context.log(`[CheckCheckIn] 출근 누락: ${missingEmployees.length}명`);

    if (missingEmployees.length === 0) {
      context.log('[CheckCheckIn] 출근 누락자 없음. 알림 종료.');
      return;
    }

    // 5. 알림 차수 판단 (시간 기반)
    const hour = new Date().getHours();
    const minute = new Date().getMinutes();
    const attempt = (hour === 11 && minute >= 30) ? 2 : 1;

    context.log(`[CheckCheckIn] ${attempt}차 알림 발송`);

    // 6. Teams DM 발송
    await sendTeamsNotifications(
      missingEmployees,
      (name) => createCheckInNotificationMessage(name, attempt)
    );

    context.log(`[CheckCheckIn] 알림 발송 완료: ${missingEmployees.length}명`);
  } catch (error) {
    context.error('[CheckCheckIn] 실행 중 오류 발생:', error);
    throw error;
  }
}

// Azure Functions 타이머 등록
// CRON: 0 5 11 * * 1-5 (월~금 11:05)
// CRON: 0 30 11 * * 1-5 (월~금 11:30)
app.timer('checkCheckIn-first', {
  schedule: '0 5 11 * * 1-5', // 월~금 11:05
  handler: checkCheckInHandler,
});

app.timer('checkCheckIn-second', {
  schedule: '0 30 11 * * 1-5', // 월~금 11:30
  handler: checkCheckInHandler,
});

export default checkCheckInHandler;
