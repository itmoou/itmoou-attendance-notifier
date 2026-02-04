/**
 * Employee Map Repository
 * 사원번호-UPN 매핑 관리
 * 
 * Schema:
 * - PartitionKey: "v1"
 * - RowKey: upn (예: ymsim@itmoou.com)
 * - Columns: employeeNumber, name (optional)
 */

import { TableClient, TableEntity } from '@azure/data-tables';

const TABLE_NAME = 'EmployeeMap';
const PARTITION_KEY = 'v1';

export interface EmployeeMapEntity extends TableEntity {
  partitionKey: string;
  rowKey: string; // upn
  employeeNumber: string;
  name?: string; // 선택적
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
 * 테이블 존재 여부 확인 및 생성
 */
export async function ensureEmployeeMapTableExists(): Promise<void> {
  try {
    const tableClient = getTableClient();
    await tableClient.createTable();
    console.log(`[EmployeeMapRepo] 테이블 생성 완료: ${TABLE_NAME}`);
  } catch (error: any) {
    // 이미 존재하는 경우 에러 무시
    if (error.statusCode === 409) {
      console.log(`[EmployeeMapRepo] 테이블 이미 존재: ${TABLE_NAME}`);
    } else {
      console.error('[EmployeeMapRepo] 테이블 생성 실패:', error);
      throw error;
    }
  }
}

/**
 * 사원 매핑 정보 저장/업데이트
 * @param upn 사용자 UPN
 * @param employeeNumber 사원번호
 * @param name 이름 (선택)
 */
export async function saveEmployeeMap(
  upn: string,
  employeeNumber: string,
  name?: string
): Promise<void> {
  try {
    const tableClient = getTableClient();

    const entity: EmployeeMapEntity = {
      partitionKey: PARTITION_KEY,
      rowKey: upn.toLowerCase(),
      employeeNumber,
      name: name || undefined,
    };

    await tableClient.upsertEntity(entity, 'Replace');
    console.log(`[EmployeeMapRepo] 사원 매핑 저장: ${upn} -> ${employeeNumber}`);
  } catch (error) {
    console.error(`[EmployeeMapRepo] 사원 매핑 저장 실패: ${upn}`, error);
    throw error;
  }
}

/**
 * UPN으로 사원번호 조회
 * @param upn 사용자 UPN
 * @returns 사원번호 또는 null
 */
export async function getEmployeeNumberByUpn(upn: string): Promise<string | null> {
  try {
    const tableClient = getTableClient();
    const entity = await tableClient.getEntity<EmployeeMapEntity>(
      PARTITION_KEY,
      upn.toLowerCase()
    );

    console.log(`[EmployeeMapRepo] 사원번호 조회: ${upn} -> ${entity.employeeNumber}`);
    return entity.employeeNumber || null;
  } catch (error: any) {
    if (error.statusCode === 404) {
      console.warn(`[EmployeeMapRepo] 사원 매핑 없음: ${upn}`);
      return null;
    }

    console.error(`[EmployeeMapRepo] 사원번호 조회 실패: ${upn}`, error);
    throw error;
  }
}

/**
 * 사원번호로 UPN 조회
 * @param employeeNumber 사원번호
 * @returns UPN 또는 null
 */
export async function getUpnByEmployeeNumber(employeeNumber: string): Promise<string | null> {
  try {
    const tableClient = getTableClient();
    const entities = tableClient.listEntities<EmployeeMapEntity>({
      queryOptions: {
        filter: `PartitionKey eq '${PARTITION_KEY}' and employeeNumber eq '${employeeNumber}'`,
      },
    });

    for await (const entity of entities) {
      console.log(`[EmployeeMapRepo] UPN 조회: ${employeeNumber} -> ${entity.rowKey}`);
      return entity.rowKey;
    }

    console.warn(`[EmployeeMapRepo] UPN 매핑 없음: ${employeeNumber}`);
    return null;
  } catch (error) {
    console.error(`[EmployeeMapRepo] UPN 조회 실패: ${employeeNumber}`, error);
    throw error;
  }
}

/**
 * 전체 사원 매핑 조회
 * @returns UPN -> 사원번호 매핑
 */
export async function getAllEmployeeMaps(): Promise<
  Map<string, { employeeNumber: string; name?: string }>
> {
  const maps = new Map<string, { employeeNumber: string; name?: string }>();

  try {
    const tableClient = getTableClient();
    const entities = tableClient.listEntities<EmployeeMapEntity>({
      queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}'` },
    });

    for await (const entity of entities) {
      maps.set(entity.rowKey, {
        employeeNumber: entity.employeeNumber,
        name: entity.name,
      });
    }

    console.log(`[EmployeeMapRepo] 전체 매핑 조회 완료: ${maps.size}명`);
  } catch (error) {
    console.error('[EmployeeMapRepo] 전체 매핑 조회 실패:', error);
    throw error;
  }

  return maps;
}

/**
 * 사원번호 목록 조회 (Flex API 호출용)
 * @returns 사원번호 배열
 */
export async function getAllEmployeeNumbers(): Promise<string[]> {
  const maps = await getAllEmployeeMaps();
  const employeeNumbers = Array.from(maps.values()).map((m) => m.employeeNumber);
  
  console.log(`[EmployeeMapRepo] 사원번호 목록 조회: ${employeeNumbers.length}명`);
  return employeeNumbers;
}

/**
 * 사원 매핑 삭제
 * @param upn 사용자 UPN
 */
export async function deleteEmployeeMap(upn: string): Promise<void> {
  try {
    const tableClient = getTableClient();
    await tableClient.deleteEntity(PARTITION_KEY, upn.toLowerCase());
    console.log(`[EmployeeMapRepo] 사원 매핑 삭제: ${upn}`);
  } catch (error: any) {
    if (error.statusCode === 404) {
      console.log(`[EmployeeMapRepo] 삭제할 매핑 없음: ${upn}`);
      return;
    }

    console.error(`[EmployeeMapRepo] 사원 매핑 삭제 실패: ${upn}`, error);
    throw error;
  }
}
