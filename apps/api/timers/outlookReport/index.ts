/**
 * Outlook Report Timer Function
 * 전일 누락 리포트 이메일 발송 (09:00)
 * 
 * 기능:
 * - 전일 출근/퇴근 누락자 리스트
 * - 온보딩 미완료자 리스트
 * - HR 이메일로 발송
 */

import { app, InvocationContext, Timer } from '@azure/functions';
import { getFlexClient } from '../../shared/flexClient';
import { getOutlookClient } from '../../shared/outlookClient';
import {
  getAllEmployeeMaps,
  ensureEmployeeMapTableExists,
} from '../../shared/storage/employeeMapRepo';
import { ensureNotifyStateTableExists } from '../../shared/storage/notifyStateRepo';
import { getOnboardingIncomplete } from '../../shared/onboardingTracker';

/**
 * 전일 날짜 반환 (YYYY-MM-DD)
 */
function getYesterdayDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Outlook 리포트 타이머 핸들러
 */
async function outlookReportHandler(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  const triggerTime = new Date();
  context.log(`[OutlookReport] 실행 시작: ${triggerTime.toISOString()}`);

  try {
    // 테이블 존재 확인
    await ensureEmployeeMapTableExists();
    await ensureNotifyStateTableExists();

    const yesterday = getYesterdayDate();
    context.log(`[OutlookReport] 리포트 대상 날짜: ${yesterday}`);

    // 1. 전체 사원 목록 조회
    const employeeMaps = await getAllEmployeeMaps();
    const allEmployeeNumbers = Array.from(employeeMaps.values()).map(
      (e) => e.employeeNumber
    );

    if (allEmployeeNumbers.length === 0) {
      context.warn('[OutlookReport] 사원 목록이 비어있습니다.');
      return;
    }

    context.log(`[OutlookReport] 전체 사원: ${allEmployeeNumbers.length}명`);

    // 2. Flex API로 전일 근태 상태 조회
    const flexClient = getFlexClient();
    const attendanceStatuses = await flexClient.getAttendanceStatuses(
      yesterday,
      allEmployeeNumbers
    );

    // 3. 누락자 분류
    const missingCheckIn: string[] = [];
    const missingCheckOut: string[] = [];

    for (const status of attendanceStatuses) {
      if (status.isOnVacation) {
        continue; // 휴가자 제외
      }

      if (!status.hasCheckIn) {
        missingCheckIn.push(status.employeeNumber);
      }
      if (!status.hasCheckOut) {
        missingCheckOut.push(status.employeeNumber);
      }
    }

    context.log(`[OutlookReport] 전일 출근 누락: ${missingCheckIn.length}명`);
    context.log(`[OutlookReport] 전일 퇴근 누락: ${missingCheckOut.length}명`);

    // 4. 온보딩 미완료자 조회
    const onboardingIncompleteList = getOnboardingIncomplete();
    const onboardingIncomplete = onboardingIncompleteList.map((o) => o.userUpn);
    context.log(`[OutlookReport] 온보딩 미완료: ${onboardingIncomplete.length}명`);

    // 5. 리포트 HTML 생성
    const totalMissing = missingCheckIn.length + missingCheckOut.length;
    const reportHtml = createReportHtml(
      yesterday,
      missingCheckIn,
      missingCheckOut,
      onboardingIncomplete,
      employeeMaps
    );

    // 6. HR에게 이메일 발송
    const hrEmailEnv = process.env.HR_EMAIL || 'hr@itmoou.com';
    if (!hrEmailEnv) {
      context.warn('[OutlookReport] HR 이메일이 설정되지 않았습니다.');
      return;
    }

    // 쉼표로 구분된 여러 수신자 지원
    const hrEmails = hrEmailEnv.split(',').map(email => email.trim()).filter(email => email.length > 0);
    
    if (hrEmails.length === 0) {
      context.warn('[OutlookReport] 유효한 HR 이메일이 없습니다.');
      return;
    }

    if (totalMissing === 0 && onboardingIncomplete.length === 0) {
      context.log('[OutlookReport] 누락자 및 미완료자 없음. 리포트 발송하지 않음.');
      return;
    }

    const outlookClient = getOutlookClient();
    await outlookClient.sendHtmlEmail(
      hrEmails,
      `[근태 리포트] ${yesterday} 근태 누락 현황 (${totalMissing}건)`,
      reportHtml
    );

    context.log(`[OutlookReport] 리포트 발송 완료: ${hrEmails.join(', ')}`);
  } catch (error) {
    context.error('[OutlookReport] 처리 중 오류:', error);
    throw error;
  }
}

/**
 * 리포트 HTML 생성
 */
function createReportHtml(
  date: string,
  missingCheckIn: string[],
  missingCheckOut: string[],
  onboardingIncomplete: string[],
  employeeMaps: Map<string, { employeeNumber: string; name?: string }>
): string {
  const createTable = (title: string, employeeNumbers: string[]) => {
    if (employeeNumbers.length === 0) {
      return `<h3>${title}: 없음</h3>`;
    }

    const rows = employeeNumbers
      .map((empNum) => {
        const entry = Array.from(employeeMaps.entries()).find(
          ([, e]) => e.employeeNumber === empNum
        );
        const upn = entry ? entry[0] : '(미매핑)';
        return `<tr><td>${empNum}</td><td>${upn}</td></tr>`;
      })
      .join('');

    return `
      <h3>${title} (${employeeNumbers.length}명)</h3>
      <table border="1" cellpadding="5" cellspacing="0">
        <thead>
          <tr><th>사원번호</th><th>UPN</th></tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  };

  const onboardingTable =
    onboardingIncomplete.length > 0
      ? `
      <h3>온보딩 미완료 (봇 대화 시작 필요) (${onboardingIncomplete.length}명)</h3>
      <p>아래 사용자들은 봇에게 'hi' 메시지를 보내야 DM 수신이 가능합니다.</p>
      <table border="1" cellpadding="5" cellspacing="0">
        <thead>
          <tr><th>UPN</th></tr>
        </thead>
        <tbody>
          ${onboardingIncomplete.map((upn) => `<tr><td>${upn}</td></tr>`).join('')}
        </tbody>
      </table>
    `
      : '<h3>온보딩 미완료: 없음</h3>';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>근태 리포트</title>
</head>
<body>
  <h1>📊 ${date} 근태 누락 리포트</h1>
  
  ${createTable('출근 체크 누락', missingCheckIn)}
  ${createTable('퇴근 체크 누락', missingCheckOut)}
  ${onboardingTable}
  
  <hr>
  <p><small>이 리포트는 자동으로 생성되었습니다.</small></p>
</body>
</html>
  `.trim();
}

// Azure Functions Timer Trigger 등록
// 09:00 실행
app.timer('outlookReport', {
  schedule: '0 0 9 * * *',
  handler: outlookReportHandler,
});

export default outlookReportHandler;
