/**
 * Onboarding Tracker
 * 온보딩 미완료 사용자 추적
 */

export interface OnboardingStatus {
  userUpn: string;
  employeeNumber?: string;
  hasConversationReference: boolean;
  reason?: string;
}

const onboardingIncomplete: OnboardingStatus[] = [];

/**
 * 온보딩 미완료 사용자 추가
 */
export function trackOnboardingIncomplete(status: OnboardingStatus): void {
  // 중복 방지
  const exists = onboardingIncomplete.some((s) => s.userUpn === status.userUpn);
  if (!exists) {
    onboardingIncomplete.push(status);
  }
}

/**
 * 온보딩 미완료 사용자 목록 조회
 */
export function getOnboardingIncomplete(): OnboardingStatus[] {
  return [...onboardingIncomplete];
}

/**
 * 온보딩 미완료 목록 초기화
 */
export function clearOnboardingIncomplete(): void {
  onboardingIncomplete.length = 0;
}
