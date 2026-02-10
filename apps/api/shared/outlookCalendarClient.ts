/**
 * Outlook Calendar Client
 * Graph API를 사용하여 사용자의 Outlook 일정을 조회합니다.
 */

import axios from 'axios';
import { getGraphAccessToken } from './graphClient';

export interface CalendarEvent {
  id: string;
  subject: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName?: string;
    locationType?: string;
  };
  attendees?: Array<{
    emailAddress?: {
      name?: string;
      address?: string;
    };
    type?: string;
  }>;
  organizer?: {
    emailAddress?: {
      name?: string;
      address?: string;
    };
  };
  isOnlineMeeting?: boolean;
  onlineMeetingUrl?: string;
  body?: {
    content?: string;
    contentType?: string;
  };
}

/**
 * 사용자의 오늘 일정 조회
 */
export async function getTodayCalendar(userEmail: string): Promise<CalendarEvent[]> {
  const token = await getGraphAccessToken();

  // 오늘 00:00 ~ 23:59 (KST)
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

  const startDateTime = startOfDay.toISOString();
  const endDateTime = endOfDay.toISOString();

  try {
    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/users/${userEmail}/calendar/calendarView`,
      {
        params: {
          startDateTime,
          endDateTime,
          $select: 'id,subject,start,end,location,attendees,organizer,isOnlineMeeting,onlineMeetingUrl,body',
          $orderby: 'start/dateTime',
          $top: 50,
        },
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'outlook.timezone="Asia/Seoul"',
        },
      }
    );

    return response.data.value || [];
  } catch (error: any) {
    console.error(`[OutlookCalendar] 일정 조회 실패 (${userEmail}):`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * 특정 날짜의 일정 조회
 */
export async function getCalendarByDate(
  userEmail: string,
  date: Date
): Promise<CalendarEvent[]> {
  const token = await getGraphAccessToken();

  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);

  const startDateTime = startOfDay.toISOString();
  const endDateTime = endOfDay.toISOString();

  try {
    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/users/${userEmail}/calendar/calendarView`,
      {
        params: {
          startDateTime,
          endDateTime,
          $select: 'id,subject,start,end,location,attendees,organizer,isOnlineMeeting,onlineMeetingUrl,body',
          $orderby: 'start/dateTime',
          $top: 50,
        },
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'outlook.timezone="Asia/Seoul"',
        },
      }
    );

    return response.data.value || [];
  } catch (error: any) {
    console.error(`[OutlookCalendar] 일정 조회 실패 (${userEmail}, ${date}):`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * 일정을 보기 좋은 텍스트로 포맷팅
 */
export function formatCalendarEvent(event: CalendarEvent): string {
  const start = new Date(event.start.dateTime);
  const end = new Date(event.end.dateTime);

  const timeStr = `${formatTime(start)} - ${formatTime(end)}`;
  const subject = event.subject || '(제목 없음)';

  let result = `**${timeStr}** | ${subject}\n`;

  // 장소
  if (event.location?.displayName) {
    result += `📍 ${event.location.displayName}\n`;
  } else if (event.isOnlineMeeting) {
    result += `📍 온라인 회의 (Teams)\n`;
  }

  // 참석자 (본인 제외, 최대 5명)
  if (event.attendees && event.attendees.length > 0) {
    const attendeeNames = event.attendees
      .filter(a => a.emailAddress?.name)
      .map(a => a.emailAddress!.name!)
      .slice(0, 5);

    if (attendeeNames.length > 0) {
      result += `👥 ${attendeeNames.join(', ')}`;
      if (event.attendees.length > 5) {
        result += ` 외 ${event.attendees.length - 5}명`;
      }
      result += '\n';
    }
  }

  return result;
}

/**
 * 오늘의 일정을 Teams 메시지로 포맷팅
 */
export function formatTodayCalendarMessage(events: CalendarEvent[]): string {
  const today = new Date();
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

  if (events.length === 0) {
    return `📅 **오늘의 일정** (${dateStr})\n\n오늘은 등록된 일정이 없습니다.\n\n좋은 하루 되세요! ☀️`;
  }

  let message = `📅 **오늘의 일정** (${dateStr})\n\n`;

  events.forEach((event, index) => {
    message += formatCalendarEvent(event);
    if (index < events.length - 1) {
      message += '\n';
    }
  });

  message += `\n좋은 하루 되세요! ☀️`;

  return message;
}

/**
 * 시간 포맷팅 (HH:MM)
 */
function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export default {
  getTodayCalendar,
  getCalendarByDate,
  formatCalendarEvent,
  formatTodayCalendarMessage,
};
