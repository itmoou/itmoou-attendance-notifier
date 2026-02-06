/**
 * Vacation Reminder Timer
 * 매일 오후 18:00에 휴가 리마인더 발송
 * 
 * 1. 내일 휴가 시작하는 직원 → 본인과 팀에 알림
 * 2. 오늘 휴가 종료 (내일 복귀) 직원 → 본인에게 복귀 리마인더
 * 
 * 실행 시간: 평일 18:00 (KST)
 * Cron: 0 0 18 * * 1-5
 */

import { app, InvocationContext, Timer } from '@azure/functions';
import { getFlexClient } from '../../shared/flexClient';
import { getAllEmployeeMaps, getUpnByEmployeeNumber } from '../../shared/storage/employeeMapRepo';
import { sendProactiveMessage } from '../../shared/teamsClient';
import { sendEmail } from '../../shared/outlookClient';

/**
 * 오늘이 주말인지 확인
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * 내일이 주말인지 확인
 */
function isTomorrowWeekend(date: Date): boolean {
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isWeekend(tomorrow);
}

const timerTrigger = async function (myTimer: Timer, context: InvocationContext): Promise<void> {
  context.log('[VacationReminder] ========== 시작 ==========');

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // 주말이면 실행하지 않음
  if (isWeekend(now)) {
    context.log('[VacationReminder] 주말이므로 실행하지 않음');
    return;
  }

  // 금요일이면 내일 휴가 시작 알림은 스킵 (주말이므로)
  const skipTomorrowReminder = isTomorrowWeekend(now);

  try {
    const flexClient = getFlexClient();
    
    // 1. 전체 직원 매핑 조회
    const employeeMaps = await getAllEmployeeMaps();
    const employeeNumbers = Array.from(employeeMaps.values()).map((m) => m.employeeNumber);
    
    if (employeeNumbers.length === 0) {
      console.log('[VacationReminder] 등록된 직원이 없음');
      return;
    }

    console.log(`[VacationReminder] 직원 수: ${employeeNumbers.length}명`);

    // 2. 내일 휴가 시작하는 직원 조회
    let startingVacations: any[] = [];
    if (!skipTomorrowReminder) {
      startingVacations = await flexClient.getVacationStartingTomorrow(tomorrowStr, employeeNumbers);
      console.log(`[VacationReminder] 내일 휴가 시작: ${startingVacations.length}명`);
    } else {
      console.log('[VacationReminder] 내일이 주말이므로 휴가 시작 알림 스킵');
    }

    // 3. 오늘 휴가 종료 (내일 복귀) 직원 조회
    const endingVacations = await flexClient.getVacationEndingToday(today, employeeNumbers);
    console.log(`[VacationReminder] 오늘 휴가 종료 (내일 복귀): ${endingVacations.length}명`);

    // 4. 내일 휴가 시작 알림
    for (const vacation of startingVacations) {
      const upn = await getUpnByEmployeeNumber(vacation.employeeNumber);
      if (!upn) {
        console.warn(`[VacationReminder] UPN 없음: ${vacation.employeeNumber}`);
        continue;
      }

      const employee = employeeMaps.get(upn);
      const name = employee?.name || upn;

      // 본인에게 알림
      const userMessage = `
📅 **휴가 시작 알림**

안녕하세요, ${name}님!

내일부터 휴가가 시작됩니다. 편안한 휴가 보내세요! 🌴

**휴가 정보:**
- 휴가 유형: ${vacation.timeOffType || '연차'}
- 기간: ${vacation.startDate} ~ ${vacation.endDate}
- 복귀일: ${new Date(new Date(vacation.endDate).getTime() + 86400000).toISOString().split('T')[0]}

즐거운 시간 되세요! 😊
      `.trim();

      await sendProactiveMessage(upn, userMessage);
      console.log(`[VacationReminder] 휴가 시작 알림 전송: ${name}`);

      // HR에게 알림 (선택사항)
      const hrEmail = process.env.HR_EMAIL || 'hr@itmoou.com';
      await sendEmail({
        to: [hrEmail],
        subject: `[휴가 알림] ${name}님 내일(${tomorrowStr}) 휴가 시작`,
        body: `
          <html>
            <body style="font-family: Arial, sans-serif;">
              <h2>📅 휴가 시작 알림</h2>
              <p><strong>${name}</strong>님이 내일부터 휴가에 들어갑니다.</p>
              <ul>
                <li><strong>휴가 유형:</strong> ${vacation.timeOffType || '연차'}</li>
                <li><strong>기간:</strong> ${vacation.startDate} ~ ${vacation.endDate}</li>
                <li><strong>복귀일:</strong> ${new Date(new Date(vacation.endDate).getTime() + 86400000).toISOString().split('T')[0]}</li>
              </ul>
              <hr>
              <p style="color: #666; font-size: 12px;">
                이 메일은 자동으로 발송되었습니다. (Flex 휴가 관리 시스템)
              </p>
            </body>
          </html>
        `,
        bodyType: 'html',
        from: hrEmail,
      });
    }

    // 5. 내일 복귀 알림 (오늘 휴가 종료)
    for (const vacation of endingVacations) {
      const upn = await getUpnByEmployeeNumber(vacation.employeeNumber);
      if (!upn) {
        console.warn(`[VacationReminder] UPN 없음: ${vacation.employeeNumber}`);
        continue;
      }

      const employee = employeeMaps.get(upn);
      const name = employee?.name || upn;

      // 주말이면 복귀 알림도 스킵
      if (isTomorrowWeekend(now)) {
        console.log(`[VacationReminder] ${name}님 복귀일이 주말이므로 알림 스킵`);
        continue;
      }

      // 본인에게 복귀 알림
      const returnMessage = `
🏢 **출근 리마인더**

안녕하세요, ${name}님!

휴가가 오늘로 종료되고, 내일(${tomorrowStr}) 출근입니다.

**휴가 정보:**
- 휴가 유형: ${vacation.timeOffType || '연차'}
- 휴가 기간: ${vacation.startDate} ~ ${vacation.endDate}
- 복귀일: ${tomorrowStr}

잘 쉬셨나요? 내일 뵙겠습니다! 😊
      `.trim();

      await sendProactiveMessage(upn, returnMessage);
      console.log(`[VacationReminder] 복귀 알림 전송: ${name}`);
    }

    console.log('[VacationReminder] ========== 완료 ==========');
    console.log(`[VacationReminder] 휴가 시작 알림: ${startingVacations.length}건`);
    console.log(`[VacationReminder] 복귀 알림: ${endingVacations.length}건`);
  } catch (error) {
    console.error('[VacationReminder] 실행 실패:', error);
    throw error;
  }
};

// Timer trigger 등록
app.timer('vacationReminder', {
  schedule: '0 0 18 * * 1-5', // 평일 18:00 (UTC+9 = 한국 시간 기준)
  handler: timerTrigger,
});
