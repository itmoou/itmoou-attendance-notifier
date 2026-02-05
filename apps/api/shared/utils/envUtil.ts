/**
 * 환경변수 검증 유틸리티
 * - 필수 환경변수를 부팅 시점에 검증
 * - string | undefined를 명시적으로 처리하여 타입 안전성 확보
 */

export class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvValidationError';
  }
}

/**
 * 필수 환경변수를 검증하고 반환
 * @param name 환경변수 이름
 * @param defaultValue 기본값 (선택)
 * @returns 환경변수 값
 * @throws EnvValidationError - 환경변수가 없고 기본값도 없는 경우
 */
export function requireEnv(name: string, defaultValue?: string): string {
  const value = process.env[name];
  
  if (value === undefined || value === '') {
    if (defaultValue !== undefined) {
      console.log(`[EnvUtil] 환경변수 ${name}이 설정되지 않아 기본값 사용: ${defaultValue}`);
      return defaultValue;
    }
    throw new EnvValidationError(`필수 환경변수 ${name}이(가) 설정되지 않았습니다.`);
  }
  
  return value;
}

/**
 * 선택적 환경변수를 반환
 * @param name 환경변수 이름
 * @param defaultValue 기본값
 * @returns 환경변수 값 또는 기본값
 */
export function optionalEnv(name: string, defaultValue: string = ''): string {
  const value = process.env[name];
  return (value === undefined || value === '') ? defaultValue : value;
}

/**
 * 여러 필수 환경변수를 한 번에 검증
 * @param names 환경변수 이름 배열
 * @throws EnvValidationError - 하나라도 없으면 에러
 */
export function validateRequiredEnvs(names: string[]): void {
  const missing: string[] = [];
  
  for (const name of names) {
    const value = process.env[name];
    if (value === undefined || value === '') {
      missing.push(name);
    }
  }
  
  if (missing.length > 0) {
    throw new EnvValidationError(
      `다음 필수 환경변수들이 설정되지 않았습니다: ${missing.join(', ')}`
    );
  }
}

/**
 * Bot 관련 필수 환경변수 검증
 */
export function validateBotEnvs(): { appId: string; appPassword: string } {
  const appId = requireEnv('BOT_APP_ID');
  const appPassword = requireEnv('BOT_APP_PASSWORD');
  
  return { appId, appPassword };
}

/**
 * Flex API 관련 필수 환경변수 검증
 */
export function validateFlexEnvs(): {
  apiBase: string;
  tokenUrl: string;
  refreshToken: string;
} {
  const apiBase = requireEnv('FLEX_API_BASE', 'https://openapi.flex.team/v2');
  const tokenUrl = requireEnv(
    'FLEX_TOKEN_URL',
    'https://openapi.flex.team/v2/auth/realms/open-api/protocol/openid-connect/token'
  );
  const refreshToken = requireEnv('FLEX_REFRESH_TOKEN');
  
  return { apiBase, tokenUrl, refreshToken };
}

/**
 * Azure Storage 관련 필수 환경변수 검증
 */
export function validateStorageEnvs(): { connectionString: string } {
  const connectionString = requireEnv('AZURE_STORAGE_CONNECTION_STRING');
  return { connectionString };
}

/**
 * Microsoft Graph API 관련 필수 환경변수 검증
 */
export function validateGraphEnvs(): {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  baseUrl: string;
} {
  const tenantId = requireEnv('AZURE_TENANT_ID');
  const clientId = requireEnv('AZURE_CLIENT_ID');
  const clientSecret = requireEnv('AZURE_CLIENT_SECRET');
  const baseUrl = requireEnv('GRAPH_API_BASE_URL', 'https://graph.microsoft.com/v1.0');
  
  return { tenantId, clientId, clientSecret, baseUrl };
}
