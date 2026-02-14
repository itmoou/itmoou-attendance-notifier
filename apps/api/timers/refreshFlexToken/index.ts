/**
 * Refresh Flex Token Timer
 * 6일마다 Flex Refresh Token을 자동으로 갱신
 * (Refresh Token은 7일 유효 → 여유있게 6일마다 갱신)
 */

import { app, InvocationContext, Timer } from '@azure/functions';
import { getFlexAccessToken } from '../../shared/tokenManager';

async function refreshFlexTokenHandler(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  const triggerTime = new Date(myTimer.scheduleStatus?.last || new Date());
  context.log(`[RefreshFlexToken] 실행 시작: ${triggerTime.toISOString()}`);

  try {
    context.log('[RefreshFlexToken] Flex Refresh Token 자동 갱신 시작');

    // Access Token 발급 시도 (이 과정에서 새 Refresh Token도 받음)
    const accessToken = await getFlexAccessToken();

    if (accessToken) {
      context.log('[RefreshFlexToken] ✅ Refresh Token 갱신 완료');
      context.log('[RefreshFlexToken] 새로운 Refresh Token이 Storage에 자동 저장되었습니다');
    } else {
      context.warn('[RefreshFlexToken] ⚠️ Access Token을 받지 못했습니다');
    }
  } catch (error: any) {
    context.error('[RefreshFlexToken] ❌ 갱신 실패:', error.message);

    // TODO: 실패 시 알림 전송 (HR 팀 또는 관리자에게)
    // await sendAlertToAdmin('Flex Token 갱신 실패', error.message);

    throw error;
  }
}

// Timer: 6일마다 실행 (Refresh Token은 7일 유효)
// Cron: 0 0 0 */6 * * (6일마다 자정 UTC = 오전 9시 KST)
app.timer('refreshFlexToken', {
  schedule: '0 0 0 */6 * *',
  handler: refreshFlexTokenHandler,
});

export default refreshFlexTokenHandler;
