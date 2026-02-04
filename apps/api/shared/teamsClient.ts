/**
 * Microsoft Teams Client
 * Teams Direct Message 전송을 위한 클라이언트
 */

import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';

export interface TeamsChatMessage {
  userId: string; // Teams User ID
  message: string;
  messageType?: 'text' | 'html';
}

class TeamsClient {
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
      console.error('[TeamsClient] Access Token 획득 실패:', error);
      throw error;
    }
  }

  /**
   * 사용자에게 Direct Message 전송
   * @param userId Microsoft Teams User ID (또는 UPN/Email)
   * @param message 메시지 내용
   */
  async sendDirectMessage(userId: string, message: string): Promise<void> {
    try {
      console.log(`[TeamsClient] DM 전송 시도: ${userId}`);

      // TODO: 실제 Graph API 호출로 변경
      // 1:1 채팅 생성 또는 기존 채팅 조회
      const chat = await this.getOrCreateChat(userId);

      // 메시지 전송
      await this.client
        .api(`/chats/${chat.id}/messages`)
        .post({
          body: {
            contentType: 'html',
            content: message,
          },
        });

      console.log(`[TeamsClient] DM 전송 완료: ${userId}`);
    } catch (error) {
      console.error(`[TeamsClient] DM 전송 실패: ${userId}`, error);
      throw error;
    }
  }

  /**
   * 여러 사용자에게 DM 일괄 전송
   */
  async sendBulkDirectMessages(messages: TeamsChatMessage[]): Promise<void> {
    console.log(`[TeamsClient] 일괄 DM 전송: ${messages.length}명`);

    const results = await Promise.allSettled(
      messages.map((msg) => this.sendDirectMessage(msg.userId, msg.message))
    );

    const failedCount = results.filter((r) => r.status === 'rejected').length;
    if (failedCount > 0) {
      console.warn(`[TeamsClient] ${failedCount}명에게 DM 전송 실패`);
    }

    console.log(`[TeamsClient] 일괄 DM 전송 완료: ${messages.length - failedCount}/${messages.length}`);
  }

  /**
   * 1:1 채팅 생성 또는 조회
   */
  private async getOrCreateChat(userId: string): Promise<any> {
    try {
      // TODO: 실제 Graph API endpoint로 변경
      // 기존 1:1 채팅 조회
      const chats = await this.client
        .api('/chats')
        .filter(`chatType eq 'oneOnOne'`)
        .expand('members')
        .get();

      // 해당 사용자와의 채팅 찾기
      const existingChat = chats.value.find((chat: any) =>
        chat.members.some((member: any) => member.userId === userId)
      );

      if (existingChat) {
        return existingChat;
      }

      // 새로운 1:1 채팅 생성
      const newChat = await this.client
        .api('/chats')
        .post({
          chatType: 'oneOnOne',
          members: [
            {
              '@odata.type': '#microsoft.graph.aadUserConversationMember',
              roles: ['owner'],
              'user@odata.bind': `https://graph.microsoft.com/v1.0/users/${userId}`,
            },
          ],
        });

      return newChat;
    } catch (error) {
      console.error('[TeamsClient] 채팅 생성/조회 실패:', error);
      throw error;
    }
  }

  /**
   * 사용자 정보 조회
   */
  async getUserInfo(userId: string): Promise<any> {
    try {
      // TODO: 실제 Graph API endpoint로 변경
      const user = await this.client.api(`/users/${userId}`).get();
      return user;
    } catch (error) {
      console.error(`[TeamsClient] 사용자 정보 조회 실패: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Email로 사용자 ID 조회
   */
  async getUserIdByEmail(email: string): Promise<string | null> {
    try {
      const user = await this.client
        .api('/users')
        .filter(`mail eq '${email}' or userPrincipalName eq '${email}'`)
        .select('id,mail,userPrincipalName')
        .get();

      if (user.value && user.value.length > 0) {
        return user.value[0].id;
      }

      return null;
    } catch (error) {
      console.error(`[TeamsClient] Email로 사용자 조회 실패: ${email}`, error);
      return null;
    }
  }
}

// Singleton instance
let teamsClientInstance: TeamsClient | null = null;

export function getTeamsClient(): TeamsClient {
  if (!teamsClientInstance) {
    teamsClientInstance = new TeamsClient();
  }
  return teamsClientInstance;
}

export default TeamsClient;
