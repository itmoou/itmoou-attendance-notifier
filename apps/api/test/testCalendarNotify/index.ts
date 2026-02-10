/**
 * Test Calendar Notify
 * 일정 알림 기능 테스트용 HTTP 엔드포인트
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import outlookCalendarClient from '../../shared/outlookCalendarClient';
import { sendProactiveMessage } from '../../shared/teamsClient';

async function testCalendarNotifyHandler(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('[TestCalendarNotify] 테스트 시작');

  try {
    // Query parameter로 이메일 받기
    const userEmail = req.query.get('email');

    if (!userEmail) {
      return {
        status: 400,
        body: JSON.stringify({
          error: 'email parameter required',
          usage: '/api/test/calendar-notify?email=user@itmoou.com',
        }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    context.log(`[TestCalendarNotify] 사용자: ${userEmail}`);

    // 오늘의 일정 조회
    const events = await outlookCalendarClient.getTodayCalendar(userEmail);
    context.log(`[TestCalendarNotify] ${events.length}개 일정 조회`);

    // 메시지 생성
    const message = outlookCalendarClient.formatTodayCalendarMessage(events);
    context.log(`[TestCalendarNotify] 메시지 생성 완료`);

    // Teams로 전송
    await sendProactiveMessage(userEmail, message);
    context.log(`[TestCalendarNotify] Teams 전송 완료`);

    return {
      status: 200,
      body: JSON.stringify({
        success: true,
        userEmail,
        eventCount: events.length,
        message,
        events: events.map(e => ({
          subject: e.subject,
          start: e.start.dateTime,
          end: e.end.dateTime,
          location: e.location?.displayName,
        })),
      }),
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    };
  } catch (error: any) {
    context.error('[TestCalendarNotify] 오류:', error);

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

app.http('testCalendarNotify', {
  methods: ['GET', 'POST'],
  authLevel: 'function',
  route: 'test/calendar-notify',
  handler: testCalendarNotifyHandler,
});

export default testCalendarNotifyHandler;
