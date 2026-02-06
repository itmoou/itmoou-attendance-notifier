/**
 * Vacation Approved HTTP Trigger
 * 휴가 승인 시 호출되는 Webhook
 * 
 * 기능:
 * 1. 휴가 승인 알림 (Teams Bot)
 * 2. Outlook 개인 캘린더에 휴가 일정 자동 등록
 * 3. 팀 공유 캘린더에 휴가 표시
 * 
 * POST /api/vacation/approved
 * Body:
 * {
 *   "employeeNumber": "123456",
 *   "employeeName": "홍길동",
 *   "employeeEmail": "hong@itmoou.com",
 *   "vacationType": "연차",
 *   "startDate": "2024-02-10",
 *   "endDate": "2024-02-12",
 *   "reason": "개인 휴가"
 * }
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { createVacationEvent, createTeamVacationEvent } from '../../shared/calendarClient';
import { sendProactiveMessage } from '../../shared/teamsClient';
import { getUpnByEmployeeNumber } from '../../shared/storage/employeeMapRepo';

interface VacationApprovalRequest {
  employeeNumber: string;
  employeeName: string;
  employeeEmail: string;
  vacationType: string; // "연차", "반차", "병가" 등
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason?: string;
}

const httpTrigger = async function (
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('[VacationApproved] ========== 휴가 승인 처리 시작 ==========');

  try {
    // 요청 바디 로깅 (디버깅용)
    const rawBody = await req.text();
    context.log('[VacationApproved] 받은 raw body:', rawBody);
    
    // 요청 바디 검증
    let body: VacationApprovalRequest;
    try {
      body = JSON.parse(rawBody) as VacationApprovalRequest;
    } catch (parseError: any) {
      context.error('[VacationApproved] JSON 파싱 실패:', parseError.message);
      return {
        status: 400,
        jsonBody: {
          success: false,
          error: `JSON 파싱 오류: ${parseError.message}. 받은 데이터: ${rawBody.substring(0, 100)}`,
        },
      };
    }

    if (!body || !body.employeeNumber || !body.employeeName || !body.startDate || !body.endDate) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          error: '필수 필드가 누락되었습니다. (employeeNumber, employeeName, startDate, endDate)',
        },
      };
    }

    const { employeeNumber, employeeName, employeeEmail, vacationType, startDate, endDate, reason } = body;

    console.log(`[VacationApproved] 직원: ${employeeName} (${employeeNumber})`);
    console.log(`[VacationApproved] 휴가: ${vacationType}, ${startDate} ~ ${endDate}`);

    // 1. UPN 조회 (Teams 알림용)
    const upn = await getUpnByEmployeeNumber(employeeNumber);
    
    if (!upn) {
      console.warn(`[VacationApproved] UPN을 찾을 수 없음: ${employeeNumber}`);
    }

    // 2. Outlook 개인 캘린더에 일정 등록
    let personalCalendarResult = null;
    if (employeeEmail) {
      personalCalendarResult = await createVacationEvent({
        userEmail: employeeEmail,
        employeeName,
        vacationType: vacationType || '연차',
        startDate,
        endDate,
        reason,
      });

      if (personalCalendarResult.success) {
        console.log(`[VacationApproved] 개인 캘린더 일정 생성 완료: ${personalCalendarResult.eventId}`);
      } else {
        console.error(`[VacationApproved] 개인 캘린더 일정 생성 실패: ${personalCalendarResult.error}`);
      }
    } else {
      console.warn(`[VacationApproved] 이메일 없음, 개인 캘린더 생성 스킵`);
    }

    // 3. 팀 공유 캘린더에 일정 등록
    const teamCalendarResult = await createTeamVacationEvent({
      userEmail: employeeEmail || 'unknown@itmoou.com',
      employeeName,
      vacationType: vacationType || '연차',
      startDate,
      endDate,
      reason,
    });

    if (teamCalendarResult.success) {
      console.log(`[VacationApproved] 팀 캘린더 일정 생성 완료: ${teamCalendarResult.eventId}`);
    } else {
      console.error(`[VacationApproved] 팀 캘린더 일정 생성 실패: ${teamCalendarResult.error}`);
    }

    // 4. Teams Bot으로 승인 알림 발송
    if (upn) {
      const approvalMessage = `
🎉 **휴가 승인 완료**

안녕하세요, ${employeeName}님!

신청하신 휴가가 승인되었습니다.

**휴가 정보:**
- 휴가 유형: ${vacationType || '연차'}
- 기간: ${startDate} ~ ${endDate}
${reason ? `- 사유: ${reason}` : ''}

✅ Outlook 캘린더에 자동으로 등록되었습니다.

즐거운 휴가 보내세요! 🌴
      `.trim();

      const messageResult = await sendProactiveMessage(upn, approvalMessage);
      
      if (messageResult.success) {
        console.log(`[VacationApproved] Teams 알림 발송 완료: ${upn}`);
      } else {
        console.error(`[VacationApproved] Teams 알림 발송 실패: ${messageResult.error}`);
      }
    }

    // 5. 응답 반환
    console.log('[VacationApproved] ========== 휴가 승인 처리 완료 ==========');
    
    return {
      status: 200,
      jsonBody: {
        success: true,
        message: '휴가 승인 처리 완료',
        data: {
          employeeName,
          vacationType,
          period: `${startDate} ~ ${endDate}`,
          personalCalendar: personalCalendarResult?.success || false,
          teamCalendar: teamCalendarResult?.success || false,
          teamsNotification: upn ? true : false,
        },
      },
    };
  } catch (error: any) {
    console.error('[VacationApproved] 처리 실패:', error);
    
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: error.message || '휴가 승인 처리 중 오류 발생',
      },
    };
  }
};

// HTTP trigger 등록
app.http('vacationApproved', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'vacation/approved',
  handler: httpTrigger,
});
