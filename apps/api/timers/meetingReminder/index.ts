/**
 * Meeting Reminder Timer
 * 매 10분마다 실행되어 30분 후 시작하는 회의를 확인하고 알림
 */

import { app, InvocationContext, Timer } from '@azure/functions';
import { getAllEmployeeMaps } from '../../shared/storage/employeeMapRepo';
import outlookCalendarClient, { CalendarEvent } from '../../shared/outlookCalendarClient';
import { sendProactiveMessage } from '../../shared/teamsClient';
import { wasSent, markSent } from '../../shared/storage/notifyStateRepo';

async function meetingReminderHandler(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  const triggerTime = new Date(myTimer.scheduleStatus?.last || new Date());
  context.log(`[MeetingReminder] 실행 시작: ${triggerTime.toISOString()}`);

  try {
    const now = new Date();
    // 30분 후 (±5분 범위)
    const targetTime = new Date(now.getTime() + 30 * 60 * 1000);
    const startRange = new Date(targetTime.getTime() - 5 * 60 * 1000);
    const endRange = new Date(targetTime.getTime() + 5 * 60 * 1000);

    context.log(`[MeetingReminder] 확인 범위: ${startRange.toISOString()} ~ ${endRange.toISOString()}`);

    // 모든 직원 조회
    const employeeMaps = await getAllEmployeeMaps();
    context.log(`[MeetingReminder] 전체 직원: ${employeeMaps.size}명`);

    let notifyCount = 0;
    let skipCount = 0;

    // 각 직원의 일정 확인
    for (const [upn, employee] of employeeMaps) {
      try {
        // 오늘의 일정 조회
        const events = await outlookCalendarClient.getTodayCalendar(upn);

        // 30분 후 시작하는 회의 필터링
        const upcomingEvents = events.filter(event => {
          const startTime = new Date(event.start.dateTime);
          return startTime >= startRange && startTime <= endRange;
        });

        if (upcomingEvents.length === 0) {
          continue;
        }

        // 각 회의에 대해 알림
        for (const event of upcomingEvents) {
          const notifyKey = `meeting_${event.id}_${upn}`;
          const today = formatDate(now);

          // 이미 알림을 보냈는지 확인
          if (await wasSent(today, upn, 'meetingReminder')) {
            context.log(`[MeetingReminder] 이미 알림 전송: ${upn} - ${event.subject}`);
            skipCount++;
            continue;
          }

          // 알림 메시지 생성
          const message = formatMeetingReminderMessage(event);

          // Teams로 전송
          await sendProactiveMessage(upn, message);

          // 알림 기록 저장
          await markSent(today, upn, 'meetingReminder');

          notifyCount++;
          context.log(`[MeetingReminder] 알림 전송: ${upn} - ${event.subject}`);
        }
      } catch (error: any) {
        context.error(`[MeetingReminder] 오류 (${upn}):`, error.message);
      }
    }

    context.log(`[MeetingReminder] 완료 - 알림: ${notifyCount}건, 스킵: ${skipCount}건`);
  } catch (error: any) {
    context.error('[MeetingReminder] 오류:', error);
    throw error;
  }
}

/**
 * 회의 리마인더 메시지 포맷팅
 */
function formatMeetingReminderMessage(event: CalendarEvent): string {
  const start = new Date(event.start.dateTime);
  const timeStr = `${formatTime(start)}`;

  let message = `⏰ **회의 알림** - 30분 후 시작\n\n`;
  message += `**${event.subject || '(제목 없음)'}**\n`;
  message += `🕐 ${timeStr} 시작\n`;

  if (event.location?.displayName) {
    message += `📍 ${event.location.displayName}\n`;
  } else if (event.isOnlineMeeting) {
    message += `📍 온라인 회의 (Teams)\n`;
    if (event.onlineMeetingUrl) {
      message += `🔗 [참여하기](${event.onlineMeetingUrl})\n`;
    }
  }

  if (event.attendees && event.attendees.length > 0) {
    const attendeeNames = event.attendees
      .filter(a => a.emailAddress?.name)
      .map(a => a.emailAddress!.name!)
      .slice(0, 5);

    if (attendeeNames.length > 0) {
      message += `👥 ${attendeeNames.join(', ')}`;
      if (event.attendees.length > 5) {
        message += ` 외 ${event.attendees.length - 5}명`;
      }
      message += '\n';
    }
  }

  message += `\n준비해주세요! 💼`;

  return message;
}

/**
 * 시간 포맷팅
 */
function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
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

// Timer: 매 10분마다 실행
// Cron: 0 */10 * * * * (매 10분)
app.timer('meetingReminder', {
  schedule: '0 */10 * * * *',
  handler: meetingReminderHandler,
});

export default meetingReminderHandler;
