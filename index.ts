/**
 * Azure Functions v4 Entry Point (Root Level)
 * 
 * Azure Functions 런타임이 이 파일을 로드하면서
 * 모든 app.http, app.timer 등록이 실행됩니다.
 * 
 * 중요: 각 함수 파일에서 app.http/app.timer를 호출하므로,
 * 이 파일에서는 단순히 import만 하면 됩니다.
 */

// HTTP Functions
import './apps/api/bot/messages/index';
import './apps/api/test/sendTestEmail/index';
import './apps/api/test/testFlexToken/index';
import './apps/api/test/testFlexAuth/index';
import './apps/api/http/vacationApproved/index';
import './apps/api/http/vacationCalendar/index';

// Timer Functions
import './apps/api/timers/checkCheckIn/index';
import './apps/api/timers/checkCheckOut/index';
import './apps/api/timers/dailySummary/index';
import './apps/api/timers/outlookReport/index';
import './apps/api/timers/vacationAnnouncement/index';
import './apps/api/timers/vacationReminder/index';

// Note: 함수 등록은 각 파일에서 app.http(), app.timer() 호출로 완료됩니다.
// 이 파일은 단지 런타임이 모든 함수 파일을 로드하도록 보장합니다.
