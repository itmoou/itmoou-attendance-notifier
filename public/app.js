// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:7071/api'
  : 'https://itmoou-attendance-func-ate3csagf3c4hyas.koreacentral-01.azurewebsites.net/api';

// Function Key 가져오기 (URL 파라미터 또는 환경변수)
function getFunctionKey() {
  const urlParams = new URLSearchParams(window.location.search);
  const keyFromUrl = urlParams.get('key');
  
  if (keyFromUrl) {
    return keyFromUrl;
  }
  
  return '';
}

const FUNCTION_KEY = getFunctionKey();

// 전역 변수
let allVacations = []; // 모든 휴가 데이터
let filteredVacations = []; // 필터링된 데이터

// DOM 요소
const filterDepartment = document.getElementById('filterDepartment');
const filterEmployee = document.getElementById('filterEmployee');
const filterVacationType = document.getElementById('filterVacationType');
const filterStartDate = document.getElementById('filterStartDate');
const filterEndDate = document.getElementById('filterEndDate');
const btnSearch = document.getElementById('btnSearch');
const btnReset = document.getElementById('btnReset');
const btnRefresh = document.getElementById('btnRefresh');
const vacationTableBody = document.getElementById('vacationTableBody');
const totalCount = document.getElementById('totalCount');
const emptyState = document.getElementById('emptyState');
const loadingEl = document.getElementById('loading');

// 초기화
document.addEventListener('DOMContentLoaded', () => {
  // Function Key 체크
  if (!FUNCTION_KEY) {
    const keyPrompt = confirm(
      '휴가 현황을 확인하려면 Function Key가 필요합니다.\n\n' +
      'URL에 ?key=YOUR_FUNCTION_KEY 를 추가해주세요.\n\n' +
      '예: https://vacation-calendar.com/?key=ABC123...\n\n' +
      '지금 입력하시겠습니까?'
    );
    
    if (keyPrompt) {
      const inputKey = prompt('Function Key를 입력하세요:');
      if (inputKey) {
        window.location.href = window.location.pathname + '?key=' + encodeURIComponent(inputKey);
        return;
      }
    }
  }

  // 기본 날짜 범위 설정 (이번 달 전체)
  setDefaultDateRange();

  // 이벤트 리스너
  btnSearch.addEventListener('click', applyFilters);
  btnReset.addEventListener('click', resetFilters);
  btnRefresh.addEventListener('click', loadVacationData);

  // Enter 키로 검색
  filterEmployee.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      applyFilters();
    }
  });

  // 초기 데이터 로드
  loadVacationData();
});

// 기본 날짜 범위 설정 (이번 달 1일 ~ 말일)
function setDefaultDateRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  const firstDay = `${year}-${month.toString().padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const lastDayStr = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
  
  filterStartDate.value = firstDay;
  filterEndDate.value = lastDayStr;
}

// 휴가 데이터 로드
async function loadVacationData() {
  try {
    loadingEl.style.display = 'block';
    emptyState.style.display = 'none';

    const startDate = filterStartDate.value;
    const endDate = filterEndDate.value;

    if (!startDate || !endDate) {
      alert('날짜 범위를 선택해주세요.');
      return;
    }

    // 날짜 범위를 연/월로 분할하여 API 호출
    const vacations = await fetchVacationsByDateRange(startDate, endDate);
    
    allVacations = vacations;
    filteredVacations = vacations;

    // 부서 목록 업데이트
    updateDepartmentFilter();

    // 테이블 렌더링
    renderTable(filteredVacations);

  } catch (error) {
    console.error('휴가 데이터 로드 실패:', error);
    alert('휴가 데이터를 불러오는 중 오류가 발생했습니다.\n\n' + error.message);
  } finally {
    loadingEl.style.display = 'none';
  }
}

// 날짜 범위로 휴가 데이터 조회
async function fetchVacationsByDateRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const allVacations = [];
  const seenVacations = new Set(); // 중복 제거

  // 월별로 API 호출
  let current = new Date(start.getFullYear(), start.getMonth(), 1);
  
  while (current <= end) {
    const year = current.getFullYear();
    const month = current.getMonth() + 1;

    console.log(`[VacationList] API 호출: ${year}년 ${month}월`);

    const url = `${API_BASE_URL}/vacation/calendar?year=${year}&month=${month}${FUNCTION_KEY ? '&code=' + FUNCTION_KEY : ''}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const result = await response.json();

    if (result.success && result.data.vacationDays) {
      // vacationDays 배열에서 휴가자 추출
      result.data.vacationDays.forEach(day => {
        day.vacationers.forEach(vacationer => {
          // 날짜 범위 필터링
          if (vacationer.startDate >= startDate && vacationer.startDate <= endDate) {
            const key = `${vacationer.employeeNumber}-${vacationer.startDate}-${vacationer.endDate}`;
            if (!seenVacations.has(key)) {
              seenVacations.add(key);
              allVacations.push(vacationer);
            }
          }
        });
      });
    }

    // 다음 달로 이동
    current.setMonth(current.getMonth() + 1);
  }

  console.log(`[VacationList] 총 ${allVacations.length}건의 휴가 데이터 로드`);
  return allVacations;
}

// 부서 필터 옵션 업데이트
function updateDepartmentFilter() {
  const departments = new Set();
  
  allVacations.forEach(vacation => {
    if (vacation.department) {
      departments.add(vacation.department);
    }
  });

  // 기존 옵션 제거 (전체 제외)
  filterDepartment.innerHTML = '<option value="">전체</option>';

  // 부서 옵션 추가
  Array.from(departments).sort().forEach(dept => {
    const option = document.createElement('option');
    option.value = dept;
    option.textContent = dept;
    filterDepartment.appendChild(option);
  });
}

// 필터 적용
function applyFilters() {
  const department = filterDepartment.value.toLowerCase();
  const employee = filterEmployee.value.trim().toLowerCase();
  const vacationType = filterVacationType.value;

  filteredVacations = allVacations.filter(vacation => {
    // 부서 필터
    if (department && vacation.department && !vacation.department.toLowerCase().includes(department)) {
      return false;
    }

    // 사원명 필터
    if (employee && !vacation.employeeName.toLowerCase().includes(employee)) {
      return false;
    }

    // 휴가 유형 필터
    if (vacationType && vacation.vacationType !== vacationType) {
      return false;
    }

    return true;
  });

  renderTable(filteredVacations);
}

// 필터 초기화
function resetFilters() {
  filterDepartment.value = '';
  filterEmployee.value = '';
  filterVacationType.value = '';
  setDefaultDateRange();
  
  filteredVacations = allVacations;
  renderTable(filteredVacations);
}

// 테이블 렌더링
function renderTable(vacations) {
  vacationTableBody.innerHTML = '';
  totalCount.textContent = `총 ${vacations.length}명`;

  if (vacations.length === 0) {
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  // 시작일 기준 정렬
  vacations.sort((a, b) => a.startDate.localeCompare(b.startDate));

  vacations.forEach((vacation, index) => {
    const tr = document.createElement('tr');

    // 기간 계산
    const days = calculateDays(vacation.startDate, vacation.endDate);

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${vacation.department || '-'}</td>
      <td>${vacation.employeeName || vacation.employeeNumber}</td>
      <td><span class="vacation-type-badge vacation-type-${vacation.vacationType || '기타'}">${vacation.vacationType || '휴가'}</span></td>
      <td>${formatDate(vacation.startDate)}</td>
      <td>${formatDate(vacation.endDate)}</td>
      <td>${days}일</td>
    `;

    vacationTableBody.appendChild(tr);
  });
}

// 날짜 포맷 (YYYY-MM-DD → MM/DD (요일))
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[date.getDay()];
  
  return `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')} (${weekday})`;
}

// 기간 계산 (일수)
function calculateDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 for inclusive
  return diffDays;
}
