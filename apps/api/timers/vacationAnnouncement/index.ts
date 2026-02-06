/**
 * Vacation Announcement Timer
 * 매일 아침 09:00에 오늘 휴가자 현황을 Teams로 공지
 * 
 * 실행 시간: 평일 09:00 (KST)
 * Cron: 0 0 9 * * 1-5
 */

import { app, InvocationContext, Timer } from '@azure/functions';
import { getFlexClient } from '../../shared/flexClient';
import { getAllEmployeeMaps } from '../../shared/storage/employeeMapRepo';
import { sendProactiveMessage } from '../../shared/teamsClient';
import { sendEmail } from '../../shared/outlookClient';

/**
 * 휴가자 목록을 포맷팅
 */
function formatVacationList(vacationers: Array<{ name: string; type: string; period: string }>): string {
  if (vacationers.length === 0) {
    return '오늘 휴가자가 없습니다. ✅';
  }

  let message = `📅 **오늘 휴가자 현황 (${vacationers.length}명)**\n\n`;
  
  vacationers.forEach((v, index) => {
    message += `${index + 1}. ${v.name} - ${v.type} (${v.period})\n`;
  });

  return message;
}

/**
 * 주간 휴가 현황 포맷팅
 */
function formatWeeklyVacationSummary(
  weeklyVacations: Array<{ date: string; name: string; type: string }>
): string {
  if (weeklyVacations.length === 0) {
    return '\n📊 **이번 주 휴가 예정**\n없음';
  }

  let message = '\n📊 **이번 주 휴가 예정**\n';
  
  // 날짜별로 그룹화
  const grouped = weeklyVacations.reduce((acc, v) => {
    if (!acc[v.date]) {
      acc[v.date] = [];
    }
    acc[v.date].push({ name: v.name, type: v.type });
    return acc;
  }, {} as Record<string, Array<{ name: string; type: string }>>);

  Object.entries(grouped).forEach(([date, vacations]) => {
    const dayOfWeek = getDayOfWeekKorean(date);
    message += `\n**${date} (${dayOfWeek})**\n`;
    vacations.forEach((v) => {
      message += `  • ${v.name} - ${v.type}\n`;
    });
  });

  return message;
}

/**
 * 날짜를 요일(한글)로 변환
 */
function getDayOfWeekKorean(dateStr: string): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const date = new Date(dateStr);
  return days[date.getDay()];
}

/**
 * 오늘이 주말인지 확인
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // 일요일(0) 또는 토요일(6)
}

/**
 * 이번 주의 남은 평일 날짜 목록 반환
 */
function getRemainingWeekdays(today: Date): string[] {
  const dates: string[] = [];
  const currentDay = today.getDay();
  
  // 주말이면 빈 배열 반환
  if (isWeekend(today)) {
    return dates;
  }

  // 오늘부터 금요일까지
  const daysUntilFriday = 5 - currentDay; // 금요일(5)까지 남은 일수
  
  for (let i = 1; i <= daysUntilFriday; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }

  return dates;
}

const timerTrigger = async function (myTimer: Timer, context: InvocationContext): Promise<void> {
  context.log('[VacationAnnouncement] ========== 시작 ==========');

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // 주말 체크
  if (isWeekend(now)) {
    context.log('[VacationAnnouncement] 주말이므로 실행하지 않음');
    return;
  }

  try {
    const flexClient = getFlexClient();
    
    // 1. 전체 직원 매핑 조회
    const employeeMaps = await getAllEmployeeMaps();
    const employeeNumbers = Array.from(employeeMaps.values()).map((m) => m.employeeNumber);
    
    if (employeeNumbers.length === 0) {
      console.log('[VacationAnnouncement] 등록된 직원이 없음');
      return;
    }

    console.log(`[VacationAnnouncement] 직원 수: ${employeeNumbers.length}명`);

    // 2. 오늘 휴가자 조회
    const todayVacationers = await flexClient.getVacationersWithDetails(today, employeeNumbers);
    
    console.log(`[VacationAnnouncement] 오늘 휴가자: ${todayVacationers.length}명`);

    // 3. 이번 주 남은 기간 휴가자 조회 (금요일까지)
    const remainingWeekdays = getRemainingWeekdays(now);
    const weeklyVacations: Array<{ date: string; name: string; type: string }> = [];

    for (const date of remainingWeekdays) {
      const vacationers = await flexClient.getVacationersWithDetails(date, employeeNumbers);
      
      for (const v of vacationers) {
        // 사원번호로 이름 찾기
        const employee = Array.from(employeeMaps.entries()).find(
          ([_, info]) => info.employeeNumber === v.employeeNumber
        );
        
        if (employee) {
          weeklyVacations.push({
            date,
            name: employee[1].name || employee[0],
            type: v.timeOffType,
          });
        }
      }
    }

    console.log(`[VacationAnnouncement] 이번 주 휴가 예정: ${weeklyVacations.length}건`);

    // 4. 오늘 휴가자 정보 포맷팅
    const todayVacationList = todayVacationers.map((v) => {
      const employee = Array.from(employeeMaps.entries()).find(
        ([_, info]) => info.employeeNumber === v.employeeNumber
      );
      
      const name = employee ? (employee[1].name || employee[0]) : v.employeeNumber;
      const period = v.startDate === v.endDate 
        ? v.startDate 
        : `${v.startDate} ~ ${v.endDate}`;

      return {
        name,
        type: v.timeOffType,
        period,
      };
    });

    // 5. 메시지 생성
    const todayMessage = formatVacationList(todayVacationList);
    const weeklyMessage = formatWeeklyVacationSummary(weeklyVacations);
    
    const fullMessage = `${todayMessage}\n${weeklyMessage}`;

    // 6. HR에게 이메일 발송
    const hrEmail = process.env.HR_EMAIL || 'hr@itmoou.com';
    
    await sendEmail({
      to: [hrEmail],
      subject: `[휴가 현황] ${today} - 오늘 휴가자 ${todayVacationers.length}명`,
      body: `
        <html>
          <body style="font-family: Arial, sans-serif;">
            <h2>📅 ${today} 휴가 현황</h2>
            <h3>오늘 휴가자 (${todayVacationers.length}명)</h3>
            ${todayVacationers.length > 0 ? `
              <ul>
                ${todayVacationList.map(v => `
                  <li><strong>${v.name}</strong> - ${v.type} (${v.period})</li>
                `).join('')}
              </ul>
            ` : '<p>오늘 휴가자가 없습니다. ✅</p>'}
            
            ${weeklyVacations.length > 0 ? `
              <h3>이번 주 휴가 예정 (${weeklyVacations.length}건)</h3>
              ${Object.entries(weeklyVacations.reduce((acc, v) => {
                if (!acc[v.date]) {
                  acc[v.date] = [];
                }
                acc[v.date].push(v);
                return acc;
              }, {} as Record<string, typeof weeklyVacations>))
              .map(([date, vacations]) => `
                <h4>${date} (${getDayOfWeekKorean(date)})</h4>
                <ul>
                  ${vacations.map(v => `<li>${v.name} - ${v.type}</li>`).join('')}
                </ul>
              `).join('')}
            ` : ''}
            
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

    console.log('[VacationAnnouncement] HR 이메일 발송 완료');

    // 7. 전체 직원에게 Teams 메시지 발송 (선택사항)
    // 필요시 활성화: 모든 직원에게 휴가 현황 공지
    // for (const [upn, _] of employeeMaps.entries()) {
    //   await sendProactiveMessage(upn, fullMessage);
    // }

    console.log('[VacationAnnouncement] ========== 완료 ==========');
  } catch (error) {
    console.error('[VacationAnnouncement] 실행 실패:', error);
    throw error;
  }
};

// Timer trigger 등록
app.timer('vacationAnnouncement', {
  schedule: '0 0 9 * * 1-5', // 평일 09:00 (UTC+9 = 한국 시간 기준)
  handler: timerTrigger,
});
