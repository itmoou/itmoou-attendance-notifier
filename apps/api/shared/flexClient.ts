/**
 * Flex API Client
 * Flex OpenAPI 호출을 위한 클라이언트
 * 
 * Base URL: https://openapi.flex.team/v2
 * Token URL: https://openapi.flex.team/v2/auth/realms/open-api/protocol/openid-connect/token
 */

import axios, { AxiosInstance } from 'axios';
import { getFlexAccessToken } from './tokenManager';

export interface Employee {
  employeeNumber: string;
  name: string;
  email: string;
  teamsUserId?: string; // Microsoft Teams User ID
}

/**
 * Flex API의 근태 기록 한 건(Block)
 * formName="근무"이면 근무 블록
 * blockFrom, blockTo로 출퇴근 시각 기록
 */
export interface FlexWorkBlock {
  formName: string;        // "근무", "외근" 등
  blockFrom?: string;      // 출근 시각 (ISO8601 또는 HH:mm 등)
  blockTo?: string;        // 퇴근 시각 (ISO8601 또는 HH:mm 등)
}

/**
 * Flex API의 GET /users/work-schedules-with-work-clock/dates/{date} 응답 한 건
 */
export interface FlexWorkSchedule {
  employeeNumber: string;
  date: string;            // YYYY-MM-DD
  workBlocks: FlexWorkBlock[];
}

export interface AttendanceRecord {
  employeeNumber: string;
  date: string; // YYYY-MM-DD
  workBlocks: FlexWorkBlock[];
}

export interface FlexTimeOffUse {
  // Flex time-off-uses API 응답 한 건
  employeeNumber: string;   // 사원번호
  timeOffType?: string;     // "연차", "반차", "병가" 등
  startDate: string;        // 시작일 (YYYY-MM-DD)
  endDate: string;          // 종료일 (YYYY-MM-DD)
  startAt?: string;         // 시작 시각 (ISO8601)
  endAt?: string;           // 종료 시각 (ISO8601)
  minutes?: number;         // 사용시간(분)
  status?: string;          // 승인상태
}

export interface UserTimeOffUses {
  employeeNumber: string;
  uses: FlexTimeOffUse[];
}
export interface VacationInfo {
  employeeNumber: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  timeOffType: string; // "연차", "병가" 등
}

export interface AttendanceStatus {
  employeeNumber: string;
  date: string;
  hasCheckIn: boolean; // 출근 여부
  hasCheckOut: boolean; // 퇴근 여부
  checkInTime?: string; // ISO 8601
  checkOutTime?: string; // ISO 8601
  isOnVacation: boolean; // 휴가 중 여부
}

class FlexClient {
  private client: AxiosInstance;

  constructor() {
    const apiBase = process.env.FLEX_API_BASE || 'https://openapi.flex.team/v2';
    
    this.client = axios.create({
      baseURL: apiBase,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 요청 인터셉터: Access Token 자동 추가
    this.client.interceptors.request.use(
      async (config) => {
        const token = await getFlexAccessToken();
        config.headers.Authorization = `Bearer ${token}`;
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // 응답 인터셉터: 에러 처리
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('[FlexClient] API 호출 실패:', error.message);
        if (error.response) {
          console.error('[FlexClient] 상태 코드:', error.response.status);
          console.error('[FlexClient] 응답 데이터:', error.response.data);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * 근태 기록 조회
   * GET /users/work-schedules-with-work-clock/dates/{date}?employeeNumbers[]=xxx&employeeNumbers[]=yyy
   * @param date 조회 날짜 (YYYY-MM-DD)
   * @param employeeNumbers 사원번호 목록
   */
  async getWorkSchedules(
    date: string,
    employeeNumbers: string[]
  ): Promise<FlexWorkSchedule[]> {
    try {
      console.log(`[FlexClient] 근태 기록 조회: ${date} (${employeeNumbers.length}명)`);

      const response = await this.client.get(
        `/users/work-schedules-with-work-clock/dates/${date}`,
        {
          params: {
            'employeeNumbers[]': employeeNumbers,
          },
          paramsSerializer: {
            indexes: null, // employeeNumbers[]=xxx 형식으로 전송
          },
        }
      );

      // Flex API 응답 구조 디버깅
      console.log(`[FlexClient] 근태 기록 응답 타입: ${typeof response.data}`);
      console.log(`[FlexClient] 근태 기록 응답 데이터:`, JSON.stringify(response.data, null, 2));

      // Flex API는 배열 또는 객체를 반환할 수 있음
      let rawSchedules: any[] = [];

      if (Array.isArray(response.data)) {
        // 응답이 배열인 경우
        rawSchedules = response.data;
      } else if (response.data && typeof response.data === 'object') {
        // 응답이 객체인 경우 (예: { schedules: [...], data: [...], items: [...], workSchedules: [...] })
        if (response.data.schedules && Array.isArray(response.data.schedules)) {
          rawSchedules = response.data.schedules;
        } else if (response.data.workSchedules && Array.isArray(response.data.workSchedules)) {
          rawSchedules = response.data.workSchedules;
        } else if (response.data.userWorkSchedules && Array.isArray(response.data.userWorkSchedules)) {
          rawSchedules = response.data.userWorkSchedules;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          rawSchedules = response.data.data;
        } else if (response.data.items && Array.isArray(response.data.items)) {
          rawSchedules = response.data.items;
        } else {
          // 객체의 모든 키 확인
          const keys = Object.keys(response.data);
          console.warn(`[FlexClient] 예상하지 못한 응답 구조. 사용 가능한 키: ${keys.join(', ')}`);

          // 첫 번째 배열 속성 사용
          for (const key of keys) {
            if (Array.isArray(response.data[key])) {
              rawSchedules = response.data[key];
              console.log(`[FlexClient] '${key}' 속성을 근태 데이터로 사용`);
              break;
            }
          }
        }
      }

      // Flex API 응답 구조 평탄화
      // 실제 API는 { employeeNumber, days: [{ date, workBlocks }] } 구조를 사용
      let schedules: FlexWorkSchedule[] = [];

      if (rawSchedules.length > 0 && rawSchedules[0].days && Array.isArray(rawSchedules[0].days)) {
        // 중첩 구조: [{ employeeNumber, days: [{ date, workBlocks }] }]
        console.log(`[FlexClient] 중첩된 days 구조 감지, 평탄화 중...`);
        schedules = rawSchedules.flatMap((user: any) =>
          user.days.map((day: any) => ({
            employeeNumber: user.employeeNumber,
            date: day.date,
            workBlocks: day.workBlocks || [],
          }))
        );
      } else {
        // 평면 구조: [{ employeeNumber, date, workBlocks }]
        schedules = rawSchedules;
      }

      console.log(`[FlexClient] 근태 기록 조회 완료: ${schedules.length}건`);
      return schedules;
    } catch (error) {
      console.error('[FlexClient] 근태 기록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 휴가 정보 조회
   * GET /users/time-off-uses/dates/{date}?employeeNumbers[]=xxx&employeeNumbers[]=yyy
   * @param date 조회 날짜 (YYYY-MM-DD)
   * @param employeeNumbers 사원번호 목록
   */
  async getTimeOffUses(
    date: string,
    employeeNumbers: string[]
  ): Promise<FlexTimeOffUse[]> {
    try {
      console.log(`[FlexClient] 휴가 정보 조회: ${date} (${employeeNumbers.length}명)`);

      const response = await this.client.get(`/users/time-off-uses/dates/${date}`, {
        params: {
          'employeeNumbers[]': employeeNumbers,
        },
        paramsSerializer: {
          indexes: null,
        },
      });

      // Flex API 응답 구조 디버깅
      console.log(`[FlexClient] 휴가 정보 응답 타입: ${typeof response.data}`);
      console.log(`[FlexClient] 휴가 정보 응답 데이터:`, JSON.stringify(response.data, null, 2));

      // Flex API는 배열 또는 객체를 반환할 수 있음
      let rawTimeOffs: any[] = [];

      if (Array.isArray(response.data)) {
        // 응답이 배열인 경우
        rawTimeOffs = response.data;
      } else if (response.data && typeof response.data === 'object') {
        // 응답이 객체인 경우 (예: { timeOffs: [...], data: [...], items: [...] })
        if (response.data.timeOffs && Array.isArray(response.data.timeOffs)) {
          rawTimeOffs = response.data.timeOffs;
        } else if (response.data.userTimeOffUses && Array.isArray(response.data.userTimeOffUses)) {
          rawTimeOffs = response.data.userTimeOffUses;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          rawTimeOffs = response.data.data;
        } else if (response.data.items && Array.isArray(response.data.items)) {
          rawTimeOffs = response.data.items;
        } else {
          // 객체의 모든 키 확인
          const keys = Object.keys(response.data);
          console.warn(`[FlexClient] 예상하지 못한 응답 구조. 사용 가능한 키: ${keys.join(', ')}`);

          // 첫 번째 배열 속성 사용
          for (const key of keys) {
            if (Array.isArray(response.data[key])) {
              rawTimeOffs = response.data[key];
              console.log(`[FlexClient] '${key}' 속성을 휴가 데이터로 사용`);
              break;
            }
          }
        }
      }

      // Flex API 응답 구조 평탄화
      // 실제 API는 { employeeNumber, uses: [{ timeOffType, startDate, endDate, ... }] } 구조를 사용
      let timeOffs: FlexTimeOffUse[] = [];

      if (rawTimeOffs.length > 0 && rawTimeOffs[0].uses && Array.isArray(rawTimeOffs[0].uses)) {
        // 중첩 구조: [{ employeeNumber, uses: [{ timeOffType, startDate, ... }] }]
        console.log(`[FlexClient] 중첩된 uses 구조 감지, 평탄화 중...`);
        timeOffs = rawTimeOffs.flatMap((user: any) =>
          user.uses.map((use: any) => ({
            ...use,
            employeeNumber: user.employeeNumber,
          }))
        );
      } else {
        // 평면 구조: [{ employeeNumber, timeOffType, startDate, ... }]
        timeOffs = rawTimeOffs;
      }

      console.log(`[FlexClient] 휴가 정보 조회 완료: ${timeOffs.length}건`);
      return timeOffs;
    } catch (error) {
      console.error('[FlexClient] 휴가 정보 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 근태 상태 분석 (누락 판정)
   * @param date 조회 날짜 (YYYY-MM-DD)
   * @param employeeNumbers 사원번호 목록
   */
  async getAttendanceStatuses(
    date: string,
    employeeNumbers: string[]
  ): Promise<AttendanceStatus[]> {
    try {
      // 1. 근태 기록 조회
      const schedules = await this.getWorkSchedules(date, employeeNumbers);

      // 2. 휴가 정보 조회
      const timeOffs = await this.getTimeOffUses(date, employeeNumbers);

      // 3. 휴가자 Set 생성
      const vacationSet = new Set<string>();
      timeOffs.forEach((timeOff) => {
        if (
          timeOff.startDate <= date &&
          timeOff.endDate >= date
        ) {
          vacationSet.add(timeOff.employeeNumber);
        }
      });

      // 4. 근태 상태 분석
      const statuses: AttendanceStatus[] = schedules.map((schedule) => {
        const isOnVacation = vacationSet.has(schedule.employeeNumber);

        // "근무" 블록 찾기
        const workBlock = schedule.workBlocks.find((block) => block.formName === '근무');

        let hasCheckIn = false;
        let hasCheckOut = false;
        let checkInTime: string | undefined;
        let checkOutTime: string | undefined;

        if (workBlock) {
          hasCheckIn = !!workBlock.blockFrom;
          hasCheckOut = !!workBlock.blockTo;
          checkInTime = workBlock.blockFrom;
          checkOutTime = workBlock.blockTo;
        }

        return {
          employeeNumber: schedule.employeeNumber,
          date: schedule.date,
          hasCheckIn,
          hasCheckOut,
          checkInTime,
          checkOutTime,
          isOnVacation,
        };
      });

      console.log(`[FlexClient] 근태 상태 분석 완료: ${statuses.length}명`);
      return statuses;
    } catch (error) {
      console.error('[FlexClient] 근태 상태 분석 실패:', error);
      throw error;
    }
  }

  /**
   * 출근 누락자 조회
   * @param date 조회 날짜 (YYYY-MM-DD)
   * @param employeeNumbers 사원번호 목록
   * @returns 출근 누락 사원번호 목록
   */
  async getMissingCheckInEmployees(
    date: string,
    employeeNumbers: string[]
  ): Promise<string[]> {
    const statuses = await this.getAttendanceStatuses(date, employeeNumbers);

    const missing = statuses
      .filter((s) => !s.isOnVacation && !s.hasCheckIn)
      .map((s) => s.employeeNumber);

    console.log(`[FlexClient] 출근 누락: ${missing.length}/${statuses.length}명`);
    return missing;
  }

  /**
   * 퇴근 누락자 조회
   * @param date 조회 날짜 (YYYY-MM-DD)
   * @param employeeNumbers 사원번호 목록
   * @returns 퇴근 누락 사원번호 목록
   */
  async getMissingCheckOutEmployees(
    date: string,
    employeeNumbers: string[]
  ): Promise<string[]> {
    const statuses = await this.getAttendanceStatuses(date, employeeNumbers);

    const missing = statuses
      .filter((s) => !s.isOnVacation && s.hasCheckIn && !s.hasCheckOut)
      .map((s) => s.employeeNumber);

    console.log(`[FlexClient] 퇴근 누락: ${missing.length}/${statuses.length}명`);
    return missing;
  }

  /**
   * 특정 날짜의 휴가자 목록 조회 (상세 정보 포함)
   * @param date 조회 날짜 (YYYY-MM-DD)
   * @param employeeNumbers 사원번호 목록
   * @returns 휴가자 상세 정보 목록
   */
  async getVacationersWithDetails(
    date: string,
    employeeNumbers: string[]
  ): Promise<VacationInfo[]> {
    try {
      const timeOffs = await this.getTimeOffUses(date, employeeNumbers);

      const vacationers: VacationInfo[] = timeOffs
        .filter((timeOff) => timeOff.startDate <= date && timeOff.endDate >= date)
        .map((timeOff) => ({
          employeeNumber: timeOff.employeeNumber,
          startDate: timeOff.startDate,
          endDate: timeOff.endDate,
          timeOffType: timeOff.timeOffType || '연차',
        }));

      console.log(`[FlexClient] ${date} 휴가자: ${vacationers.length}명`);
      return vacationers;
    } catch (error) {
      console.error('[FlexClient] 휴가자 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 날짜 범위의 휴가 정보 조회 (주간/월간 휴가 현황용)
   * @param startDate 시작 날짜 (YYYY-MM-DD)
   * @param endDate 종료 날짜 (YYYY-MM-DD)
   * @param employeeNumbers 사원번호 목록
   * @returns 기간 내 모든 휴가 정보
   */
  async getVacationsInRange(
    startDate: string,
    endDate: string,
    employeeNumbers: string[]
  ): Promise<FlexTimeOffUse[]> {
    try {
      console.log(`[FlexClient] 휴가 범위 조회: ${startDate} ~ ${endDate}`);

      // 날짜 범위 내의 각 날짜에 대해 휴가 정보 조회
      const dates: string[] = [];
      const current = new Date(startDate);
      const end = new Date(endDate);

      while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }

      // 중복 제거를 위한 Map
      const vacationMap = new Map<string, FlexTimeOffUse>();

      for (const date of dates) {
        const timeOffs = await this.getTimeOffUses(date, employeeNumbers);
        timeOffs.forEach((timeOff) => {
          const key = `${timeOff.employeeNumber}-${timeOff.startDate}-${timeOff.endDate}`;
          if (!vacationMap.has(key)) {
            vacationMap.set(key, timeOff);
          }
        });
      }

      const allVacations = Array.from(vacationMap.values());
      console.log(`[FlexClient] 휴가 범위 조회 완료: ${allVacations.length}건`);
      return allVacations;
    } catch (error) {
      console.error('[FlexClient] 휴가 범위 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 내일 휴가 시작하는 직원 조회
   * @param tomorrow 내일 날짜 (YYYY-MM-DD)
   * @param employeeNumbers 사원번호 목록
   * @returns 내일 휴가 시작하는 사원번호 목록
   */
  async getVacationStartingTomorrow(
    tomorrow: string,
    employeeNumbers: string[]
  ): Promise<FlexTimeOffUse[]> {
    try {
      const timeOffs = await this.getTimeOffUses(tomorrow, employeeNumbers);
      
      // 내일이 휴가 시작일인 케이스만 필터링
      const startingVacations = timeOffs.filter(
        (timeOff) => timeOff.startDate === tomorrow
      );

      console.log(`[FlexClient] 내일(${tomorrow}) 휴가 시작: ${startingVacations.length}명`);
      return startingVacations;
    } catch (error) {
      console.error('[FlexClient] 내일 휴가 시작 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 내일 휴가 종료 (복귀일) 직원 조회
   * @param today 오늘 날짜 (YYYY-MM-DD)
   * @param employeeNumbers 사원번호 목록
   * @returns 내일 복귀하는 사원번호 목록
   */
  async getVacationEndingToday(
    today: string,
    employeeNumbers: string[]
  ): Promise<FlexTimeOffUse[]> {
    try {
      const timeOffs = await this.getTimeOffUses(today, employeeNumbers);
      
      // 오늘이 휴가 종료일인 케이스만 필터링
      const endingVacations = timeOffs.filter(
        (timeOff) => timeOff.endDate === today
      );

      console.log(`[FlexClient] 오늘(${today}) 휴가 종료: ${endingVacations.length}명`);
      return endingVacations;
    } catch (error) {
      console.error('[FlexClient] 휴가 종료 조회 실패:', error);
      throw error;
    }
  }
}

// Singleton instance
let flexClientInstance: FlexClient | null = null;

export function getFlexClient(): FlexClient {
  if (!flexClientInstance) {
    flexClientInstance = new FlexClient();
  }
  return flexClientInstance;
}

export default FlexClient;
