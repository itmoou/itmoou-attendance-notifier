/**
 * Meeting Room Client
 * Outlook Calendar API를 사용하여 회의실 예약
 */

import axios from 'axios';
import { getGraphAccessToken } from './graphClient';

export interface MeetingRoom {
  id: string;
  displayName: string;
  emailAddress: string;
}

export interface CreateMeetingRequest {
  subject: string;
  startDateTime: string; // ISO 8601
  endDateTime: string;   // ISO 8601
  location?: string;
  attendees: string[];    // email addresses
  body?: string;
  isOnlineMeeting?: boolean;
}

/**
 * 사용 가능한 회의실 목록 조회
 */
export async function getAvailableMeetingRooms(): Promise<MeetingRoom[]> {
  const token = await getGraphAccessToken();

  try {
    // 회의실 리소스 조회 (Room 타입의 리소스)
    const response = await axios.get(
      'https://graph.microsoft.com/v1.0/places/microsoft.graph.room',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.value.map((room: any) => ({
      id: room.id,
      displayName: room.displayName || room.nickname,
      emailAddress: room.emailAddress,
    }));
  } catch (error: any) {
    console.error('[MeetingRoom] 회의실 목록 조회 실패:', error.response?.data || error.message);

    // 회의실 API가 없으면 임시 목록 반환
    return [
      { id: '1', displayName: '3층 회의실 A', emailAddress: 'room3a@itmoou.com' },
      { id: '2', displayName: '3층 회의실 B', emailAddress: 'room3b@itmoou.com' },
      { id: '3', displayName: '4층 회의실 A', emailAddress: 'room4a@itmoou.com' },
      { id: '4', displayName: '4층 회의실 B', emailAddress: 'room4b@itmoou.com' },
    ];
  }
}

/**
 * 회의 생성 (회의실 포함)
 */
export async function createMeeting(
  organizerEmail: string,
  request: CreateMeetingRequest
): Promise<{ id: string; webLink: string }> {
  const token = await getGraphAccessToken();

  const attendees = request.attendees.map(email => ({
    emailAddress: {
      address: email,
      name: email,
    },
    type: 'required',
  }));

  // 회의실도 참석자로 추가 (location이 이메일 형식이면)
  if (request.location && request.location.includes('@')) {
    attendees.push({
      emailAddress: {
        address: request.location,
        name: request.location,
      },
      type: 'resource',
    });
  }

  const event = {
    subject: request.subject,
    start: {
      dateTime: request.startDateTime,
      timeZone: 'Asia/Seoul',
    },
    end: {
      dateTime: request.endDateTime,
      timeZone: 'Asia/Seoul',
    },
    location: {
      displayName: request.location || '',
    },
    attendees,
    body: {
      contentType: 'text',
      content: request.body || '',
    },
    isOnlineMeeting: request.isOnlineMeeting || false,
    onlineMeetingProvider: request.isOnlineMeeting ? 'teamsForBusiness' : undefined,
  };

  try {
    const response = await axios.post(
      `https://graph.microsoft.com/v1.0/users/${organizerEmail}/calendar/events`,
      event,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      id: response.data.id,
      webLink: response.data.webLink,
    };
  } catch (error: any) {
    console.error('[MeetingRoom] 회의 생성 실패:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 회의 취소
 */
export async function cancelMeeting(
  organizerEmail: string,
  eventId: string,
  comment?: string
): Promise<void> {
  const token = await getGraphAccessToken();

  try {
    await axios.post(
      `https://graph.microsoft.com/v1.0/users/${organizerEmail}/calendar/events/${eventId}/cancel`,
      {
        comment: comment || '회의가 취소되었습니다.',
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`[MeetingRoom] 회의 취소 완료: ${eventId}`);
  } catch (error: any) {
    console.error('[MeetingRoom] 회의 취소 실패:', error.response?.data || error.message);
    throw error;
  }
}

export default {
  getAvailableMeetingRooms,
  createMeeting,
  cancelMeeting,
};
