/**
 * Token Manager
 * Flex API Access Token 자동 관리
 * 
 * Flex OpenAPI 인증 방식:
 * - client_id: 'open-api' (고정값)
 * - grant_type: 'refresh_token'
 * - refresh_token: 발급받은 Refresh Token
 * - Content-Type: application/x-www-form-urlencoded
 */

import axios from 'axios';
import { validateFlexEnvs } from './utils/envUtil';
import { getRefreshToken, saveRefreshToken } from './storage/flexTokenRepo';

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

  // Refresh Token 조회: Storage 우선, 환경변수 fallback
  let refreshToken: string;
  try {
    const storedToken = await getRefreshToken();
    if (storedToken) {
      console.log('[TokenManager] Storage에서 Refresh Token 사용');
      refreshToken = storedToken;
    } else {
      console.log('[TokenManager] 환경변수에서 Refresh Token 사용');
      const { refreshToken: envToken } = validateFlexEnvs();
      refreshToken = envToken;
    }
  } catch (error: any) {
    console.warn('[TokenManager] Storage 조회 실패, 환경변수 사용:', error.message);
    const { refreshToken: envToken } = validateFlexEnvs();
    refreshToken = envToken;
  }

  const { tokenUrl } = validateFlexEnvs();

  try {
    console.log('[TokenManager] Token URL:', tokenUrl);
    console.log('[TokenManager] Refresh Token 앞 10자:', refreshToken.substring(0, 10) + '...');
    
    // OAuth2 표준: application/x-www-form-urlencoded 형식 사용
    // Flex API 문서: client_id=open-api 필수
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('client_id', 'open-api');
    params.append('refresh_token', refreshToken);
    
    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
    });

    console.log('[TokenManager] 응답 전체:', JSON.stringify(response.data, null, 2));

    const { access_token, refresh_token: newRefreshToken, expires_in } = response.data;

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
    
    // 새로운 Refresh Token이 있으면 자동으로 Storage에 저장
    if (newRefreshToken && newRefreshToken !== refreshToken) {
      console.warn('[TokenManager] ⚠️ 새로운 Refresh Token 발급됨!');
      console.warn('[TokenManager] 새 Refresh Token 앞 10자:', newRefreshToken.substring(0, 10) + '...');

      try {
        await saveRefreshToken(newRefreshToken, 'auto');
        console.log('[TokenManager] ✅ 새 Refresh Token을 Storage에 자동 저장 완료');
        console.log('[TokenManager] 다음 API 호출부터 새 토큰이 자동으로 사용됩니다');
      } catch (saveError: any) {
        console.error('[TokenManager] ❌ Storage 저장 실패:', saveError.message);
        console.warn('[TokenManager] 수동으로 환경변수를 업데이트하세요:');
        console.warn('[TokenManager] Azure Portal → Function App → Configuration → FLEX_REFRESH_TOKEN');
        console.warn('[TokenManager] 새 Refresh Token:', newRefreshToken);
      }
    } else {
      console.log('[TokenManager] Refresh Token 변경 없음 (재사용 가능)');
    }
    
    return cachedAccessToken;
  } catch (error: any) {
    console.error('[TokenManager] Access Token 재발급 실패:', error.message);
    if (error.response) {
      console.error('[TokenManager] 응답 상태:', error.response.status);
      console.error('[TokenManager] 응답 데이터:', JSON.stringify(error.response.data, null, 2));
      console.error('[TokenManager] 응답 헤더:', JSON.stringify(error.response.headers, null, 2));
    }
    if (error.request) {
      console.error('[TokenManager] 요청 URL:', error.config?.url);
      console.error('[TokenManager] 요청 Method:', error.config?.method);
      console.error('[TokenManager] 요청 Data:', JSON.stringify(error.config?.data, null, 2));
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
