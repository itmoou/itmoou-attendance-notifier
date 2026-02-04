/**
 * 단위 테스트: sendProactiveMessage
 * 
 * 사용법:
 * 1. local.settings.json 설정 완료
 * 2. npm run build
 * 3. ts-node scripts/test-proactive-message.ts
 */

import { sendProactiveMessage } from '../apps/api/shared/teamsClient';

async function main() {
  // 테스트할 사용자 UPN
  const testUserUpn = process.argv[2] || 'test@itmoou.com';
  
  console.log('='.repeat(60));
  console.log('🧪 sendProactiveMessage 단위 테스트');
  console.log('='.repeat(60));
  console.log(`대상 사용자: ${testUserUpn}`);
  console.log('');

  const testMessage = `
📢 **테스트 메시지**

이 메시지는 sendProactiveMessage() 함수의 단위 테스트입니다.

✅ 이 메시지를 받았다면 Teams Bot이 정상 동작하고 있습니다!

**테스트 시각**: ${new Date().toISOString()}
`.trim();

  try {
    console.log('📤 메시지 전송 시작...');
    console.log('');
    
    const result = await sendProactiveMessage(testUserUpn, testMessage);
    
    console.log('');
    console.log('='.repeat(60));
    
    if (result.success) {
      console.log('✅ 성공: 메시지 전송 완료!');
      console.log('');
      console.log('Teams 앱에서 봇으로부터 메시지가 도착했는지 확인하세요.');
    } else {
      console.log('❌ 실패: 메시지 전송 실패');
      console.log(`사유: ${result.error}`);
      console.log('');
      console.log('💡 해결 방법:');
      console.log('  1. 사용자가 먼저 봇에게 "hi" 메시지를 보냈는지 확인');
      console.log('  2. BOT_APP_ID, BOT_APP_PASSWORD 환경변수 확인');
      console.log('  3. AZURE_STORAGE_CONNECTION_STRING 확인');
      console.log('  4. TeamsConversation 테이블에 Conversation Reference 저장 확인');
    }
    
    console.log('='.repeat(60));
  } catch (error: any) {
    console.error('');
    console.error('💥 예외 발생:', error.message);
    console.error('');
    console.error('스택 트레이스:');
    console.error(error.stack);
    process.exit(1);
  }
}

main();
