/**
 * Outlook Client
 * Outlook 이메일 전송을 위한 클라이언트
 */

import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';

export interface EmailMessage {
  to: string[]; // 수신자 이메일 목록
  subject: string;
  body: string;
  bodyType?: 'text' | 'html';
  cc?: string[];
  bcc?: string[];
  from?: string; // 발신자 (설정된 경우)
}

class OutlookClient {
  private client: Client;

  constructor() {
    // Client Credentials Flow를 사용한 인증
    this.client = Client.init({
      authProvider: async (done) => {
        try {
          const token = await this.getAccessToken();
          done(null, token);
        } catch (error) {
          done(error as Error, null);
        }
      },
    });
  }

  /**
   * Azure AD Access Token 획득 (Client Credentials Flow)
   */
  private async getAccessToken(): Promise<string> {
    try {
      const axios = require('axios');
      const response = await axios.post(
        `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
        new URLSearchParams({
          client_id: process.env.AZURE_CLIENT_ID || '',
          client_secret: process.env.AZURE_CLIENT_SECRET || '',
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.data.access_token;
    } catch (error) {
      console.error('[OutlookClient] Access Token 획득 실패:', error);
      throw error;
    }
  }

  /**
   * 이메일 전송
   * @param email 이메일 정보
   */
  async sendEmail(email: EmailMessage): Promise<void> {
    try {
      console.log(`[OutlookClient] 이메일 전송 시도: ${email.to.join(', ')}`);

      const fromEmail = email.from || process.env.HR_EMAIL;

      if (!fromEmail) {
        throw new Error('발신자 이메일이 설정되지 않았습니다.');
      }

      // TODO: 실제 Graph API endpoint로 변경
      const message = {
        message: {
          subject: email.subject,
          body: {
            contentType: email.bodyType === 'text' ? 'Text' : 'HTML',
            content: email.body,
          },
          toRecipients: email.to.map((addr) => ({
            emailAddress: {
              address: addr,
            },
          })),
          ccRecipients: email.cc?.map((addr) => ({
            emailAddress: {
              address: addr,
            },
          })),
          bccRecipients: email.bcc?.map((addr) => ({
            emailAddress: {
              address: addr,
            },
          })),
        },
        saveToSentItems: true,
      };

      // 대신 보내기 (Send on behalf)
      await this.client.api(`/users/${fromEmail}/sendMail`).post(message);

      console.log(`[OutlookClient] 이메일 전송 완료: ${email.to.join(', ')}`);
    } catch (error) {
      console.error('[OutlookClient] 이메일 전송 실패:', error);
      throw error;
    }
  }

  /**
   * HTML 형식 이메일 전송
   */
  async sendHtmlEmail(to: string[], subject: string, htmlBody: string): Promise<void> {
    await this.sendEmail({
      to,
      subject,
      body: htmlBody,
      bodyType: 'html',
    });
  }

  /**
   * 근태 누락 리포트 이메일 생성
   */
  createAttendanceReportHtml(
    date: string,
    missingCheckIns: Array<{ name: string; email: string }>,
    missingCheckOuts: Array<{ name: string; email: string }>
  ): string {
    const totalMissing = missingCheckIns.length + missingCheckOuts.length;

    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { background-color: #0078d4; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
    .summary { background-color: white; padding: 15px; border-left: 4px solid #0078d4; margin-bottom: 20px; }
    .section { margin-bottom: 30px; }
    .section h2 { color: #0078d4; font-size: 18px; border-bottom: 2px solid #0078d4; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; background-color: white; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #0078d4; color: white; font-weight: 600; }
    tr:hover { background-color: #f5f5f5; }
    .count { font-size: 28px; font-weight: bold; color: #d13438; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 근태 누락 일일 리포트</h1>
      <p style="margin: 5px 0 0 0;">${date} 근태 현황</p>
    </div>
    <div class="content">
      <div class="summary">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">총 누락 건수</p>
        <p class="count">${totalMissing}건</p>
      </div>
`;

    if (missingCheckIns.length > 0) {
      html += `
      <div class="section">
        <h2>🔴 출근 미체크 (${missingCheckIns.length}명)</h2>
        <table>
          <thead>
            <tr>
              <th>No.</th>
              <th>이름</th>
              <th>이메일</th>
            </tr>
          </thead>
          <tbody>
`;
      missingCheckIns.forEach((emp, idx) => {
        html += `
            <tr>
              <td>${idx + 1}</td>
              <td>${emp.name}</td>
              <td>${emp.email}</td>
            </tr>
`;
      });
      html += `
          </tbody>
        </table>
      </div>
`;
    }

    if (missingCheckOuts.length > 0) {
      html += `
      <div class="section">
        <h2>🟡 퇴근 미체크 (${missingCheckOuts.length}명)</h2>
        <table>
          <thead>
            <tr>
              <th>No.</th>
              <th>이름</th>
              <th>이메일</th>
            </tr>
          </thead>
          <tbody>
`;
      missingCheckOuts.forEach((emp, idx) => {
        html += `
            <tr>
              <td>${idx + 1}</td>
              <td>${emp.name}</td>
              <td>${emp.email}</td>
            </tr>
`;
      });
      html += `
          </tbody>
        </table>
      </div>
`;
    }

    if (totalMissing === 0) {
      html += `
      <div class="section" style="text-align: center; padding: 40px;">
        <p style="font-size: 18px; color: #28a745;">✅ 모든 직원이 정상적으로 출퇴근을 체크했습니다.</p>
      </div>
`;
    }

    html += `
      <div class="footer">
        <p>이 이메일은 자동으로 발송되었습니다.</p>
        <p>문의사항은 HR 담당자에게 연락해주세요.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

    return html;
  }

  /**
   * Refresh Token 만료 경고 이메일 전송
   */
  async sendRefreshTokenWarning(daysRemaining: number): Promise<void> {
    const ceoEmail = process.env.CEO_EMAIL;
    if (!ceoEmail) {
      console.warn('[OutlookClient] CEO 이메일이 설정되지 않았습니다.');
      return;
    }

    const subject = `⚠️ [긴급] Flex API Refresh Token 만료 임박 (${daysRemaining}일 남음)`;
    const body = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    .warning { background-color: #fff3cd; border: 2px solid #ffc107; padding: 20px; border-radius: 8px; }
    .warning h2 { color: #856404; margin-top: 0; }
    .warning p { color: #856404; }
    .action { background-color: #d9534f; color: white; padding: 15px; border-radius: 5px; margin-top: 20px; }
    .action strong { font-size: 18px; }
  </style>
</head>
<body>
  <div class="warning">
    <h2>⚠️ Flex API Refresh Token 만료 경고</h2>
    <p><strong>만료까지 남은 기간:</strong> ${daysRemaining}일</p>
    <p>Flex API Refresh Token이 곧 만료됩니다.</p>
    <p>만료되면 근태 알림 시스템이 작동하지 않습니다.</p>
    
    <div class="action">
      <strong>즉시 조치 필요</strong>
      <p>시스템 관리자에게 연락하여 Refresh Token을 갱신해주세요.</p>
    </div>
  </div>
</body>
</html>
`;

    await this.sendEmail({
      to: [ceoEmail],
      subject,
      body,
      bodyType: 'html',
    });

    console.log('[OutlookClient] Refresh Token 만료 경고 이메일 전송 완료');
  }
}

// Singleton instance
let outlookClientInstance: OutlookClient | null = null;

export function getOutlookClient(): OutlookClient {
  if (!outlookClientInstance) {
    outlookClientInstance = new OutlookClient();
  }
  return outlookClientInstance;
}

export default OutlookClient;
