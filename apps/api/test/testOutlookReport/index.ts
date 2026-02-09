/**
 * Test Outlook Report
 * 이메일 리포트 테스트
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getFlexClient } from '../../shared/flexClient';
import { getOutlookClient } from '../../shared/outlookClient';
import {
  getAllEmployeeMaps,
  ensureEmployeeMapTableExists,
} from '../../shared/storage/employeeMapRepo';
import { ensureNotifyStateTableExists } from '../../shared/storage/notifyStateRepo';

/**
 * 오늘 날짜 반환 (YYYY-MM-DD)
 */
function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 리포트 HTML 생성
 */
function createReportHtml(
  date: string,
  missingCheckIn: string[],
  missingCheckOut: string[],
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

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>근태 리포트</title>
</head>
<body>
  <h1>📊 ${date} 근태 누락 리포트 (테스트)</h1>
  <p><strong>⚠️ 이것은 테스트 이메일입니다.</strong></p>

  ${createTable('출근 체크 누락', missingCheckIn)}
  ${createTable('퇴근 체크 누락', missingCheckOut)}

  <hr>
  <p><small>이 리포트는 테스트용으로 생성되었습니다.</small></p>
</body>
</html>
  `.trim();
}

async function testOutlookReportHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('[Test] Outlook 리포트 테스트 시작');

  const results: any = {
    success: false,
    timestamp: new Date().toISOString(),
    date: getTodayDate(),
    steps: {},
  };

  try {
    // 테이블 존재 확인
    await ensureEmployeeMapTableExists();
    await ensureNotifyStateTableExists();
    results.steps.tablesReady = true;

    const today = getTodayDate();
    context.log(`[Test] 리포트 대상 날짜: ${today}`);

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

    // 2. Flex API로 오늘 근태 상태 조회
    const flexClient = getFlexClient();
    const attendanceStatuses = await flexClient.getAttendanceStatuses(
      today,
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

    results.steps.missingCheckIn = missingCheckIn.length;
    results.steps.missingCheckOut = missingCheckOut.length;
    results.steps.missingCheckInList = missingCheckIn;
    results.steps.missingCheckOutList = missingCheckOut;

    context.log(`[Test] 출근 누락: ${missingCheckIn.length}명`);
    context.log(`[Test] 퇴근 누락: ${missingCheckOut.length}명`);

    // 4. 리포트 HTML 생성
    const totalMissing = missingCheckIn.length + missingCheckOut.length;
    const reportHtml = createReportHtml(
      today,
      missingCheckIn,
      missingCheckOut,
      employeeMaps
    );

    // 5. HR에게 이메일 발송
    const hrEmailEnv = process.env.HR_EMAIL || process.env.HR_FROM_EMAIL;
    if (!hrEmailEnv) {
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...results,
          message: 'HR 이메일이 설정되지 않았습니다. HR_EMAIL 또는 HR_FROM_EMAIL 환경변수를 설정하세요.',
        }, null, 2),
      };
    }

    // 쉼표로 구분된 여러 수신자 지원
    const hrEmails = hrEmailEnv.split(',').map(email => email.trim()).filter(email => email.length > 0);

    if (hrEmails.length === 0) {
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...results,
          message: '유효한 HR 이메일이 없습니다.',
        }, null, 2),
      };
    }

    results.steps.recipientEmails = hrEmails;

    const outlookClient = getOutlookClient();
    await outlookClient.sendHtmlEmail(
      hrEmails,
      `[테스트] [근태 리포트] ${today} 근태 누락 현황 (${totalMissing}건)`,
      reportHtml
    );

    context.log(`[Test] 리포트 발송 완료: ${hrEmails.join(', ')}`);

    results.success = true;
    results.message = '이메일 리포트 테스트 완료';
    results.steps.emailSent = true;

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

app.http('testOutlookReport', {
  methods: ['GET', 'POST'],
  authLevel: 'function',
  route: 'test/outlook-report',
  handler: testOutlookReportHandler,
});

export default testOutlookReportHandler;
