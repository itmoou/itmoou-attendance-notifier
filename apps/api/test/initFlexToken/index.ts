/**
 * Initialize Flex Token
 * 초기 Refresh Token을 Storage에 저장
 *
 * 사용법:
 * 1. Flex username/password로 새 Refresh Token 받기
 * 2. 이 API에 POST로 전달
 * 3. Storage에 자동 저장
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { saveRefreshToken, getTokenInfo, deleteRefreshToken } from '../../shared/storage/flexTokenRepo';
import axios from 'axios';

async function initFlexTokenHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const method = request.method;
    const action = request.query.get('action') || 'save';

    // GET: Token 정보 조회
    if (method === 'GET') {
      const info = await getTokenInfo();

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          success: true,
          action: 'info',
          data: info,
          message: info.exists
            ? 'Storage에 Refresh Token이 저장되어 있습니다'
            : 'Storage에 Refresh Token이 없습니다. 환경변수를 사용 중입니다.',
        }, null, 2),
      };
    }

    // DELETE: Token 삭제
    if (method === 'DELETE' || action === 'delete') {
      await deleteRefreshToken();

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          success: true,
          action: 'delete',
          message: 'Refresh Token 삭제 완료. 이제 환경변수를 사용합니다.',
        }, null, 2),
      };
    }

    // POST: Token 저장
    const body = await request.text();
    let requestData: any = {};

    try {
      requestData = JSON.parse(body);
    } catch {
      // JSON 파싱 실패 시 query parameter 확인
      requestData.refreshToken = request.query.get('refreshToken');
      requestData.username = request.query.get('username');
      requestData.password = request.query.get('password');
    }

    // 방법 1: Refresh Token 직접 저장
    if (requestData.refreshToken) {
      const refreshToken = requestData.refreshToken;

      context.log('[InitFlexToken] Refresh Token 직접 저장');
      await saveRefreshToken(refreshToken, 'manual');

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          success: true,
          action: 'save',
          message: 'Refresh Token이 Storage에 저장되었습니다.',
          tokenPreview: refreshToken.substring(0, 20) + '...',
        }, null, 2),
      };
    }

    // 방법 2: Username/Password로 새 토큰 발급 후 저장
    if (requestData.username && requestData.password) {
      context.log('[InitFlexToken] Username/Password로 토큰 발급 시도');

      const tokenUrl =
        process.env.FLEX_TOKEN_URL ||
        'https://openapi.flex.team/v2/auth/realms/open-api/protocol/openid-connect/token';

      const params = new URLSearchParams();
      params.append('grant_type', 'password');
      params.append('client_id', 'open-api');
      params.append('username', requestData.username);
      params.append('password', requestData.password);

      const response = await axios.post(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { refresh_token, access_token, expires_in } = response.data;

      if (!refresh_token) {
        return {
          status: 400,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            success: false,
            error: 'Refresh Token을 받지 못했습니다',
            responseData: response.data,
          }, null, 2),
        };
      }

      // Storage에 저장
      await saveRefreshToken(refresh_token, 'initial');

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          success: true,
          action: 'login-and-save',
          message: 'Flex 로그인 성공! Refresh Token이 Storage에 저장되었습니다.',
          tokenInfo: {
            accessTokenExpiresIn: expires_in,
            refreshTokenPreview: refresh_token.substring(0, 20) + '...',
          },
        }, null, 2),
      };
    }

    // 방법을 선택하지 않음
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        success: false,
        error: '잘못된 요청',
        usage: {
          method1: 'POST /api/init-flex-token { "refreshToken": "..." }',
          method2: 'POST /api/init-flex-token { "username": "...", "password": "..." }',
          method3: 'GET /api/init-flex-token (현재 상태 조회)',
          method4: 'DELETE /api/init-flex-token (토큰 삭제)',
        },
      }, null, 2),
    };
  } catch (error: any) {
    context.error('[InitFlexToken] 오류:', error);

    return {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        success: false,
        error: error.message,
        details: error.response?.data || error.stack,
      }, null, 2),
    };
  }
}

app.http('initFlexToken', {
  methods: ['GET', 'POST', 'DELETE'],
  authLevel: 'anonymous', // 테스트 편의를 위해 인증 제거 (프로덕션에서는 'function' 권장)
  route: 'init-flex-token',
  handler: initFlexTokenHandler,
});

export default initFlexTokenHandler;
