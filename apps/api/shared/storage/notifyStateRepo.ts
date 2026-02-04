/**
 * Notify State Repository
 * 중복 발송 방지를 위한 알림 상태 관리
 * 
 * Schema:
 * - PartitionKey: date (YYYY-MM-DD)
 * - RowKey: employeeNumber
 * - Columns: sentCheckIn1105, sentCheckIn1130, sentCheckOut2030, sentCheckOut2200, sentDailySummary2210
 */

import { TableClient, TableEntity } from '@azure/data-tables';

const TABLE_NAME = 'NotifyState';

interface NotifyStateEntity extends TableEntity {
  partitionKey: string; // date (YYYY-MM-DD)
  rowKey: string; // employeeNumber
  sentCheckIn1105?: boolean;
  sentCheckIn1130?: boolean;
  sentCheckOut2030?: boolean;
  sentCheckOut2200?: boolean;
  sentDailySummary2210?: boolean;
  lastUpdated?: string; // ISO timestamp
}

export type NotifyType =
  | 'checkIn1105'
  | 'checkIn1130'
  | 'checkOut2030'
  | 'checkOut2200'
  | 'dailySummary2210';

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
export async function ensureNotifyStateTableExists(): Promise<void> {
  try {
    const tableClient = getTableClient();
    await tableClient.createTable();
    console.log(`[NotifyStateRepo] 테이블 생성 완료: ${TABLE_NAME}`);
  } catch (error: any) {
    // 이미 존재하는 경우 에러 무시
    if (error.statusCode === 409) {
      console.log(`[NotifyStateRepo] 테이블 이미 존재: ${TABLE_NAME}`);
    } else {
      console.error('[NotifyStateRepo] 테이블 생성 실패:', error);
      throw error;
    }
  }
}

/**
 * 알림 발송 여부 확인
 * @param date 날짜 (YYYY-MM-DD)
 * @param employeeNumber 사원번호
 * @param notifyType 알림 유형
 * @returns 발송 여부 (true: 이미 발송됨, false: 미발송)
 */
export async function wasSent(
  date: string,
  employeeNumber: string,
  notifyType: NotifyType
): Promise<boolean> {
  try {
    const tableClient = getTableClient();
    const entity = await tableClient.getEntity<NotifyStateEntity>(date, employeeNumber);

    const columnName = `sent${notifyType.charAt(0).toUpperCase() + notifyType.slice(1)}` as keyof NotifyStateEntity;
    const sent = entity[columnName] === true;

    console.log(
      `[NotifyStateRepo] 발송 상태 확인: ${date} ${employeeNumber} ${notifyType} = ${sent}`
    );
    return sent;
  } catch (error: any) {
    if (error.statusCode === 404) {
      console.log(`[NotifyStateRepo] 발송 기록 없음: ${date} ${employeeNumber} ${notifyType}`);
      return false;
    }

    console.error(`[NotifyStateRepo] 발송 상태 확인 실패:`, error);
    throw error;
  }
}

/**
 * 알림 발송 완료 표시
 * @param date 날짜 (YYYY-MM-DD)
 * @param employeeNumber 사원번호
 * @param notifyType 알림 유형
 */
export async function markSent(
  date: string,
  employeeNumber: string,
  notifyType: NotifyType
): Promise<void> {
  try {
    const tableClient = getTableClient();

    // 기존 엔티티 조회 (없으면 새로 생성)
    let entity: NotifyStateEntity;
    try {
      entity = await tableClient.getEntity<NotifyStateEntity>(date, employeeNumber);
    } catch (error: any) {
      if (error.statusCode === 404) {
        entity = {
          partitionKey: date,
          rowKey: employeeNumber,
        };
      } else {
        throw error;
      }
    }

    // 해당 알림 유형 플래그 설정
    const columnName = `sent${notifyType.charAt(0).toUpperCase() + notifyType.slice(1)}` as keyof NotifyStateEntity;
    (entity as any)[columnName] = true;
    entity.lastUpdated = new Date().toISOString();

    await tableClient.upsertEntity(entity, 'Replace');
    console.log(`[NotifyStateRepo] 발송 완료 표시: ${date} ${employeeNumber} ${notifyType}`);
  } catch (error) {
    console.error(`[NotifyStateRepo] 발송 완료 표시 실패:`, error);
    throw error;
  }
}

/**
 * 여러 알림 발송 상태 일괄 확인
 * @param date 날짜 (YYYY-MM-DD)
 * @param employeeNumbers 사원번호 목록
 * @param notifyType 알림 유형
 * @returns 미발송 사원번호 목록
 */
export async function filterUnsent(
  date: string,
  employeeNumbers: string[],
  notifyType: NotifyType
): Promise<string[]> {
  const unsent: string[] = [];

  await Promise.all(
    employeeNumbers.map(async (empNum) => {
      const sent = await wasSent(date, empNum, notifyType);
      if (!sent) {
        unsent.push(empNum);
      }
    })
  );

  console.log(
    `[NotifyStateRepo] 미발송 필터링: ${unsent.length}/${employeeNumbers.length}명 (${notifyType})`
  );
  return unsent;
}

/**
 * 여러 알림 발송 완료 일괄 표시
 * @param date 날짜 (YYYY-MM-DD)
 * @param employeeNumbers 사원번호 목록
 * @param notifyType 알림 유형
 */
export async function markMultipleSent(
  date: string,
  employeeNumbers: string[],
  notifyType: NotifyType
): Promise<void> {
  await Promise.allSettled(
    employeeNumbers.map((empNum) => markSent(date, empNum, notifyType))
  );

  console.log(`[NotifyStateRepo] 일괄 발송 완료 표시: ${employeeNumbers.length}명 (${notifyType})`);
}

/**
 * 특정 날짜의 모든 발송 상태 조회 (관리용)
 * @param date 날짜 (YYYY-MM-DD)
 */
export async function getNotifyStatesByDate(
  date: string
): Promise<Map<string, NotifyStateEntity>> {
  const states = new Map<string, NotifyStateEntity>();

  try {
    const tableClient = getTableClient();
    const entities = tableClient.listEntities<NotifyStateEntity>({
      queryOptions: { filter: `PartitionKey eq '${date}'` },
    });

    for await (const entity of entities) {
      states.set(entity.rowKey, entity);
    }

    console.log(`[NotifyStateRepo] 날짜별 상태 조회: ${date} (${states.size}명)`);
  } catch (error) {
    console.error(`[NotifyStateRepo] 날짜별 상태 조회 실패: ${date}`, error);
    throw error;
  }

  return states;
}
