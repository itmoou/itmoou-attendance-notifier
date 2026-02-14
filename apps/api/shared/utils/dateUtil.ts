/**
 * 날짜/시간 유틸리티
 * 타임존을 고려한 날짜 처리
 */

/**
 * 한국 시간(KST) 기준 현재 날짜 반환 (YYYY-MM-DD)
 * @returns 한국 시간 기준 날짜 문자열
 */
export function getCurrentDateKST(): string {
  const now = new Date();

  // UTC 시간을 한국 시간(UTC+9)으로 변환
  const kstOffset = 9 * 60; // 9 hours in minutes
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kstTime = new Date(utcTime + (kstOffset * 60000));

  const year = kstTime.getFullYear();
  const month = String(kstTime.getMonth() + 1).padStart(2, '0');
  const day = String(kstTime.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * UTC 기준 현재 날짜 반환 (YYYY-MM-DD)
 * @returns UTC 날짜 문자열
 */
export function getCurrentDateUTC(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 환경변수 TZ를 고려한 현재 날짜 반환 (YYYY-MM-DD)
 * @returns 설정된 타임존 기준 날짜 문자열
 */
export function getCurrentDate(): string {
  // 환경변수에서 타임존 설정 확인
  const tz = process.env.TZ;

  if (tz === 'Asia/Seoul' || tz === 'KST') {
    return getCurrentDateKST();
  }

  // TZ 환경변수가 설정되어 있으면 그것을 사용
  if (tz) {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });

      const parts = formatter.format(now).split('-');
      return `${parts[0]}-${parts[1]}-${parts[2]}`;
    } catch (error) {
      console.warn(`[DateUtil] 잘못된 타임존: ${tz}, KST 사용`);
      return getCurrentDateKST();
    }
  }

  // 기본값: 한국 시간
  console.log('[DateUtil] TZ 환경변수 없음, KST 사용');
  return getCurrentDateKST();
}

/**
 * 날짜 포맷팅 (YYYY-MM-DD)
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 시간 포맷팅 (HH:MM)
 */
export function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
