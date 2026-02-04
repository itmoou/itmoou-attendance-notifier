/**
 * Token Manager
 * Flex API Access Token 및 Refresh Token 관리
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface TokenData {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number; // Unix timestamp (milliseconds)
  refreshTokenExpiresAt: number; // Unix timestamp (milliseconds)
}

class TokenManager {
  private tokenFilePath: string;
  private tokenData: TokenData | null = null;

  constructor() {
    // Azure Functions 환경에서는 임시 디렉토리 사용
    this.tokenFilePath = path.join(process.env.TEMP || '/tmp', 'flex-tokens.json');
    this.loadTokens();
  }

  /**
   * 저장된 토큰 로드
   */
  private loadTokens(): void {
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        const data = fs.readFileSync(this.tokenFilePath, 'utf-8');
        this.tokenData = JSON.parse(data);
        console.log('[TokenManager] 토큰 로드 완료');
      } else {
        // 환경변수에서 초기 토큰 설정
        this.tokenData = {
          accessToken: process.env.FLEX_ACCESS_TOKEN || '',
          refreshToken: process.env.FLEX_REFRESH_TOKEN || '',
          accessTokenExpiresAt: Date.now() + 10 * 60 * 1000, // 10분 후
          refreshTokenExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7일 후
        };
        this.saveTokens();
      }
    } catch (error) {
      console.error('[TokenManager] 토큰 로드 실패:', error);
      throw error;
    }
  }

  /**
   * 토큰 저장
   */
  private saveTokens(): void {
    try {
      fs.writeFileSync(this.tokenFilePath, JSON.stringify(this.tokenData, null, 2));
      console.log('[TokenManager] 토큰 저장 완료');
    } catch (error) {
      console.error('[TokenManager] 토큰 저장 실패:', error);
    }
  }

  /**
   * 유효한 Access Token 반환 (필요시 자동 갱신)
   */
  async getValidAccessToken(): Promise<string> {
    if (!this.tokenData) {
      throw new Error('토큰 데이터가 없습니다.');
    }

    // Access Token이 만료되었거나 1분 이내에 만료될 경우 갱신
    const expiresIn = this.tokenData.accessTokenExpiresAt - Date.now();
    if (expiresIn < 60 * 1000) {
      console.log('[TokenManager] Access Token 갱신 필요');
      await this.refreshAccessToken();
    }

    return this.tokenData.accessToken;
  }

  /**
   * Access Token 갱신
   */
  private async refreshAccessToken(): Promise<void> {
    try {
      console.log('[TokenManager] Access Token 갱신 시도...');
      
      const response = await axios.post(
        `${process.env.FLEX_API_BASE_URL}/oauth/token`,
        {
          grant_type: 'refresh_token',
          refresh_token: this.tokenData!.refreshToken,
          client_id: process.env.FLEX_CLIENT_ID,
          client_secret: process.env.FLEX_CLIENT_SECRET,
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;

      this.tokenData!.accessToken = access_token;
      this.tokenData!.accessTokenExpiresAt = Date.now() + expires_in * 1000;

      // 새로운 Refresh Token이 있으면 업데이트
      if (refresh_token) {
        this.tokenData!.refreshToken = refresh_token;
        this.tokenData!.refreshTokenExpiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
      }

      this.saveTokens();
      console.log('[TokenManager] Access Token 갱신 완료');
    } catch (error) {
      console.error('[TokenManager] Access Token 갱신 실패:', error);
      throw error;
    }
  }

  /**
   * Refresh Token 만료 임박 체크
   * @returns 만료까지 남은 일수
   */
  getRefreshTokenDaysRemaining(): number {
    if (!this.tokenData) {
      return 0;
    }

    const remainingMs = this.tokenData.refreshTokenExpiresAt - Date.now();
    return Math.floor(remainingMs / (24 * 60 * 60 * 1000));
  }

  /**
   * Refresh Token 만료 임박 여부
   */
  isRefreshTokenExpiringSoon(warningDays: number = 2): boolean {
    return this.getRefreshTokenDaysRemaining() <= warningDays;
  }

  /**
   * 토큰 정보 조회 (디버깅용)
   */
  getTokenInfo(): any {
    if (!this.tokenData) {
      return null;
    }

    return {
      accessTokenExpiresIn: Math.floor((this.tokenData.accessTokenExpiresAt - Date.now()) / 1000),
      refreshTokenDaysRemaining: this.getRefreshTokenDaysRemaining(),
    };
  }
}

// Singleton instance
let tokenManagerInstance: TokenManager | null = null;

export function getTokenManager(): TokenManager {
  if (!tokenManagerInstance) {
    tokenManagerInstance = new TokenManager();
  }
  return tokenManagerInstance;
}

export default TokenManager;
