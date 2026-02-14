/**
 * Flex Token Repository
 * Refresh Token을 Azure Table Storage에 저장/조회
 *
 * 장점:
 * - Function 재시작 없이 새 토큰 사용 가능
 * - 환경변수 수동 업데이트 불필요
 * - 토큰 이력 관리 가능
 */

import { TableClient, TableEntity } from '@azure/data-tables';

const TABLE_NAME = 'FlexTokenCache';

interface TokenEntity extends TableEntity {
  partitionKey: string; // 'config'
  rowKey: string; // 'refresh_token'
  value: string; // Refresh Token 값
  updatedAt: string; // 업데이트 시간
  updatedBy?: string; // 업데이트 주체 (예: 'auto', 'manual')
}

/**
 * Table Storage 클라이언트 생성
 */
function getTableClient(): TableClient {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING 환경변수가 설정되지 않았습니다.');
  }

  return TableClient.fromConnectionString(connectionString, TABLE_NAME);
}

/**
 * 테이블 존재 확인 및 생성
 */
export async function ensureFlexTokenTableExists(): Promise<void> {
  try {
    const tableClient = getTableClient();
    await tableClient.createTable();
    console.log(`[FlexTokenRepo] 테이블 생성 완료: ${TABLE_NAME}`);
  } catch (error: any) {
    if (error.statusCode === 409) {
      console.log(`[FlexTokenRepo] 테이블 이미 존재: ${TABLE_NAME}`);
    } else {
      console.error('[FlexTokenRepo] 테이블 생성 실패:', error);
      throw error;
    }
  }
}

/**
 * Refresh Token 조회
 * @returns Refresh Token 또는 null (없으면)
 */
export async function getRefreshToken(): Promise<string | null> {
  try {
    const tableClient = getTableClient();
    const entity = await tableClient.getEntity<TokenEntity>('config', 'refresh_token');

    console.log('[FlexTokenRepo] ✅ Storage에서 Refresh Token 조회 성공');
    console.log('[FlexTokenRepo] 업데이트 시간:', entity.updatedAt);
    console.log('[FlexTokenRepo] 업데이트 주체:', entity.updatedBy || 'unknown');

    return entity.value;
  } catch (error: any) {
    if (error.statusCode === 404) {
      console.log('[FlexTokenRepo] Storage에 Refresh Token 없음 (환경변수 사용)');
      return null;
    }

    console.error('[FlexTokenRepo] Refresh Token 조회 실패:', error);
    return null; // 에러 시 환경변수 fallback
  }
}

/**
 * Refresh Token 저장
 * @param refreshToken 새로운 Refresh Token
 * @param updatedBy 업데이트 주체 (예: 'auto', 'manual', 'initial')
 */
export async function saveRefreshToken(
  refreshToken: string,
  updatedBy: string = 'auto'
): Promise<void> {
  try {
    await ensureFlexTokenTableExists();

    const tableClient = getTableClient();

    const entity: TokenEntity = {
      partitionKey: 'config',
      rowKey: 'refresh_token',
      value: refreshToken,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    await tableClient.upsertEntity(entity, 'Replace');

    console.log('[FlexTokenRepo] ✅ Refresh Token 저장 완료');
    console.log('[FlexTokenRepo] 업데이트 주체:', updatedBy);
    console.log('[FlexTokenRepo] 다음 API 호출부터 새 토큰 사용됨');
  } catch (error: any) {
    console.error('[FlexTokenRepo] Refresh Token 저장 실패:', error);
    throw error;
  }
}

/**
 * Refresh Token 삭제 (테스트용)
 */
export async function deleteRefreshToken(): Promise<void> {
  try {
    const tableClient = getTableClient();
    await tableClient.deleteEntity('config', 'refresh_token');

    console.log('[FlexTokenRepo] Refresh Token 삭제 완료');
  } catch (error: any) {
    if (error.statusCode === 404) {
      console.log('[FlexTokenRepo] 삭제할 Refresh Token 없음');
    } else {
      console.error('[FlexTokenRepo] Refresh Token 삭제 실패:', error);
      throw error;
    }
  }
}

/**
 * Token 정보 조회 (디버깅용)
 */
export async function getTokenInfo(): Promise<any> {
  try {
    const tableClient = getTableClient();
    const entity = await tableClient.getEntity<TokenEntity>('config', 'refresh_token');

    return {
      exists: true,
      updatedAt: entity.updatedAt,
      updatedBy: entity.updatedBy,
      tokenLength: entity.value.length,
      tokenPreview: entity.value.substring(0, 20) + '...',
    };
  } catch (error: any) {
    return {
      exists: false,
      error: error.statusCode === 404 ? 'Not found' : error.message,
    };
  }
}
