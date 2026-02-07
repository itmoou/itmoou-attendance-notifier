import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import axios from 'axios';
import { validateFlexEnvs } from '../../shared/utils/envUtil';

/**
 * Flex Token 테스트 함수
 * GET/POST /api/test/flex-token
 * 
 * Flex API 토큰 발급/갱신을 테스트하고 상세한 로그를 출력합니다.
 */

async function testFlexTokenHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    context.log('[TestFlexToken] Flex API 토큰 테스트 시작');

    // 환경변수 검증
    const { apiBase, tokenUrl, refreshToken } = validateFlexEnvs();
    
    context.log('[TestFlexToken] ===== 환경변수 =====');
    context.log('[TestFlexToken] FLEX_API_BASE:', apiBase);
    context.log('[TestFlexToken] FLEX_TOKEN_URL:', tokenUrl);
    context.log('[TestFlexToken] FLEX_REFRESH_TOKEN 길이:', refreshToken.length);
    context.log('[TestFlexToken] FLEX_REFRESH_TOKEN 앞 20자:', refreshToken.substring(0, 20) + '...');
    context.log('[TestFlexToken] FLEX_REFRESH_TOKEN 뒤 20자:', '...' + refreshToken.substring(refreshToken.length - 20));
    
    // Access Token 요청
    context.log('[TestFlexToken] ===== Access Token 요청 =====');
    context.log('[TestFlexToken] POST', tokenUrl);
    context.log('[TestFlexToken] Content-Type: application/x-www-form-urlencoded');
    context.log('[TestFlexToken] Request Body:', {
      grant_type: 'refresh_token',
      refresh_token: refreshToken.substring(0, 20) + '...(생략)',
    });

    const startTime = Date.now();
    
    // OAuth2 표준: application/x-www-form-urlencoded 형식 사용
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    
    let response;
    try {
      response = await axios.post(
        tokenUrl,
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 15000,
        }
      );
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      
      context.error('[TestFlexToken] ===== 요청 실패 =====');
      context.error('[TestFlexToken] 소요 시간:', elapsed, 'ms');
      context.error('[TestFlexToken] 에러 메시지:', error.message);
      
      if (error.response) {
        context.error('[TestFlexToken] HTTP 상태:', error.response.status);
        context.error('[TestFlexToken] 응답 헤더:', JSON.stringify(error.response.headers, null, 2));
        context.error('[TestFlexToken] 응답 데이터:', JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        context.error('[TestFlexToken] 요청 전송됨, 응답 없음');
        context.error('[TestFlexToken] 요청 URL:', error.config?.url);
        context.error('[TestFlexToken] 요청 Method:', error.config?.method);
      } else {
        context.error('[TestFlexToken] 요청 생성 실패:', error.message);
      }
      
      return {
        status: 500,
        jsonBody: {
          success: false,
          error: 'Flex API 토큰 요청 실패',
          details: {
            message: error.message,
            status: error.response?.status,
            responseData: error.response?.data,
            elapsed: elapsed,
          },
        },
      };
    }

    const elapsed = Date.now() - startTime;
    
    context.log('[TestFlexToken] ===== 응답 성공 =====');
    context.log('[TestFlexToken] HTTP 상태:', response.status);
    context.log('[TestFlexToken] 소요 시간:', elapsed, 'ms');
    context.log('[TestFlexToken] 응답 헤더:', JSON.stringify(response.headers, null, 2));
    context.log('[TestFlexToken] 응답 데이터 (전체):', JSON.stringify(response.data, null, 2));

    const {
      access_token,
      refresh_token: newRefreshToken,
      expires_in,
      token_type,
      ...otherFields
    } = response.data;

    // Access Token 분석
    if (access_token) {
      context.log('[TestFlexToken] ✅ Access Token 발급 성공');
      context.log('[TestFlexToken] Access Token 길이:', access_token.length);
      context.log('[TestFlexToken] Access Token 앞 30자:', access_token.substring(0, 30) + '...');
      context.log('[TestFlexToken] 유효기간:', expires_in, '초 (', expires_in / 60, '분)');
      context.log('[TestFlexToken] Token Type:', token_type);
    } else {
      context.error('[TestFlexToken] ❌ Access Token이 응답에 없음!');
    }

    // Refresh Token 분석
    if (newRefreshToken) {
      context.log('[TestFlexToken] ✅ 새로운 Refresh Token 발급됨!');
      context.log('[TestFlexToken] 새 Refresh Token 길이:', newRefreshToken.length);
      context.log('[TestFlexToken] 새 Refresh Token 앞 20자:', newRefreshToken.substring(0, 20) + '...');
      
      if (newRefreshToken !== refreshToken) {
        context.warn('[TestFlexToken] ⚠️ Refresh Token이 변경되었습니다!');
        context.warn('[TestFlexToken] 이전 Refresh Token과 다름 - 환경변수 업데이트 필요');
      } else {
        context.log('[TestFlexToken] Refresh Token 동일 (재사용 가능)');
      }
    } else {
      context.log('[TestFlexToken] ℹ️ 새로운 Refresh Token 없음 (기존 토큰 재사용)');
    }

    // 기타 필드 출력
    if (Object.keys(otherFields).length > 0) {
      context.log('[TestFlexToken] 기타 응답 필드:', JSON.stringify(otherFields, null, 2));
    }

    // Access Token으로 실제 API 호출 테스트
    if (access_token) {
      context.log('[TestFlexToken] ===== Access Token 검증 (API 호출) =====');
      
      try {
        const testApiUrl = `${apiBase}/users/work-schedules-with-work-clock/dates/2024-02-07`;
        context.log('[TestFlexToken] GET', testApiUrl);
        
        const testResponse = await axios.get(testApiUrl, {
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Accept': 'application/json',
          },
          params: {
            'employeeNumbers[]': '000000', // 테스트용 더미 사원번호
          },
          timeout: 10000,
        });
        
        context.log('[TestFlexToken] ✅ API 호출 성공:', testResponse.status);
        context.log('[TestFlexToken] 응답 데이터:', JSON.stringify(testResponse.data, null, 2));
      } catch (apiError: any) {
        context.warn('[TestFlexToken] ⚠️ API 호출 실패 (토큰은 정상일 수 있음)');
        context.warn('[TestFlexToken] 상태:', apiError.response?.status);
        context.warn('[TestFlexToken] 에러:', apiError.message);
      }
    }

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Flex API 토큰 테스트 완료',
        data: {
          accessToken: {
            received: !!access_token,
            length: access_token?.length,
            preview: access_token ? access_token.substring(0, 30) + '...' : null,
            expiresIn: expires_in,
            tokenType: token_type,
          },
          refreshToken: {
            received: !!newRefreshToken,
            length: newRefreshToken?.length,
            changed: newRefreshToken && newRefreshToken !== refreshToken,
            preview: newRefreshToken ? newRefreshToken.substring(0, 20) + '...' : null,
          },
          request: {
            tokenUrl,
            elapsed: elapsed,
          },
          otherFields: otherFields,
        },
      },
    };
  } catch (error: any) {
    context.error('[TestFlexToken] 예상치 못한 에러:', error);
    
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: error.message || 'Flex Token 테스트 중 오류 발생',
      },
    };
  }
}

// Azure Functions v4 등록
app.http('testFlexToken', {
  methods: ['GET', 'POST'],
  authLevel: 'function',
  route: 'test/flex-token',
  handler: testFlexTokenHandler,
});
