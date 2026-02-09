/**
 * Weekly Vacation Report Timer Function
 * 주간 휴가 현황 리포트 생성 및 백업
 *
 * 실행: 매주 월요일 09:00 KST (00:00 UTC)
 * 기능:
 * - 이번 주 + 다음 주 휴가 현황 조회 (총 2주)
 * - HTML 리포트 생성
 * - SharePoint에 자동 백업
 * - HR 이메일 발송
 */

import { app, InvocationContext, Timer } from '@azure/functions';
import { getFlexClient } from '../../shared/flexClient';
import { getOutlookClient } from '../../shared/outlookClient';
import sharepointClient from '../../shared/sharepointClient';
import {
  getAllEmployeeMaps,
  ensureEmployeeMapTableExists,
} from '../../shared/storage/employeeMapRepo';

/**
 * 주차 번호 계산 (ISO 8601 week number)
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * 이번 주 월요일 날짜 가져오기
 */
function getThisMonday(): Date {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day; // 일요일이면 -6, 아니면 1-day
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

/**
 * 주간 휴가 리포트 타이머 핸들러
 */
async function weeklyVacationReportHandler(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  const triggerTime = new Date();
  context.log(`[WeeklyVacationReport] 실행 시작: ${triggerTime.toISOString()}`);

  try {
    // 테이블 존재 확인
    await ensureEmployeeMapTableExists();

    // 1. 기간 계산 (이번 주 월요일 ~ 다음 주 일요일)
    const thisMonday = getThisMonday();
    const nextSunday = new Date(thisMonday);
    nextSunday.setDate(thisMonday.getDate() + 13); // 2주 후 일요일

    const startDate = formatDate(thisMonday);
    const endDate = formatDate(nextSunday);

    context.log(`[WeeklyVacationReport] 조회 기간: ${startDate} ~ ${endDate}`);

    // 2. 전체 사원 목록 조회
    const employeeMaps = await getAllEmployeeMaps();
    const allEmployeeNumbers = Array.from(employeeMaps.values()).map(
      (e) => e.employeeNumber
    );

    if (allEmployeeNumbers.length === 0) {
      context.warn('[WeeklyVacationReport] 사원 목록이 비어있습니다.');
      return;
    }

    context.log(`[WeeklyVacationReport] 전체 사원: ${allEmployeeNumbers.length}명`);

    // 3. Flex API로 휴가 정보 조회
    const flexClient = getFlexClient();
    const vacations = await flexClient.getVacationsInRange(
      startDate,
      endDate,
      allEmployeeNumbers
    );

    context.log(`[WeeklyVacationReport] 휴가 사용 내역: ${vacations.length}건`);

    // 4. 리포트 HTML 생성
    const weekNumber = getWeekNumber(thisMonday);
    const year = thisMonday.getFullYear();
    const reportHtml = createVacationReportHtml(
      year,
      weekNumber,
      startDate,
      endDate,
      vacations,
      employeeMaps
    );

    // 5. SharePoint에 리포트 백업
    try {
      const fileName = `휴가현황_${year}-${String(weekNumber).padStart(2, '0')}주.html`;
      await sharepointClient.uploadFile('휴가 현황', fileName, reportHtml);
      context.log(`[WeeklyVacationReport] SharePoint 백업 완료: ${fileName}`);
    } catch (sharePointError) {
      context.error('[WeeklyVacationReport] SharePoint 백업 실패:', sharePointError);
      // 백업 실패해도 계속 진행
    }

    // 6. HR에게 이메일 발송 (휴가자가 있는 경우만)
    if (vacations.length > 0) {
      const hrEmailEnv = process.env.HR_EMAIL || process.env.HR_FROM_EMAIL;
      if (hrEmailEnv) {
        const hrEmails = hrEmailEnv.split(',').map(email => email.trim()).filter(email => email.length > 0);

        if (hrEmails.length > 0) {
          try {
            const outlookClient = getOutlookClient();
            await outlookClient.sendHtmlEmail(
              hrEmails,
              `[휴가 현황] ${year}년 ${weekNumber}주차 휴가 현황 (${vacations.length}건)`,
              reportHtml
            );
            context.log(`[WeeklyVacationReport] 이메일 발송 완료: ${hrEmails.join(', ')}`);
          } catch (emailError) {
            context.error('[WeeklyVacationReport] 이메일 발송 실패:', emailError);
          }
        }
      }
    } else {
      context.log('[WeeklyVacationReport] 휴가자가 없어 이메일 발송하지 않음');
    }

    context.log('[WeeklyVacationReport] 처리 완료');
  } catch (error) {
    context.error('[WeeklyVacationReport] 처리 중 오류:', error);
    throw error;
  }
}

/**
 * 휴가 리포트 HTML 생성
 */
function createVacationReportHtml(
  year: number,
  weekNumber: number,
  startDate: string,
  endDate: string,
  vacations: any[],
  employeeMaps: Map<string, { employeeNumber: string; name?: string }>
): string {
  // 날짜별로 휴가자 그룹화
  const vacationsByDate = new Map<string, any[]>();

  vacations.forEach((vacation) => {
    const start = new Date(vacation.startDate);
    const end = new Date(vacation.endDate);

    // 시작일부터 종료일까지 모든 날짜에 추가
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(d);
      if (dateStr >= startDate && dateStr <= endDate) {
        if (!vacationsByDate.has(dateStr)) {
          vacationsByDate.set(dateStr, []);
        }
        vacationsByDate.get(dateStr)!.push(vacation);
      }
    }
  });

  // 2주치 날짜 생성
  const dates: Date[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  // 주별로 그룹화
  const weeks: Date[][] = [[], []];
  dates.forEach((date, idx) => {
    weeks[Math.floor(idx / 7)].push(date);
  });

  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

  let tableRows = '';
  weeks.forEach((week, weekIdx) => {
    const weekTitle = weekIdx === 0 ? '이번 주' : '다음 주';

    // 요일 헤더
    tableRows += `
      <tr style="background-color: #f0f0f0;">
        <td colspan="7" style="text-align: center; font-weight: bold; padding: 10px;">${weekTitle}</td>
      </tr>
      <tr style="background-color: #0078d4; color: white;">
    `;
    week.forEach((date) => {
      const dayOfWeek = weekdays[date.getDay()];
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      tableRows += `<th style="${isWeekend ? 'background-color: #005a9e;' : ''}">${dayOfWeek}</th>`;
    });
    tableRows += '</tr><tr>';

    week.forEach((date) => {
      const dateStr = formatDate(date);
      const dayOfMonth = date.getDate();
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const vacationsToday = vacationsByDate.get(dateStr) || [];

      const bgColor = isWeekend ? '#f9f9f9' : 'white';
      const dateColor = isWeekend ? '#999' : '#333';

      tableRows += `
        <td style="background-color: ${bgColor}; vertical-align: top; padding: 8px; min-width: 120px;">
          <div style="font-weight: bold; color: ${dateColor}; margin-bottom: 5px;">${dayOfMonth}일</div>
      `;

      if (vacationsToday.length > 0) {
        // 중복 제거
        const uniqueVacations = Array.from(
          new Map(vacationsToday.map(v => [v.employeeNumber, v])).values()
        );

        uniqueVacations.forEach((vacation) => {
          const entry = Array.from(employeeMaps.entries()).find(
            ([, e]) => e.employeeNumber === vacation.employeeNumber
          );
          const name = entry?.[1].name || vacation.employeeNumber;
          const timeOffType = vacation.timeOffType || '연차';

          tableRows += `
            <div style="background-color: #fff3cd; border-left: 3px solid #ffc107; padding: 4px; margin: 2px 0; font-size: 12px;">
              <strong>${name}</strong><br>
              <span style="color: #856404;">${timeOffType}</span>
            </div>
          `;
        });
      } else {
        tableRows += `<div style="color: #ccc; font-size: 12px; text-align: center;">-</div>`;
      }

      tableRows += '</td>';
    });
    tableRows += '</tr>';
  });

  const totalVacations = vacations.length;
  const uniqueEmployees = new Set(vacations.map(v => v.employeeNumber)).size;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>주간 휴가 현황</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; margin: 20px; }
    .header { background-color: #0078d4; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0 0 0; }
    .summary { background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .summary strong { color: #0078d4; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #0078d4; color: white; font-weight: 600; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📅 ${year}년 ${weekNumber}주차 휴가 현황</h1>
    <p>${startDate} ~ ${endDate}</p>
  </div>

  <div class="summary">
    <p><strong>총 휴가 건수:</strong> ${totalVacations}건</p>
    <p><strong>휴가 사용 인원:</strong> ${uniqueEmployees}명</p>
  </div>

  <table>
    ${tableRows}
  </table>

  <div class="footer">
    <p>이 리포트는 자동으로 생성되었습니다.</p>
  </div>
</body>
</html>
  `.trim();
}

// Azure Functions Timer Trigger 등록
// 매주 월요일 09:00 KST = 00:00 UTC
app.timer('weeklyVacationReport', {
  schedule: '0 0 0 * * 1',  // 매주 월요일 00:00 UTC (한국 09:00)
  handler: weeklyVacationReportHandler,
});

export default weeklyVacationReportHandler;
