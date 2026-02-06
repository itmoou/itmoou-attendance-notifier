/**
 * Calendar Client
 * Microsoft Graph Calendar API를 사용한 Outlook 일정 관리
 */

import axios from 'axios';
import { getGraphAccessToken } from './graphClient';

export interface CalendarEvent {
  subject: string;
  body?: {
    contentType: 'HTML' | 'Text';
    content: string;
  };
  start: {
    dateTime: string; // ISO 8601 format
    timeZone: string;
  };
  end: {
    dateTime: string; // ISO 8601 format
    timeZone: string;
  };
  location?: {
    displayName: string;
  };
  isAllDay?: boolean;
  showAs?: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere' | 'unknown';
  categories?: string[];
}

export interface CreateVacationEventParams {
  userEmail: string;
  employeeName: string;
  vacationType: string; // "연차", "반차", "병가" 등
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason?: string;
}

/**
 * 사용자 캘린더에 휴가 일정 생성
 * @param params 휴가 일정 생성 파라미터
 */
export async function createVacationEvent(
  params: CreateVacationEventParams
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    console.log(`[CalendarClient] 휴가 일정 생성: ${params.userEmail} (${params.startDate} ~ ${params.endDate})`);

    const accessToken = await getGraphAccessToken();
    const graphBaseUrl = process.env.GRAPH_API_BASE_URL || 'https://graph.microsoft.com/v1.0';

    // 시작일과 종료일을 ISO 8601 형식으로 변환 (종일 이벤트)
    const startDateTime = `${params.startDate}T00:00:00`;
    const endDateTime = `${params.endDate}T23:59:59`;

    const event: CalendarEvent = {
      subject: `[휴가] ${params.employeeName} - ${params.vacationType}`,
      body: {
        contentType: 'Text',
        content: params.reason || `${params.vacationType} 사용`,
      },
      start: {
        dateTime: startDateTime,
        timeZone: 'Asia/Seoul',
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'Asia/Seoul',
      },
      isAllDay: true,
      showAs: 'oof', // Out of Office
      categories: ['휴가', params.vacationType],
    };

    const response = await axios.post(
      `${graphBaseUrl}/users/${encodeURIComponent(params.userEmail)}/calendar/events`,
      event,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const eventId = response.data.id;
    console.log(`[CalendarClient] 휴가 일정 생성 완료: ${eventId}`);

    return { success: true, eventId };
  } catch (error: any) {
    const errorMsg = error.response?.data?.error?.message || error.message || '알 수 없는 오류';
    console.error(`[CalendarClient] 휴가 일정 생성 실패: ${params.userEmail}`, error);
    return { success: false, error: errorMsg };
  }
}

/**
 * 팀 공유 캘린더에 휴가 일정 추가
 * @param params 휴가 일정 생성 파라미터
 * @param sharedCalendarId 공유 캘린더 ID (선택 사항)
 */
export async function createTeamVacationEvent(
  params: CreateVacationEventParams,
  sharedCalendarId?: string
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    // 공유 캘린더 ID가 없으면 HR 이메일 사용
    const calendarOwner = sharedCalendarId || process.env.HR_EMAIL || 'hr@itmoou.com';
    
    console.log(`[CalendarClient] 팀 캘린더에 휴가 일정 생성: ${calendarOwner}`);

    const accessToken = await getGraphAccessToken();
    const graphBaseUrl = process.env.GRAPH_API_BASE_URL || 'https://graph.microsoft.com/v1.0';

    const startDateTime = `${params.startDate}T00:00:00`;
    const endDateTime = `${params.endDate}T23:59:59`;

    const event: CalendarEvent = {
      subject: `[휴가] ${params.employeeName} - ${params.vacationType}`,
      body: {
        contentType: 'HTML',
        content: `
          <div>
            <p><strong>직원:</strong> ${params.employeeName}</p>
            <p><strong>휴가 유형:</strong> ${params.vacationType}</p>
            <p><strong>기간:</strong> ${params.startDate} ~ ${params.endDate}</p>
            ${params.reason ? `<p><strong>사유:</strong> ${params.reason}</p>` : ''}
          </div>
        `,
      },
      start: {
        dateTime: startDateTime,
        timeZone: 'Asia/Seoul',
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'Asia/Seoul',
      },
      isAllDay: true,
      showAs: 'free', // 팀 캘린더는 free로 표시
      categories: ['팀휴가', params.vacationType, params.employeeName],
    };

    const response = await axios.post(
      `${graphBaseUrl}/users/${encodeURIComponent(calendarOwner)}/calendar/events`,
      event,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const eventId = response.data.id;
    console.log(`[CalendarClient] 팀 캘린더 일정 생성 완료: ${eventId}`);

    return { success: true, eventId };
  } catch (error: any) {
    const errorMsg = error.response?.data?.error?.message || error.message || '알 수 없는 오류';
    console.error(`[CalendarClient] 팀 캘린더 일정 생성 실패`, error);
    return { success: false, error: errorMsg };
  }
}

/**
 * 캘린더 이벤트 삭제
 * @param userEmail 사용자 이메일
 * @param eventId 이벤트 ID
 */
export async function deleteCalendarEvent(
  userEmail: string,
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[CalendarClient] 캘린더 이벤트 삭제: ${eventId}`);

    const accessToken = await getGraphAccessToken();
    const graphBaseUrl = process.env.GRAPH_API_BASE_URL || 'https://graph.microsoft.com/v1.0';

    await axios.delete(
      `${graphBaseUrl}/users/${encodeURIComponent(userEmail)}/calendar/events/${eventId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    console.log(`[CalendarClient] 캘린더 이벤트 삭제 완료: ${eventId}`);
    return { success: true };
  } catch (error: any) {
    const errorMsg = error.response?.data?.error?.message || error.message || '알 수 없는 오류';
    console.error(`[CalendarClient] 캘린더 이벤트 삭제 실패: ${eventId}`, error);
    return { success: false, error: errorMsg };
  }
}

/**
 * 일괄 휴가 일정 생성
 * @param vacations 휴가 일정 목록
 */
export async function createBulkVacationEvents(
  vacations: CreateVacationEventParams[]
): Promise<{ successCount: number; failedCount: number; results: any[] }> {
  console.log(`[CalendarClient] 일괄 휴가 일정 생성: ${vacations.length}건`);

  const results = await Promise.all(
    vacations.map(async (vacation) => {
      const result = await createVacationEvent(vacation);
      return { ...vacation, ...result };
    })
  );

  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;

  console.log(`[CalendarClient] 일괄 생성 완료: 성공 ${successCount}건, 실패 ${failedCount}건`);

  return { successCount, failedCount, results };
}
