/**
 * Token Manager
 * Flex API Access Token 자동 관리
 * 
 * Flex OpenAPI는 Client ID/Secret을 사용하지 않음
 * Refresh Token만으로 Access Token을 재발급받음
 */

import axios from 'axios';
import { validateFlexEnvs } from './utils/envUtil';

/**
 * Access Token 캐시
 */
let cachedAccessToken: string | null = null;
let cachedExpiresAt: number = 0;

/**
 * Refresh Token 발급 시점 (환경변수 변경 감지용)
 * Refresh Token은 최대 7일 유효
 */
const REFRESH_TOKEN_ISSUED_AT = Date.now();
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7일

/**
 * Flex API Access Token 획득
 * 캐시된 토큰이 30초 이상 유효하면 재사용, 아니면 재발급
 */
export async function getFlexAccessToken(): Promise<string> {
  const now = Date.now();

  // 캐시된 토큰이 있고, 30초 이상 유효하면 재사용
  if (cachedAccessToken && now < cachedExpiresAt - 30000) {
    console.log('[TokenManager] 캐시된 Access Token 사용');
    return cachedAccessToken;
  }

  // Access Token 재발급
  console.log('[TokenManager] Access Token 재발급 시도...');
  
  const { refreshToken, tokenUrl } = validateFlexEnvs();

  try {
    const response = await axios.post(tokenUrl, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const { access_token, expires_in } = response.data;

    if (!access_token) {
      throw new Error('Access Token을 받지 못했습니다.');
    }

    // 캐시 업데이트
    cachedAccessToken = access_token;
    if (!cachedAccessToken) {
      throw new Error('Access Token이 비어있습니다.');
    }
    
    cachedExpiresAt = now + (expires_in * 1000);

    console.log(`[TokenManager] Access Token 재발급 완료 (유효기간: ${expires_in}초)`);
    
    return cachedAccessToken;
  } catch (error: any) {
    console.error('[TokenManager] Access Token 재발급 실패:', error.message);
    if (error.response) {
      console.error('[TokenManager] 응답 상태:', error.response.status);
      console.error('[TokenManager] 응답 데이터:', error.response.data);
    }
    throw new Error('Flex API Access Token 재발급 실패');
  }
}

/**
 * Refresh Token 만료까지 남은 일수 계산
 */
export function getRefreshTokenDaysRemaining(): number {
  const now = Date.now();
  const expiresAt = REFRESH_TOKEN_ISSUED_AT + REFRESH_TOKEN_MAX_AGE;
  const remainingMs = expiresAt - now;
  
  return Math.floor(remainingMs / (24 * 60 * 60 * 1000));
}

/**
 * Refresh Token 만료 임박 여부
 * @param warningDays 경고 임계값 (일)
 */
export function isRefreshTokenExpiringSoon(warningDays: number = 2): boolean {
  return getRefreshTokenDaysRemaining() <= warningDays;
}

/**
 * 토큰 정보 조회 (디버깅용)
 */
export function getTokenInfo(): any {
  const now = Date.now();
  
  return {
    hasAccessToken: cachedAccessToken !== null,
    accessTokenExpiresIn: cachedAccessToken 
      ? Math.floor((cachedExpiresAt - now) / 1000) 
      : 0,
    refreshTokenDaysRemaining: getRefreshTokenDaysRemaining(),
  };
}
