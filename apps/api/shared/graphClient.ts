/**
 * Microsoft Graph Client
 * Graph API Access Token 관리
 */

import axios from 'axios';
import { validateGraphEnvs } from './utils/envUtil';

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Azure AD Access Token 획득 (Client Credentials Flow)
 */
export async function getGraphAccessToken(): Promise<string> {
  try {
    // 캐시된 토큰이 유효하면 재사용
    const now = Date.now();
    if (cachedToken && tokenExpiresAt > now) {
      console.log('[GraphClient] 캐시된 Access Token 사용');
      return cachedToken;
    }

    console.log('[GraphClient] 새 Access Token 요청');
    
    const { tenantId, clientId, clientSecret } = validateGraphEnvs();
    
    const response = await axios.post(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    cachedToken = response.data.access_token;
    if (!cachedToken) {
      throw new Error('Access Token을 받지 못했습니다.');
    }
    
    const expiresIn = response.data.expires_in || 3600; // 기본 1시간
    tokenExpiresAt = now + (expiresIn - 60) * 1000; // 1분 여유

    console.log(`[GraphClient] Access Token 획득 성공 (만료: ${expiresIn}초)`);
    return cachedToken;
  } catch (error) {
    console.error('[GraphClient] Access Token 획득 실패:', error);
    throw error;
  }
}

/**
 * 캐시된 토큰 초기화 (테스트용)
 */
export function clearGraphTokenCache(): void {
  cachedToken = null;
  tokenExpiresAt = 0;
  console.log('[GraphClient] 토큰 캐시 초기화');
}
