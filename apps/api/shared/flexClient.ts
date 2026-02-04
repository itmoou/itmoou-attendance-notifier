/**
 * Flex API Client
 * Flex OpenAPI 호출을 위한 클라이언트
 */

import axios, { AxiosInstance } from 'axios';
import { getFlexAccessToken } from './tokenManager';

export interface Employee {
  employeeNumber: string;
  name: string;
  email: string;
  teamsUserId?: string; // Microsoft Teams User ID
}

export interface AttendanceRecord {
  employeeNumber: string;
  date: string; // YYYY-MM-DD
  checkInTime?: string; // HH:mm:ss
  checkOutTime?: string; // HH:mm:ss
  status: 'present' | 'absent' | 'vacation' | 'sick_leave';
}

export interface VacationInfo {
  employeeNumber: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  type: 'annual' | 'sick' | 'other';
}

class FlexClient {
  private client: AxiosInstance;

  constructor() {
    const apiBase = process.env.FLEX_API_BASE;
    
    if (!apiBase) {
      throw new Error('FLEX_API_BASE 환경변수가 설정되지 않았습니다.');
    }
    
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
   * 전체 직원 목록 조회
   */
  async getEmployees(): Promise<Employee[]> {
    try {
      console.log('[FlexClient] 직원 목록 조회');
      
      // TODO: 실제 Flex API endpoint로 변경
      const response = await this.client.get('/api/v1/employees');
      
      return response.data.employees || [];
    } catch (error) {
      console.error('[FlexClient] 직원 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 특정 직원의 근태 기록 조회
   * @param employeeId 직원 ID
   * @param date 조회 날짜 (YYYY-MM-DD)
   */
  async getAttendanceRecord(employeeId: string, date: string): Promise<AttendanceRecord | null> {
    try {
      console.log(`[FlexClient] 근태 기록 조회: ${employeeId}, ${date}`);
      
      // TODO: 실제 Flex API endpoint로 변경
      const response = await this.client.get(`/api/v1/attendance/${employeeId}`, {
        params: { date },
      });
      
      return response.data.attendance || null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null; // 기록 없음
      }
      console.error('[FlexClient] 근태 기록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 여러 직원의 근태 기록 일괄 조회
   * @param employeeIds 직원 ID 목록
   * @param date 조회 날짜 (YYYY-MM-DD)
   */
  async getAttendanceRecords(employeeIds: string[], date: string): Promise<AttendanceRecord[]> {
    try {
      console.log(`[FlexClient] 근태 기록 일괄 조회: ${employeeIds.length}명, ${date}`);
      
      // TODO: 실제 Flex API endpoint로 변경
      const response = await this.client.post('/api/v1/attendance/batch', {
        employeeIds,
        date,
      });
      
      return response.data.attendances || [];
    } catch (error) {
      console.error('[FlexClient] 근태 기록 일괄 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 특정 날짜의 휴가자 목록 조회
   * @param date 조회 날짜 (YYYY-MM-DD)
   */
  async getVacations(date: string): Promise<VacationInfo[]> {
    try {
      console.log(`[FlexClient] 휴가자 목록 조회: ${date}`);
      
      // TODO: 실제 Flex API endpoint로 변경
      const response = await this.client.get('/api/v1/vacations', {
        params: { date },
      });
      
      return response.data.vacations || [];
    } catch (error) {
      console.error('[FlexClient] 휴가자 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 특정 직원이 휴가 중인지 확인
   * @param employeeId 직원 ID
   * @param date 확인할 날짜 (YYYY-MM-DD)
   */
  async isOnVacation(employeeId: string, date: string): Promise<boolean> {
    try {
      const vacations = await this.getVacations(date);
      return vacations.some(v => v.employeeId === employeeId);
    } catch (error) {
      console.error('[FlexClient] 휴가 여부 확인 실패:', error);
      return false; // 에러 시 false 반환 (안전하게)
    }
  }

  /**
   * 날짜 범위의 근태 기록 조회 (리포트용)
   * @param startDate 시작 날짜 (YYYY-MM-DD)
   * @param endDate 종료 날짜 (YYYY-MM-DD)
   */
  async getAttendanceRecordsByDateRange(startDate: string, endDate: string): Promise<AttendanceRecord[]> {
    try {
      console.log(`[FlexClient] 날짜 범위 근태 기록 조회: ${startDate} ~ ${endDate}`);
      
      // TODO: 실제 Flex API endpoint로 변경
      const response = await this.client.get('/api/v1/attendance/range', {
        params: { startDate, endDate },
      });
      
      return response.data.attendances || [];
    } catch (error) {
      console.error('[FlexClient] 날짜 범위 근태 기록 조회 실패:', error);
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
