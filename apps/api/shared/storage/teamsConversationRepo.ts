/**
 * Teams Conversation Repository
 * Azure Table Storage를 사용하여 Teams Conversation Reference 저장/조회
 */

import { TableClient, TableEntity } from '@azure/data-tables';
import { ConversationReference } from 'botbuilder';

const TABLE_NAME = 'TeamsConversation';
const PARTITION_KEY = 'v1';

interface ConversationEntity extends TableEntity {
  partitionKey: string;
  rowKey: string; // userUpn (예: ymsim@itmoou.com)
  conversationReferenceJson: string;
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
export async function ensureTableExists(): Promise<void> {
  try {
    const tableClient = getTableClient();
    await tableClient.createTable();
    console.log(`[TeamsConversationRepo] 테이블 생성 완료: ${TABLE_NAME}`);
  } catch (error: any) {
    // 이미 존재하는 경우 에러 무시
    if (error.statusCode === 409) {
      console.log(`[TeamsConversationRepo] 테이블 이미 존재: ${TABLE_NAME}`);
    } else {
      console.error('[TeamsConversationRepo] 테이블 생성 실패:', error);
      throw error;
    }
  }
}

/**
 * Conversation Reference 저장
 * @param userUpn 사용자 UPN (예: ymsim@itmoou.com)
 * @param reference Conversation Reference 객체
 */
export async function saveConversationReference(
  userUpn: string,
  reference: Partial<ConversationReference>
): Promise<void> {
  try {
    const tableClient = getTableClient();
    
    const entity: ConversationEntity = {
      partitionKey: PARTITION_KEY,
      rowKey: userUpn.toLowerCase(), // UPN은 소문자로 저장
      conversationReferenceJson: JSON.stringify(reference),
    };

    await tableClient.upsertEntity(entity, 'Replace');
    console.log(`[TeamsConversationRepo] Conversation Reference 저장 완료: ${userUpn}`);
  } catch (error) {
    console.error(`[TeamsConversationRepo] Conversation Reference 저장 실패: ${userUpn}`, error);
    throw error;
  }
}

/**
 * Conversation Reference 조회
 * @param userUpn 사용자 UPN (예: ymsim@itmoou.com)
 * @returns Conversation Reference 객체 또는 null
 */
export async function getConversationReference(
  userUpn: string
): Promise<Partial<ConversationReference> | null> {
  try {
    const tableClient = getTableClient();
    const entity = await tableClient.getEntity<ConversationEntity>(
      PARTITION_KEY,
      userUpn.toLowerCase()
    );

    if (entity.conversationReferenceJson) {
      const reference = JSON.parse(entity.conversationReferenceJson);
      console.log(`[TeamsConversationRepo] Conversation Reference 조회 완료: ${userUpn}`);
      return reference;
    }

    return null;
  } catch (error: any) {
    if (error.statusCode === 404) {
      console.log(`[TeamsConversationRepo] Conversation Reference 없음: ${userUpn}`);
      return null;
    }
    
    console.error(`[TeamsConversationRepo] Conversation Reference 조회 실패: ${userUpn}`, error);
    throw error;
  }
}

/**
 * 여러 사용자의 Conversation Reference 조회
 * @param userUpns 사용자 UPN 목록
 * @returns UPN을 키로 하는 Conversation Reference 맵
 */
export async function getConversationReferences(
  userUpns: string[]
): Promise<Map<string, Partial<ConversationReference>>> {
  const references = new Map<string, Partial<ConversationReference>>();

  await Promise.allSettled(
    userUpns.map(async (upn) => {
      const reference = await getConversationReference(upn);
      if (reference) {
        references.set(upn.toLowerCase(), reference);
      }
    })
  );

  console.log(`[TeamsConversationRepo] 조회 완료: ${references.size}/${userUpns.length}명`);
  return references;
}

/**
 * Conversation Reference 삭제
 * @param userUpn 사용자 UPN
 */
export async function deleteConversationReference(userUpn: string): Promise<void> {
  try {
    const tableClient = getTableClient();
    await tableClient.deleteEntity(PARTITION_KEY, userUpn.toLowerCase());
    console.log(`[TeamsConversationRepo] Conversation Reference 삭제 완료: ${userUpn}`);
  } catch (error: any) {
    if (error.statusCode === 404) {
      console.log(`[TeamsConversationRepo] 삭제할 Reference 없음: ${userUpn}`);
      return;
    }
    
    console.error(`[TeamsConversationRepo] Conversation Reference 삭제 실패: ${userUpn}`, error);
    throw error;
  }
}

/**
 * 전체 Conversation Reference 목록 조회 (관리용)
 */
export async function listAllConversationReferences(): Promise<Map<string, Partial<ConversationReference>>> {
  const references = new Map<string, Partial<ConversationReference>>();

  try {
    const tableClient = getTableClient();
    const entities = tableClient.listEntities<ConversationEntity>({
      queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}'` },
    });

    for await (const entity of entities) {
      if (entity.conversationReferenceJson) {
        const reference = JSON.parse(entity.conversationReferenceJson);
        references.set(entity.rowKey, reference);
      }
    }

    console.log(`[TeamsConversationRepo] 전체 조회 완료: ${references.size}명`);
  } catch (error) {
    console.error('[TeamsConversationRepo] 전체 조회 실패:', error);
    throw error;
  }

  return references;
}
