import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import axios from 'axios';
import { validateFlexEnvs } from '../../shared/utils/envUtil';

/**
 * Flex Auth 테스트 - 여러 인증 방식 시도
 */

async function testFlexAuthHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    context.log('[TestFlexAuth] Flex 인증 방식 테스트 시작');

    const { apiBase, tokenUrl, refreshToken } = validateFlexEnvs();
    
    // 추가 환경변수 확인
    const clientId = process.env.FLEX_CLIENT_ID || '';
    const clientSecret = process.env.FLEX_CLIENT_SECRET || '';
    const apiKey = process.env.FLEX_API_KEY || '';
    
    context.log('[TestFlexAuth] ===== 환경변수 =====');
    context.log('[TestFlexAuth] FLEX_API_BASE:', apiBase);
    context.log('[TestFlexAuth] FLEX_TOKEN_URL:', tokenUrl);
    context.log('[TestFlexAuth] FLEX_REFRESH_TOKEN:', refreshToken ? '있음 (' + refreshToken.length + '자)' : '없음');
    context.log('[TestFlexAuth] FLEX_CLIENT_ID:', clientId || '없음');
    context.log('[TestFlexAuth] FLEX_CLIENT_SECRET:', clientSecret ? '있음 (' + clientSecret.length + '자)' : '없음');
    context.log('[TestFlexAuth] FLEX_API_KEY:', apiKey ? '있음 (' + apiKey.length + '자)' : '없음');

    const results: any[] = [];

    // ===== 방법 1: Refresh Token만 (기본) =====
    context.log('\n[TestFlexAuth] ===== 방법 1: Refresh Token만 =====');
    try {
      const params1 = new URLSearchParams();
      params1.append('grant_type', 'refresh_token');
      params1.append('refresh_token', refreshToken);

      const response1 = await axios.post(tokenUrl, params1, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      });

      context.log('[TestFlexAuth] ✅ 방법 1 성공!');
      results.push({
        method: '방법 1: Refresh Token만',
        success: true,
        response: response1.data,
      });
    } catch (error: any) {
      context.error('[TestFlexAuth] ❌ 방법 1 실패:', error.response?.status, error.response?.data);
      results.push({
        method: '방법 1: Refresh Token만',
        success: false,
        error: error.response?.data || error.message,
      });
    }

    // ===== 방법 2: Client ID + Client Secret (파라미터) =====
    if (clientId && clientSecret) {
      context.log('\n[TestFlexAuth] ===== 방법 2: Client ID + Client Secret (파라미터) =====');
      try {
        const params2 = new URLSearchParams();
        params2.append('grant_type', 'refresh_token');
        params2.append('refresh_token', refreshToken);
        params2.append('client_id', clientId);
        params2.append('client_secret', clientSecret);

        const response2 = await axios.post(tokenUrl, params2, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000,
        });

        context.log('[TestFlexAuth] ✅ 방법 2 성공!');
        results.push({
          method: '방법 2: Client ID + Client Secret (파라미터)',
          success: true,
          response: response2.data,
        });
      } catch (error: any) {
        context.error('[TestFlexAuth] ❌ 방법 2 실패:', error.response?.status, error.response?.data);
        results.push({
          method: '방법 2: Client ID + Client Secret (파라미터)',
          success: false,
          error: error.response?.data || error.message,
        });
      }
    }

    // ===== 방법 3: Basic Auth (헤더) =====
    if (clientId && clientSecret) {
      context.log('\n[TestFlexAuth] ===== 방법 3: Basic Auth (헤더) =====');
      try {
        const params3 = new URLSearchParams();
        params3.append('grant_type', 'refresh_token');
        params3.append('refresh_token', refreshToken);

        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        const response3 = await axios.post(tokenUrl, params3, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${basicAuth}`,
          },
          timeout: 10000,
        });

        context.log('[TestFlexAuth] ✅ 방법 3 성공!');
        results.push({
          method: '방법 3: Basic Auth (헤더)',
          success: true,
          response: response3.data,
        });
      } catch (error: any) {
        context.error('[TestFlexAuth] ❌ 방법 3 실패:', error.response?.status, error.response?.data);
        results.push({
          method: '방법 3: Basic Auth (헤더)',
          success: false,
          error: error.response?.data || error.message,
        });
      }
    }

    // ===== 방법 4: API Key (헤더) =====
    if (apiKey) {
      context.log('\n[TestFlexAuth] ===== 방법 4: API Key (헤더) =====');
      try {
        const params4 = new URLSearchParams();
        params4.append('grant_type', 'refresh_token');
        params4.append('refresh_token', refreshToken);

        const response4 = await axios.post(tokenUrl, params4, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-API-KEY': apiKey,
          },
          timeout: 10000,
        });

        context.log('[TestFlexAuth] ✅ 방법 4 성공!');
        results.push({
          method: '방법 4: API Key (헤더)',
          success: true,
          response: response4.data,
        });
      } catch (error: any) {
        context.error('[TestFlexAuth] ❌ 방법 4 실패:', error.response?.status, error.response?.data);
        results.push({
          method: '방법 4: API Key (헤더)',
          success: false,
          error: error.response?.data || error.message,
        });
      }
    }

    // 결과 요약
    context.log('\n[TestFlexAuth] ===== 테스트 결과 요약 =====');
    const successfulMethods = results.filter(r => r.success);
    const failedMethods = results.filter(r => !r.success);

    context.log('[TestFlexAuth] 성공:', successfulMethods.length, '개');
    context.log('[TestFlexAuth] 실패:', failedMethods.length, '개');

    if (successfulMethods.length > 0) {
      context.log('[TestFlexAuth] ✅ 성공한 인증 방식:', successfulMethods.map(r => r.method).join(', '));
    } else {
      context.error('[TestFlexAuth] ❌ 모든 인증 방식 실패');
    }

    return {
      status: 200,
      jsonBody: {
        success: successfulMethods.length > 0,
        message: successfulMethods.length > 0 
          ? `${successfulMethods.length}개 인증 방식 성공` 
          : '모든 인증 방식 실패',
        environment: {
          hasRefreshToken: !!refreshToken,
          hasClientId: !!clientId,
          hasClientSecret: !!clientSecret,
          hasApiKey: !!apiKey,
        },
        results: results,
        recommendation: successfulMethods.length > 0
          ? `"${successfulMethods[0].method}" 방식을 사용하세요`
          : 'Flex 관리자 페이지에서 Client ID와 Client Secret을 확인하세요',
      },
    };
  } catch (error: any) {
    context.error('[TestFlexAuth] 예상치 못한 에러:', error);
    
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: error.message || 'Flex 인증 테스트 중 오류 발생',
      },
    };
  }
}

app.http('testFlexAuth', {
  methods: ['GET', 'POST'],
  authLevel: 'function',
  route: 'test/flex-auth',
  handler: testFlexAuthHandler,
});
