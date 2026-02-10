/**
 * Test Meeting Room
 * 회의실 예약 기능 테스트용 HTTP 엔드포인트
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import meetingRoomClient from '../../shared/meetingRoomClient';

async function testMeetingRoomHandler(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('[TestMeetingRoom] 테스트 시작');

  try {
    const action = req.query.get('action') || 'list';

    // 회의실 목록 조회
    if (action === 'list') {
      const rooms = await meetingRoomClient.getAvailableMeetingRooms();
      context.log(`[TestMeetingRoom] 회의실 ${rooms.length}개 조회`);

      return {
        status: 200,
        body: JSON.stringify({
          success: true,
          rooms,
        }),
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      };
    }

    // 회의 생성
    if (action === 'create') {
      const bodyText = await req.text();
      const body = JSON.parse(bodyText || '{}');

      const organizerEmail = body.organizerEmail || req.query.get('email');

      if (!organizerEmail) {
        return {
          status: 400,
          body: JSON.stringify({
            error: 'organizerEmail required',
            usage: {
              method: 'POST',
              body: {
                organizerEmail: 'user@itmoou.com',
                subject: '팀 회의',
                startDateTime: '2026-02-10T14:00:00',
                endDateTime: '2026-02-10T15:00:00',
                location: '3층 회의실 A',
                attendees: ['user2@itmoou.com', 'user3@itmoou.com'],
                isOnlineMeeting: false,
              },
            },
          }),
          headers: { 'Content-Type': 'application/json' },
        };
      }

      const result = await meetingRoomClient.createMeeting(organizerEmail, {
        subject: body.subject || '회의',
        startDateTime: body.startDateTime,
        endDateTime: body.endDateTime,
        location: body.location,
        attendees: body.attendees || [],
        body: body.body,
        isOnlineMeeting: body.isOnlineMeeting,
      });

      context.log(`[TestMeetingRoom] 회의 생성 완료: ${result.id}`);

      return {
        status: 200,
        body: JSON.stringify({
          success: true,
          eventId: result.id,
          webLink: result.webLink,
        }),
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      };
    }

    return {
      status: 400,
      body: JSON.stringify({
        error: 'Invalid action',
        usage: {
          list: '/api/test/meeting-room?action=list',
          create: 'POST /api/test/meeting-room?action=create',
        },
      }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error: any) {
    context.error('[TestMeetingRoom] 오류:', error);

    return {
      status: 500,
      body: JSON.stringify({
        error: error.message,
        stack: error.stack,
      }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
}

app.http('testMeetingRoom', {
  methods: ['GET', 'POST'],
  authLevel: 'function',
  route: 'test/meeting-room',
  handler: testMeetingRoomHandler,
});

export default testMeetingRoomHandler;
