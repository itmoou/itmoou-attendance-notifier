import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getFlexClient } from '../../shared/flexClient';
import { getAllEmployeeMaps } from '../../shared/storage/employeeMapRepo';

/**
 * Vacation Calendar API
 * GET /api/vacation/calendar?year=2024&month=2
 * 
 * 특정 월의 휴가 데이터를 조회하여 달력에 표시할 수 있도록 반환
 */

interface VacationCalendarRequest {
  year?: string;
  month?: string;
  startDate?: string;
  endDate?: string;
}

interface VacationDay {
  date: string; // YYYY-MM-DD
  vacationers: Array<{
    employeeNumber: string;
    employeeName: string;
    employeeEmail?: string;
    vacationType: string;
    startDate: string;
    endDate: string;
    reason?: string;
  }>;
  count: number;
}

async function vacationCalendarHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    context.log('[VacationCalendar] 휴가 캘린더 API 호출');

    // Query Parameters 파싱
    const year = request.query.get('year');
    const month = request.query.get('month');
    const startDate = request.query.get('startDate');
    const endDate = request.query.get('endDate');

    let calculatedStartDate: string;
    let calculatedEndDate: string;

    // 날짜 범위 계산
    if (startDate && endDate) {
      // 직접 날짜 범위 지정
      calculatedStartDate = startDate;
      calculatedEndDate = endDate;
    } else if (year && month) {
      // 년/월로 해당 월의 시작일~종료일 계산
      const yearNum = parseInt(year, 10);
      const monthNum = parseInt(month, 10);

      if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        return {
          status: 400,
          jsonBody: {
            success: false,
            error: '유효하지 않은 year 또는 month 값입니다. (year: YYYY, month: 1-12)',
          },
        };
      }

      // 해당 월의 시작일
      calculatedStartDate = `${year}-${month.padStart(2, '0')}-01`;

      // 해당 월의 마지막 날짜 계산
      const lastDay = new Date(yearNum, monthNum, 0).getDate();
      calculatedEndDate = `${year}-${month.padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
    } else {
      // 기본값: 현재 월
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const lastDay = new Date(currentYear, currentMonth, 0).getDate();

      calculatedStartDate = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
      calculatedEndDate = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
    }

    context.log(`[VacationCalendar] 조회 기간: ${calculatedStartDate} ~ ${calculatedEndDate}`);

    // Flex Client 가져오기
    const flexClient = getFlexClient();

    // 전체 직원 목록 조회 (employeeNumber 추출)
    const employeeMaps = await getAllEmployeeMaps();
    const employeeNumbers = Array.from(employeeMaps.values()).map(emp => emp.employeeNumber);

    if (employeeNumbers.length === 0) {
      context.warn('[VacationCalendar] 등록된 직원이 없습니다.');
      return {
        status: 200,
        jsonBody: {
          success: true,
          data: {
            startDate: calculatedStartDate,
            endDate: calculatedEndDate,
            vacationDays: [],
          },
        },
      };
    }

    // 날짜 범위의 휴가 데이터 조회
    const vacationsInRange = await flexClient.getVacationsInRange(
      calculatedStartDate,
      calculatedEndDate,
      employeeNumbers
    );

    context.log(`[VacationCalendar] 조회된 휴가 건수: ${vacationsInRange.length}`);

    // 날짜별로 휴가자 그룹화
    const vacationsByDate = new Map<string, VacationDay>();

    for (const vacation of vacationsInRange) {
      // 휴가 기간의 모든 날짜를 순회
      const start = new Date(vacation.startDate);
      const end = new Date(vacation.endDate);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD

        // 조회 범위 내의 날짜만 포함
        if (dateStr < calculatedStartDate || dateStr > calculatedEndDate) {
          continue;
        }

        if (!vacationsByDate.has(dateStr)) {
          vacationsByDate.set(dateStr, {
            date: dateStr,
            vacationers: [],
            count: 0,
          });
        }

        const dayData = vacationsByDate.get(dateStr)!;

        // 중복 체크 (동일 직원이 이미 추가되었는지)
        const alreadyAdded = dayData.vacationers.some(
          v => v.employeeNumber === vacation.employeeNumber
        );

        if (!alreadyAdded) {
          // UPN(이메일)과 이름 조회
          const empMap = employeeMaps.get(vacation.employeeNumber);
          const employeeName = empMap?.name || vacation.employeeNumber;
          const employeeEmail = empMap ? `${vacation.employeeNumber}@itmoou.com` : undefined;

          dayData.vacationers.push({
            employeeNumber: vacation.employeeNumber,
            employeeName: employeeName,
            employeeEmail,
            vacationType: vacation.timeOffType || '휴가',
            startDate: vacation.startDate,
            endDate: vacation.endDate,
            reason: undefined, // Flex API에는 사유 필드가 없음
          });
          dayData.count++;
        }
      }
    }

    // Map을 Array로 변환하고 날짜순 정렬
    const vacationDays = Array.from(vacationsByDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          startDate: calculatedStartDate,
          endDate: calculatedEndDate,
          vacationDays,
          totalVacationDays: vacationDays.length,
        },
      },
    };
  } catch (error: any) {
    context.error('[VacationCalendar] 에러 발생:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: error.message || '휴가 캘린더 조회 중 오류가 발생했습니다.',
      },
    };
  }
}

// Azure Functions v4 등록
app.http('vacationCalendar', {
  methods: ['GET'],
  authLevel: 'function',
  route: 'vacation/calendar',
  handler: vacationCalendarHandler,
});
