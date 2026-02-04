/**
 * Flex API Client
 * Flex OpenAPI 호출을 위한 클라이언트
 * 
 * Base URL: https://openapi.flex.team/v2
 * Token URL: https://openapi.flex.team/v2/auth/realms/open-api/protocol/openid-connect/token
 */

import axios, { AxiosInstance } from 'axios';
import { getFlexAccessToken } from './tokenManager';

// Flex API 실제 응답 타입
export interface FlexWorkBlock {
  formName: string; // "근무"
  blockFrom?: string; // 출근 시각 (ISO 8601)
  blockTo?: string; // 퇴근 시각 (ISO 8601)
}

export interface FlexWorkSchedule {
  employeeNumber: string;
  date: string; // YYYY-MM-DD
  workBlocks: FlexWorkBlock[];
}

export interface FlexTimeOffUse {
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

      const schedules: FlexWorkSchedule[] = response.data || [];
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

      const timeOffs: FlexTimeOffUse[] = response.data || [];
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
