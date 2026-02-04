/**
 * Outlook Report Timer Function
 * 전일 누락 리포트 이메일 발송
 * 
 * 실행 시간:
 * - 매일 09:00 (전일 근태 누락 리포트)
 */

import { app, InvocationContext, Timer } from '@azure/functions';
import { getFlexClient } from '../../shared/flexClient';
import { getOutlookClient } from '../../shared/outlookClient';
import {
  getYesterdayDate,
  filterOutVacationEmployees,
  findMissingCheckIns,
  findMissingCheckOuts,
} from '../../shared/rules';

/**
 * Outlook 리포트 타이머 핸들러
 */
async function outlookReportHandler(myTimer: Timer, context: InvocationContext): Promise<void> {
  const currentTime = new Date().toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: process.env.TZ || 'Asia/Seoul',
  });

  context.log(`[OutlookReport] 실행 시작: ${currentTime}`);

  try {
    // 1. 전일 날짜 계산
    const yesterday = getYesterdayDate();
    context.log(`[OutlookReport] 리포트 대상 날짜: ${yesterday}`);

    // 2. 전체 직원 조회
    const flexClient = getFlexClient();
    const allEmployees = await flexClient.getEmployees();
    context.log(`[OutlookReport] 전체 직원: ${allEmployees.length}명`);

    // 3. 휴가자 제외
    const activeEmployees = await filterOutVacationEmployees(allEmployees, yesterday);
    context.log(`[OutlookReport] 전일 근무 직원: ${activeEmployees.length}명`);

    // 4. 전일 출근 누락자 확인
    const missingCheckInEmployees = await findMissingCheckIns(activeEmployees, yesterday);
    context.log(`[OutlookReport] 전일 출근 누락: ${missingCheckInEmployees.length}명`);

    // 5. 전일 퇴근 누락자 확인
    const missingCheckOutEmployees = await findMissingCheckOuts(activeEmployees, yesterday);
    context.log(`[OutlookReport] 전일 퇴근 누락: ${missingCheckOutEmployees.length}명`);

    // 6. 누락이 없으면 종료
    const totalMissing = missingCheckInEmployees.length + missingCheckOutEmployees.length;
    if (totalMissing === 0) {
      context.log('[OutlookReport] 전일 누락자 없음. 리포트 발송하지 않음.');
      return;
    }

    // 7. 리포트 HTML 생성
    const outlookClient = getOutlookClient();
    const reportHtml = outlookClient.createAttendanceReportHtml(
      yesterday,
      missingCheckInEmployees.map(e => ({
        name: e.name,
        email: e.email,
      })),
      missingCheckOutEmployees.map(e => ({
        name: e.name,
        email: e.email,
      }))
    );

    // 8. HR에게 이메일 발송
    const hrEmail = process.env.HR_EMAIL;
    if (!hrEmail) {
      context.warn('[OutlookReport] HR 이메일이 설정되지 않았습니다.');
      return;
    }

    await outlookClient.sendHtmlEmail(
      [hrEmail],
      `[근태 리포트] ${yesterday} 근태 누락 현황 (${totalMissing}건)`,
      reportHtml
    );

    context.log(`[OutlookReport] 리포트 발송 완료: ${hrEmail}`);
    context.log(`[OutlookReport] 출근 누락: ${missingCheckInEmployees.length}명`);
    context.log(`[OutlookReport] 퇴근 누락: ${missingCheckOutEmployees.length}명`);
  } catch (error) {
    context.error('[OutlookReport] 실행 중 오류 발생:', error);
    throw error;
  }
}

// Azure Functions 타이머 등록
// CRON: 0 0 9 * * 1-5 (월~금 09:00)
app.timer('outlookReport', {
  schedule: '0 0 9 * * 1-5', // 월~금 09:00
  handler: outlookReportHandler,
});

export default outlookReportHandler;
