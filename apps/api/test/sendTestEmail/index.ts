/**
 * Test Email Sender - HTTP Trigger
 * 즉시 테스트 이메일을 보낼 수 있는 HTTP 엔드포인트
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getOutlookClient } from '../../shared/outlookClient';

async function sendTestEmailHandler(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('[SendTestEmail] HTTP 요청 수신');

  try {
    const hrEmailEnv = process.env.HR_EMAIL || 'hr@itmoou.com';
    
    // 쉼표로 구분된 여러 수신자 지원
    const hrEmails = hrEmailEnv.split(',').map(email => email.trim()).filter(email => email.length > 0);
    
    context.log(`[SendTestEmail] HR 이메일: ${hrEmails.join(', ')}`);
    context.log(`[SendTestEmail] AZURE_CLIENT_ID: ${process.env.AZURE_CLIENT_ID ? '설정됨' : '미설정'}`);
    context.log(`[SendTestEmail] AZURE_CLIENT_SECRET: ${process.env.AZURE_CLIENT_SECRET ? '설정됨' : '미설정'}`);
    context.log(`[SendTestEmail] BOT_TENANT_ID: ${process.env.BOT_TENANT_ID ? '설정됨' : '미설정'}`);

    const triggerTime = new Date();

    // 테스트 이메일 HTML
    const testHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>HTTP 테스트 이메일</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { background-color: #0078d4; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .success { background-color: #d4edda; border: 2px solid #28a745; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .info { background-color: #d1ecf1; border: 2px solid #0c5460; padding: 15px; border-radius: 8px; margin: 20px 0; }
    table { width: 100%; border-collapse: collapse; background-color: white; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #0078d4; color: white; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ HTTP 테스트 이메일</h1>
      <p style="margin: 5px 0 0 0;">근태 알림 시스템 - 즉시 테스트</p>
    </div>
    
    <div class="success">
      <h2>🎉 이메일 전송 성공!</h2>
      <p>HTTP 엔드포인트를 통해 즉시 이메일이 전송되었습니다.</p>
    </div>
    
    <div class="info">
      <h3>📋 실행 정보</h3>
      <table>
        <tr><th>항목</th><th>값</th></tr>
        <tr><td>실행 시간</td><td>${triggerTime.toISOString()}</td></tr>
        <tr><td>실행 방법</td><td>HTTP Trigger (즉시 실행)</td></tr>
        <tr><td>발신자</td><td>${process.env.HR_FROM_EMAIL || 'hr@itmoou.com'}</td></tr>
        <tr><td>수신자</td><td>${hrEmails.join(', ')}</td></tr>
        <tr><td>Function</td><td>sendTestEmail</td></tr>
      </table>
    </div>
    
    <div class="info">
      <h3>✅ 확인된 사항</h3>
      <ul>
        <li>✅ Azure Function App 정상 작동</li>
        <li>✅ Outlook Client 정상 작동</li>
        <li>✅ Graph API 인증 성공</li>
        <li>✅ Mail.Send 권한 정상</li>
        <li>✅ 이메일 전송 기능 정상</li>
      </ul>
    </div>
    
    <h3>📅 타이머 함수 스케줄</h3>
    <table>
      <tr><th>시간 (UTC)</th><th>한국 시간</th><th>알림 내용</th></tr>
      <tr><td>02:05 (월~금)</td><td>11:05</td><td>출근 체크 누락 (1차)</td></tr>
      <tr><td>02:30 (월~금)</td><td>11:30</td><td>출근 체크 누락 (최종)</td></tr>
      <tr><td>11:30 (월~금)</td><td>20:30</td><td>퇴근 체크 누락 (1차)</td></tr>
      <tr><td>13:00 (월~금)</td><td>22:00</td><td>퇴근 체크 누락 (최종)</td></tr>
      <tr><td>13:10 (월~금)</td><td>22:10</td><td>당일 누적 요약</td></tr>
      <tr><td>00:00 (매일)</td><td>09:00</td><td>전일 리포트 (이메일)</td></tr>
    </table>
    
    <hr style="margin: 30px 0;">
    <p style="text-align: center; color: #666;">
      <small>이 테스트 이메일은 HTTP 요청을 통해 즉시 발송되었습니다.</small>
    </p>
  </div>
</body>
</html>
    `.trim();

    // Outlook Client로 이메일 전송
    const outlookClient = getOutlookClient();
    await outlookClient.sendHtmlEmail(
      hrEmails,
      '✅ [HTTP 테스트] 근태 알림 시스템 - 이메일 기능 확인',
      testHtml
    );

    context.log(`[SendTestEmail] 테스트 이메일 전송 완료: ${hrEmails.join(', ')}`);
    
    return {
      status: 200,
      jsonBody: {
        success: true,
        message: `테스트 이메일이 ${hrEmails.join(', ')}로 전송되었습니다.`,
        timestamp: triggerTime.toISOString(),
      },
    };
    
  } catch (error: any) {
    context.error('[SendTestEmail] 처리 중 오류:', error);
    context.error('[SendTestEmail] 오류 상세:', error.message);
    if (error.response) {
      context.error('[SendTestEmail] 응답 데이터:', JSON.stringify(error.response.data));
      context.error('[SendTestEmail] 응답 상태:', error.response.status);
    }
    
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: error.message,
        details: error.response?.data || null,
      },
    };
  }
}

app.http('sendTestEmail', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'test/send-email',
  handler: sendTestEmailHandler,
});

export default sendTestEmailHandler;
