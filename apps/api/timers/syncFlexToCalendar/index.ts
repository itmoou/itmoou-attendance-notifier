/**
 * Sync Flex to Calendar Timer
 * Flex의 외근/재택 신청을 Outlook 일정에 동기화
 * 매일 아침 8시 실행
 */

import { app, InvocationContext, Timer } from '@azure/functions';
import { getAllEmployeeMaps } from '../../shared/storage/employeeMapRepo';
import { getFlexClient } from '../../shared/flexClient';
import meetingRoomClient from '../../shared/meetingRoomClient';

async function syncFlexToCalendarHandler(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  const triggerTime = new Date(myTimer.scheduleStatus?.last || new Date());
  context.log(`[SyncFlexToCalendar] 실행 시작: ${triggerTime.toISOString()}`);

  try {
    const today = new Date();
    const dateStr = formatDate(today);

    context.log(`[SyncFlexToCalendar] 날짜: ${dateStr}`);

    // 모든 직원 조회
    const employeeMaps = await getAllEmployeeMaps();
    const employeeNumbers = Array.from(employeeMaps.values()).map(e => e.employeeNumber);

    context.log(`[SyncFlexToCalendar] 전체 직원: ${employeeNumbers.length}명`);

    // 오늘의 휴가/외근 정보 조회
    const flexClient = getFlexClient();
    const timeOffUses = await flexClient.getTimeOffUses(dateStr, employeeNumbers);
    context.log(`[SyncFlexToCalendar] 휴가/외근: ${timeOffUses.length}건`);

    let syncCount = 0;

    for (const timeOff of timeOffUses) {
      // 사용자 이메일 찾기
      let userEmail: string | null = null;
      for (const [upn, employee] of employeeMaps) {
        if (employee.employeeNumber === timeOff.employeeNumber) {
          userEmail = upn;
          break;
        }
      }

      if (!userEmail) {
        context.warn(`[SyncFlexToCalendar] 이메일 없음: ${timeOff.employeeNumber}`);
        continue;
      }

      try {
        // 휴가 타입에 따라 제목 결정
        let subject = '휴가';
        let emoji = '🏖️';

        if (timeOff.timeOffType?.includes('연차')) {
          subject = '연차';
          emoji = '🏖️';
        } else if (timeOff.timeOffType?.includes('반차')) {
          subject = '반차';
          emoji = '🌤️';
        } else if (timeOff.timeOffType?.includes('외근')) {
          subject = '외근';
          emoji = '🚗';
        } else if (timeOff.timeOffType?.includes('재택')) {
          subject = '재택근무';
          emoji = '🏠';
        }

        // 시작/종료 시간 (전일이면 09:00~18:00)
        const startTime = timeOff.startAt || `${timeOff.startDate}T09:00:00`;
        const endTime = timeOff.endAt || `${timeOff.endDate}T18:00:00`;

        // Outlook 일정 생성
        await meetingRoomClient.createMeeting(userEmail, {
          subject: `${emoji} ${subject}`,
          startDateTime: startTime,
          endDateTime: endTime,
          attendees: [],
          body: timeOff.timeOffType || '',
          isOnlineMeeting: false,
        });

        syncCount++;
        context.log(`[SyncFlexToCalendar] 동기화 완료: ${userEmail} - ${subject}`);
      } catch (error: any) {
        // 이미 일정이 있거나 권한 문제면 스킵
        context.warn(`[SyncFlexToCalendar] 동기화 실패 (${userEmail}): ${error.message}`);
      }
    }

    context.log(`[SyncFlexToCalendar] 완료 - 동기화: ${syncCount}건`);
  } catch (error: any) {
    context.error('[SyncFlexToCalendar] 오류:', error);
    throw error;
  }
}

/**
 * 날짜 포맷팅 (YYYY-MM-DD)
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Timer: 매일 아침 8:00 KST (23:00 UTC 전날)
// Cron: 0 0 23 * * * (23:00 UTC = 다음날 08:00 KST)
app.timer('syncFlexToCalendar', {
  schedule: '0 0 23 * * *',
  handler: syncFlexToCalendarHandler,
});

export default syncFlexToCalendarHandler;
