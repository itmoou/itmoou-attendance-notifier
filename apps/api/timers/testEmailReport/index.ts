/**
 * Test Email Report Timer Function
 * 이메일 기능 테스트용 타이머 (07:20 UTC 1회 실행)
 */

import { app, InvocationContext, Timer } from '@azure/functions';
import { getOutlookClient } from '../../shared/outlookClient';

/**
 * 테스트 이메일 전송
 */
async function testEmailReportHandler(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  const triggerTime = new Date();
  context.log(`[TestEmailReport] 실행 시작: ${triggerTime.toISOString()}`);

  try {
    const hrEmail = process.env.HR_EMAIL || 'hr@itmoou.com';
    
    context.log(`[TestEmailReport] HR 이메일: ${hrEmail}`);

    // 테스트 리포트 HTML 생성
    const testHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>이메일 테스트</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { background-color: #0078d4; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
    .success { background-color: #d4edda; border: 2px solid #28a745; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .success h2 { color: #155724; margin-top: 0; }
    table { width: 100%; border-collapse: collapse; background-color: white; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #0078d4; color: white; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ 이메일 기능 테스트</h1>
      <p style="margin: 5px 0 0 0;">근태 알림 시스템 - 이메일 전송 확인</p>
    </div>
    <div class="content">
      <div class="success">
        <h2>🎉 이메일 전송 성공!</h2>
        <p>이 메시지를 받으셨다면 이메일 기능이 정상적으로 작동하고 있습니다.</p>
      </div>
      
      <h3>📋 시스템 정보</h3>
      <table>
        <tr>
          <th>항목</th>
          <th>값</th>
        </tr>
        <tr>
          <td>실행 시간</td>
          <td>${triggerTime.toISOString()}</td>
        </tr>
        <tr>
          <td>발신자</td>
          <td>${hrEmail}</td>
        </tr>
        <tr>
          <td>Function Name</td>
          <td>testEmailReport</td>
        </tr>
      </table>
      
      <h3>📅 예정된 알림 스케줄</h3>
      <table>
        <tr>
          <th>시간 (UTC)</th>
          <th>알림 내용</th>
        </tr>
        <tr>
          <td>11:05 (월~금)</td>
          <td>출근 체크 누락 알림 (1차)</td>
        </tr>
        <tr>
          <td>11:30 (월~금)</td>
          <td>출근 체크 누락 알림 (최종)</td>
        </tr>
        <tr>
          <td>20:30 (월~금)</td>
          <td>퇴근 체크 누락 알림 (1차)</td>
        </tr>
        <tr>
          <td>22:00 (월~금)</td>
          <td>퇴근 체크 누락 알림 (최종)</td>
        </tr>
        <tr>
          <td>22:10 (월~금)</td>
          <td>당일 누적 요약</td>
        </tr>
        <tr>
          <td><strong>09:00 (매일)</strong></td>
          <td><strong>전일 근태 누락 리포트 (이메일)</strong></td>
        </tr>
      </table>
      
      <hr style="margin: 30px 0;">
      <p style="text-align: center; color: #666;">
        <small>이 테스트 이메일은 자동으로 발송되었습니다.</small>
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();

    // Outlook Client로 이메일 전송
    const outlookClient = getOutlookClient();
    await outlookClient.sendHtmlEmail(
      [hrEmail],
      '✅ [테스트] 근태 알림 시스템 - 이메일 기능 확인',
      testHtml
    );

    context.log(`[TestEmailReport] 테스트 이메일 전송 완료: ${hrEmail}`);
    
  } catch (error: any) {
    context.error('[TestEmailReport] 처리 중 오류:', error);
    context.error('[TestEmailReport] 오류 상세:', error.message);
    if (error.response) {
      context.error('[TestEmailReport] 응답 데이터:', error.response.data);
      context.error('[TestEmailReport] 응답 상태:', error.response.status);
    }
    throw error;
  }
}

// Azure Functions Timer Trigger 등록
// 08:00 UTC 실행 (17:00 KST)
app.timer('testEmailReport', {
  schedule: '0 0 8 * * *',
  handler: testEmailReportHandler,
});

export default testEmailReportHandler;
