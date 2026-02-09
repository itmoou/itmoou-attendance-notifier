/**
 * HR Bot 권한 관리 Repository
 * Azure Table Storage를 사용하여 HR Bot 접근 권한 관리
 */

import { TableClient } from '@azure/data-tables';

interface HRBotPermission {
  partitionKey: string;
  rowKey: string;
  email: string;
  grantedBy: string;
  grantedAt: Date;
}

const TABLE_NAME = 'HRBotPermissions';

/**
 * Table Client 초기화
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
export async function ensurePermissionTableExists(): Promise<void> {
  try {
    const client = getTableClient();
    await client.createTable();
    console.log(`[HRBotPermissionRepo] 테이블 생성 완료: ${TABLE_NAME}`);
  } catch (error: any) {
    if (error.statusCode === 409) {
      // 테이블이 이미 존재함
      console.log(`[HRBotPermissionRepo] 테이블이 이미 존재함: ${TABLE_NAME}`);
    } else {
      console.error('[HRBotPermissionRepo] 테이블 생성 실패:', error);
      throw error;
    }
  }
}

/**
 * 권한 부여
 */
export async function addAuthorizedUser(
  email: string,
  grantedBy: string
): Promise<void> {
  const client = getTableClient();
  const normalizedEmail = email.toLowerCase().trim();

  const entity = {
    partitionKey: 'AUTHORIZED',
    rowKey: normalizedEmail,
    email: normalizedEmail,
    grantedBy,
    grantedAt: new Date(),
  };

  await client.upsertEntity(entity, 'Replace');
  console.log(`[HRBotPermissionRepo] 권한 부여: ${normalizedEmail} by ${grantedBy}`);
}

/**
 * 권한 제거
 */
export async function removeAuthorizedUser(email: string): Promise<void> {
  const client = getTableClient();
  const normalizedEmail = email.toLowerCase().trim();

  try {
    await client.deleteEntity('AUTHORIZED', normalizedEmail);
    console.log(`[HRBotPermissionRepo] 권한 제거: ${normalizedEmail}`);
  } catch (error: any) {
    if (error.statusCode === 404) {
      console.log(`[HRBotPermissionRepo] 권한이 없는 사용자: ${normalizedEmail}`);
    } else {
      throw error;
    }
  }
}

/**
 * 권한 확인
 */
export async function isUserAuthorizedInStorage(email: string): Promise<boolean> {
  const client = getTableClient();
  const normalizedEmail = email.toLowerCase().trim();

  try {
    const entity = await client.getEntity('AUTHORIZED', normalizedEmail);
    return !!entity;
  } catch (error: any) {
    if (error.statusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * 권한 목록 조회
 */
export async function listAuthorizedUsers(): Promise<HRBotPermission[]> {
  const client = getTableClient();
  const entities: HRBotPermission[] = [];

  const iterator = client.listEntities<HRBotPermission>({
    queryOptions: { filter: "PartitionKey eq 'AUTHORIZED'" },
  });

  for await (const entity of iterator) {
    entities.push({
      partitionKey: entity.partitionKey,
      rowKey: entity.rowKey,
      email: entity.email,
      grantedBy: entity.grantedBy,
      grantedAt: new Date(entity.grantedAt),
    });
  }

  return entities.sort((a, b) => b.grantedAt.getTime() - a.grantedAt.getTime());
}

/**
 * Super Admin 확인
 */
export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;

  const superAdminEnv = process.env.HR_BOT_SUPER_ADMIN || '';
  if (!superAdminEnv) {
    console.warn('[HRBotPermissionRepo] HR_BOT_SUPER_ADMIN 환경 변수가 설정되지 않았습니다.');
    return false;
  }

  const superAdmins = superAdminEnv.split(',').map(e => e.trim().toLowerCase());
  const normalizedEmail = email.toLowerCase().trim();

  return superAdmins.includes(normalizedEmail);
}
