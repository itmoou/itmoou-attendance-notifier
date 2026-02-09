/**
 * Test Weekly Vacation Report
 * 주간 휴가 현황 리포트 테스트
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getFlexClient } from '../../shared/flexClient';
import { getOutlookClient } from '../../shared/outlookClient';
import sharepointClient from '../../shared/sharepointClient';
import {
  getAllEmployeeMaps,
  ensureEmployeeMapTableExists,
} from '../../shared/storage/employeeMapRepo';

/**
 * 주차 번호 계산
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * 이번 주 월요일 가져오기
 */
function getThisMonday(): Date {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * 날짜를 YYYY-MM-DD 형식으로 변환
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function testWeeklyVacationHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('[Test] 주간 휴가 리포트 테스트 시작');

  const results: any = {
    success: false,
    timestamp: new Date().toISOString(),
    steps: {},
  };

  try {
    // 테이블 존재 확인
    await ensureEmployeeMapTableExists();
    results.steps.tablesReady = true;

    // 1. 기간 계산
    const thisMonday = getThisMonday();
    const nextSunday = new Date(thisMonday);
    nextSunday.setDate(thisMonday.getDate() + 13);

    const startDate = formatDate(thisMonday);
    const endDate = formatDate(nextSunday);

    results.steps.period = { startDate, endDate };
    context.log(`[Test] 조회 기간: ${startDate} ~ ${endDate}`);

    // 2. 전체 사원 목록 조회
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

    // 3. Flex API로 휴가 정보 조회
    const flexClient = getFlexClient();
    const vacations = await flexClient.getVacationsInRange(
      startDate,
      endDate,
      allEmployeeNumbers
    );

    results.steps.vacationCount = vacations.length;
    results.steps.uniqueEmployees = new Set(vacations.map((v: any) => v.employeeNumber)).size;

    context.log(`[Test] 휴가 사용 내역: ${vacations.length}건`);

    // 4. 간단한 리포트 생성 (테스트용)
    const weekNumber = getWeekNumber(thisMonday);
    const year = thisMonday.getFullYear();

    const reportHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>주간 휴가 현황 (테스트)</title>
</head>
<body>
  <h1>📅 ${year}년 ${weekNumber}주차 휴가 현황 (테스트)</h1>
  <p><strong>⚠️ 이것은 테스트 리포트입니다.</strong></p>
  <p>기간: ${startDate} ~ ${endDate}</p>
  <p>총 휴가 건수: ${vacations.length}건</p>
  <p>휴가 사용 인원: ${new Set(vacations.map((v: any) => v.employeeNumber)).size}명</p>
  <hr>
  <p><small>이 리포트는 테스트용으로 생성되었습니다.</small></p>
</body>
</html>
    `.trim();

    // 5. SharePoint에 백업
    try {
      const fileName = `휴가현황_${year}-${String(weekNumber).padStart(2, '0')}주_테스트.html`;
      await sharepointClient.uploadFile('휴가 현황', fileName, reportHtml);
      context.log(`[Test] SharePoint 백업 완료: ${fileName}`);
      results.steps.sharePointBackup = true;
      results.steps.sharePointFileName = fileName;
    } catch (sharePointError: any) {
      context.error('[Test] SharePoint 백업 실패:', sharePointError);
      results.steps.sharePointBackup = false;
      results.steps.sharePointError = sharePointError.message;
    }

    // 6. 선택적 이메일 발송
    const hrEmailEnv = process.env.HR_EMAIL || process.env.HR_FROM_EMAIL;
    if (hrEmailEnv && vacations.length > 0) {
      const hrEmails = hrEmailEnv.split(',').map(email => email.trim()).filter(email => email.length > 0);

      if (hrEmails.length > 0) {
        try {
          const outlookClient = getOutlookClient();
          await outlookClient.sendHtmlEmail(
            hrEmails,
            `[테스트] [휴가 현황] ${year}년 ${weekNumber}주차 휴가 현황 (${vacations.length}건)`,
            reportHtml
          );
          context.log(`[Test] 이메일 발송 완료: ${hrEmails.join(', ')}`);
          results.steps.emailSent = true;
          results.steps.recipientEmails = hrEmails;
        } catch (emailError: any) {
          context.error('[Test] 이메일 발송 실패:', emailError);
          results.steps.emailSent = false;
          results.steps.emailError = emailError.message;
        }
      }
    } else {
      results.steps.emailSent = false;
      results.steps.emailSkipped = vacations.length === 0 ? '휴가자 없음' : 'HR 이메일 미설정';
    }

    results.success = true;
    results.message = '주간 휴가 리포트 테스트 완료';

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

app.http('testWeeklyVacation', {
  methods: ['GET', 'POST'],
  authLevel: 'function',
  route: 'test/weekly-vacation',
  handler: testWeeklyVacationHandler,
});

export default testWeeklyVacationHandler;
