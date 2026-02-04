/**
 * Notification Rules
 * 알림 정책 및 비즈니스 로직
 */

import { getFlexClient, Employee, AttendanceRecord } from './flexClient';

export interface NotificationTarget {
  employee: Employee;
  missingType: 'check-in' | 'check-out';
}

/**
 * 현재 날짜 반환 (YYYY-MM-DD)
 */
export function getCurrentDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 전일 날짜 반환 (YYYY-MM-DD)
 */
export function getYesterdayDate(): string {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 현재 시간 반환 (HH:mm)
 */
export function getCurrentTime(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * 휴가자 제외 필터
 * @param employees 직원 목록
 * @param date 확인할 날짜
 */
export async function filterOutVacationEmployees(
  employees: Employee[],
  date: string
): Promise<Employee[]> {
  const flexClient = getFlexClient();
  const filtered: Employee[] = [];

  for (const employee of employees) {
    const isOnVacation = await flexClient.isOnVacation(employee.id, date);
    if (!isOnVacation) {
      filtered.push(employee);
    } else {
      console.log(`[Rules] ${employee.name}님은 휴가 중입니다. (${date})`);
    }
  }

  return filtered;
}

/**
 * 출근 누락자 확인
 * @param employees 확인할 직원 목록
 * @param date 확인할 날짜
 */
export async function findMissingCheckIns(
  employees: Employee[],
  date: string
): Promise<Employee[]> {
  const flexClient = getFlexClient();
  const missing: Employee[] = [];

  console.log(`[Rules] 출근 누락 확인: ${employees.length}명, ${date}`);

  for (const employee of employees) {
    const attendance = await flexClient.getAttendanceRecord(employee.id, date);
    
    if (!attendance || !attendance.checkInTime) {
      missing.push(employee);
      console.log(`[Rules] 출근 누락: ${employee.name}`);
    }
  }

  console.log(`[Rules] 출근 누락자: ${missing.length}명`);
  return missing;
}

/**
 * 퇴근 누락자 확인
 * @param employees 확인할 직원 목록
 * @param date 확인할 날짜
 */
export async function findMissingCheckOuts(
  employees: Employee[],
  date: string
): Promise<Employee[]> {
  const flexClient = getFlexClient();
  const missing: Employee[] = [];

  console.log(`[Rules] 퇴근 누락 확인: ${employees.length}명, ${date}`);

  for (const employee of employees) {
    const attendance = await flexClient.getAttendanceRecord(employee.id, date);
    
    // 출근은 했지만 퇴근을 안 한 경우
    if (attendance && attendance.checkInTime && !attendance.checkOutTime) {
      missing.push(employee);
      console.log(`[Rules] 퇴근 누락: ${employee.name}`);
    }
  }

  console.log(`[Rules] 퇴근 누락자: ${missing.length}명`);
  return missing;
}

/**
 * 출근 누락 알림 메시지 생성
 * @param employeeName 직원 이름
 * @param attempt 알림 차수 (1차, 2차)
 */
export function createCheckInNotificationMessage(
  employeeName: string,
  attempt: 1 | 2
): string {
  const currentTime = getCurrentTime();

  if (attempt === 1) {
    return `
<div style="font-family: Arial, sans-serif; padding: 20px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
  <h3 style="color: #856404; margin-top: 0;">🔔 출근 체크 알림</h3>
  <p style="color: #856404; line-height: 1.6;">
    안녕하세요, <strong>${employeeName}</strong>님!<br><br>
    현재 시각 <strong>${currentTime}</strong> 기준으로 출근 기록이 확인되지 않습니다.<br>
    출근 체크를 잊으셨다면 지금 바로 체크해주세요!
  </p>
  <p style="color: #666; font-size: 12px; margin-top: 20px;">
    ⏰ 이 메시지는 11:05에 자동으로 발송되었습니다.
  </p>
</div>
`;
  } else {
    return `
<div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f8d7da; border-left: 4px solid #d9534f; border-radius: 4px;">
  <h3 style="color: #721c24; margin-top: 0;">⚠️ 출근 체크 최종 알림</h3>
  <p style="color: #721c24; line-height: 1.6;">
    안녕하세요, <strong>${employeeName}</strong>님!<br><br>
    현재 시각 <strong>${currentTime}</strong> 기준으로 여전히 출근 기록이 확인되지 않습니다.<br>
    <strong style="color: #d9534f;">즉시 출근 체크를 해주시기 바랍니다.</strong>
  </p>
  <p style="color: #666; font-size: 12px; margin-top: 20px;">
    ⏰ 이 메시지는 11:30에 자동으로 발송되었습니다.<br>
    📧 누적 리포트가 HR 담당자에게 전송될 예정입니다.
  </p>
</div>
`;
  }
}

/**
 * 퇴근 누락 알림 메시지 생성
 * @param employeeName 직원 이름
 * @param attempt 알림 차수 (1차, 2차)
 */
export function createCheckOutNotificationMessage(
  employeeName: string,
  attempt: 1 | 2
): string {
  const currentTime = getCurrentTime();

  if (attempt === 1) {
    return `
<div style="font-family: Arial, sans-serif; padding: 20px; background-color: #d1ecf1; border-left: 4px solid #0c5460; border-radius: 4px;">
  <h3 style="color: #0c5460; margin-top: 0;">🔔 퇴근 체크 알림</h3>
  <p style="color: #0c5460; line-height: 1.6;">
    안녕하세요, <strong>${employeeName}</strong>님!<br><br>
    현재 시각 <strong>${currentTime}</strong> 기준으로 퇴근 기록이 확인되지 않습니다.<br>
    퇴근 체크를 잊으셨다면 지금 바로 체크해주세요!
  </p>
  <p style="color: #666; font-size: 12px; margin-top: 20px;">
    ⏰ 이 메시지는 20:30에 자동으로 발송되었습니다.
  </p>
</div>
`;
  } else {
    return `
<div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f8d7da; border-left: 4px solid #d9534f; border-radius: 4px;">
  <h3 style="color: #721c24; margin-top: 0;">⚠️ 퇴근 체크 최종 알림</h3>
  <p style="color: #721c24; line-height: 1.6;">
    안녕하세요, <strong>${employeeName}</strong>님!<br><br>
    현재 시각 <strong>${currentTime}</strong> 기준으로 여전히 퇴근 기록이 확인되지 않습니다.<br>
    <strong style="color: #d9534f;">즉시 퇴근 체크를 해주시기 바랍니다.</strong>
  </p>
  <p style="color: #666; font-size: 12px; margin-top: 20px;">
    ⏰ 이 메시지는 22:00에 자동으로 발송되었습니다.<br>
    📧 누적 리포트가 HR 담당자에게 전송될 예정입니다.
  </p>
</div>
`;
  }
}

/**
 * 당일 누적 요약 메시지 생성
 * @param employeeName 직원 이름
 * @param missingCheckIn 출근 누락 여부
 * @param missingCheckOut 퇴근 누락 여부
 */
export function createDailySummaryMessage(
  employeeName: string,
  missingCheckIn: boolean,
  missingCheckOut: boolean
): string {
  const currentDate = getCurrentDate();
  const issues: string[] = [];

  if (missingCheckIn) {
    issues.push('🔴 출근 미체크');
  }
  if (missingCheckOut) {
    issues.push('🟡 퇴근 미체크');
  }

  return `
<div style="font-family: Arial, sans-serif; padding: 20px; background-color: #e7f3ff; border-left: 4px solid #0078d4; border-radius: 4px;">
  <h3 style="color: #0078d4; margin-top: 0;">📊 오늘의 근태 누락 요약</h3>
  <p style="color: #333; line-height: 1.6;">
    안녕하세요, <strong>${employeeName}</strong>님!<br><br>
    <strong>${currentDate}</strong> 근태 누락 내역입니다:
  </p>
  <ul style="color: #333; line-height: 1.8;">
    ${issues.map(issue => `<li>${issue}</li>`).join('')}
  </ul>
  <p style="color: #d9534f; font-weight: bold;">
    내일은 꼭 출퇴근 체크를 잊지 말아주세요! 🙏
  </p>
  <p style="color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px;">
    ⏰ 이 메시지는 22:10에 자동으로 발송되었습니다.<br>
    📧 상세 리포트는 익일 09:00에 HR 담당자에게 전송됩니다.
  </p>
</div>
`;
}

/**
 * Teams Bot으로 알림 전송 (Proactive Message)
 * @param employees 알림 대상 직원 목록
 * @param messageGenerator 메시지 생성 함수
 */
export async function sendTeamsNotifications(
  employees: Employee[],
  messageGenerator: (name: string) => string
): Promise<void> {
  const { sendBulkProactiveMessages } = await import('./teamsClient');

  const messages = employees
    .filter(emp => emp.email) // Email(UPN)이 있는 경우만
    .map(emp => ({
      userUpn: emp.email, // Email을 UPN으로 사용
      message: messageGenerator(emp.name),
    }));

  if (messages.length === 0) {
    console.log('[Rules] 알림 대상이 없습니다.');
    return;
  }

  console.log(`[Rules] Teams Bot 알림 발송: ${messages.length}명`);
  await sendBulkProactiveMessages(messages);
}
