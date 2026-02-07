// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:7071/api'
  : 'https://itmoou-attendance-func.azurewebsites.net/api';

// Function Key (보안상 환경변수로 관리하거나 인증 토큰 사용 권장)
// 실제 배포 시에는 Azure AD 인증 등을 사용해야 합니다
const FUNCTION_KEY = ''; // Azure Portal에서 확인한 Function Key를 여기에 입력

// 현재 표시 중인 년/월
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;

// 휴가 데이터 캐시
let vacationData = [];

// DOM 요소
const calendarEl = document.getElementById('calendar');
const currentMonthEl = document.getElementById('currentMonth');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const vacationDetailsEl = document.getElementById('vacationDetails');
const selectedDateEl = document.getElementById('selectedDate');
const vacationListEl = document.getElementById('vacationList');
const closeDetailsBtn = document.getElementById('closeDetails');
const loadingEl = document.getElementById('loading');

// 초기화
document.addEventListener('DOMContentLoaded', () => {
  renderCalendar();
  loadVacationData();

  prevMonthBtn.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 1) {
      currentMonth = 12;
      currentYear--;
    }
    renderCalendar();
    loadVacationData();
  });

  nextMonthBtn.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
    renderCalendar();
    loadVacationData();
  });

  closeDetailsBtn.addEventListener('click', () => {
    vacationDetailsEl.style.display = 'none';
  });
});

// 휴가 데이터 로드
async function loadVacationData() {
  try {
    loadingEl.style.display = 'block';

    const url = `${API_BASE_URL}/vacation/calendar?year=${currentYear}&month=${currentMonth}${FUNCTION_KEY ? '&code=' + FUNCTION_KEY : ''}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      vacationData = result.data.vacationDays || [];
      updateCalendarWithVacations();
    } else {
      throw new Error(result.error || '휴가 데이터를 불러올 수 없습니다.');
    }
  } catch (error) {
    console.error('휴가 데이터 로드 실패:', error);
    alert('휴가 데이터를 불러오는 중 오류가 발생했습니다.\n\n' + error.message);
  } finally {
    loadingEl.style.display = 'none';
  }
}

// 달력 렌더링
function renderCalendar() {
  currentMonthEl.textContent = `${currentYear}년 ${currentMonth}월`;
  calendarEl.innerHTML = '';

  // 요일 헤더
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  weekdays.forEach(day => {
    const header = document.createElement('div');
    header.className = 'calendar-header';
    header.textContent = day;
    calendarEl.appendChild(header);
  });

  // 달력 날짜 계산
  const firstDay = new Date(currentYear, currentMonth - 1, 1);
  const lastDay = new Date(currentYear, currentMonth, 0);
  const prevLastDay = new Date(currentYear, currentMonth - 1, 0);

  const firstDayOfWeek = firstDay.getDay();
  const lastDate = lastDay.getDate();
  const prevLastDate = prevLastDay.getDate();

  const today = new Date();
  const todayDate = today.getDate();
  const todayMonth = today.getMonth() + 1;
  const todayYear = today.getFullYear();

  // 이전 달 마지막 날짜들
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const dayEl = createDayElement(prevLastDate - i, true, false);
    calendarEl.appendChild(dayEl);
  }

  // 현재 달 날짜들
  for (let date = 1; date <= lastDate; date++) {
    const isToday = date === todayDate && currentMonth === todayMonth && currentYear === todayYear;
    const dayOfWeek = new Date(currentYear, currentMonth - 1, date).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    const dayEl = createDayElement(date, false, isWeekend, isToday);
    calendarEl.appendChild(dayEl);
  }

  // 다음 달 시작 날짜들
  const totalCells = calendarEl.children.length - 7; // 헤더 제외
  const remainingCells = 42 - totalCells; // 6주 * 7일
  for (let date = 1; date <= remainingCells; date++) {
    const dayEl = createDayElement(date, true, false);
    calendarEl.appendChild(dayEl);
  }
}

// 날짜 셀 생성
function createDayElement(date, isOtherMonth, isWeekend, isToday = false) {
  const dayEl = document.createElement('div');
  dayEl.className = 'calendar-day';
  
  if (isOtherMonth) {
    dayEl.classList.add('other-month');
  }
  if (isWeekend && !isOtherMonth) {
    dayEl.classList.add('weekend');
  }
  if (isToday) {
    dayEl.classList.add('today');
  }

  const dayNumber = document.createElement('div');
  dayNumber.className = 'day-number';
  dayNumber.textContent = date;
  dayEl.appendChild(dayNumber);

  if (!isOtherMonth) {
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    dayEl.dataset.date = dateStr;
    
    dayEl.addEventListener('click', () => showVacationDetails(dateStr));
  }

  return dayEl;
}

// 휴가 데이터로 달력 업데이트
function updateCalendarWithVacations() {
  const dayElements = document.querySelectorAll('.calendar-day:not(.other-month)');
  
  dayElements.forEach(dayEl => {
    const dateStr = dayEl.dataset.date;
    if (!dateStr) return;

    const dayData = vacationData.find(v => v.date === dateStr);
    
    if (dayData && dayData.count > 0) {
      dayEl.classList.add('has-vacation');
      
      // 휴가자 수 표시
      const countBadge = document.createElement('div');
      countBadge.className = 'vacation-count';
      countBadge.textContent = `🏖️ ${dayData.count}명`;
      dayEl.appendChild(countBadge);
    }
  });
}

// 휴가 상세 정보 표시
function showVacationDetails(dateStr) {
  const dayData = vacationData.find(v => v.date === dateStr);
  
  if (!dayData || dayData.count === 0) {
    alert('해당 날짜에 휴가자가 없습니다.');
    return;
  }

  const dateObj = new Date(dateStr);
  const formattedDate = `${dateObj.getFullYear()}년 ${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일`;
  
  selectedDateEl.textContent = `${formattedDate} - 휴가자 ${dayData.count}명`;
  
  vacationListEl.innerHTML = '';
  
  dayData.vacationers.forEach(vacationer => {
    const item = document.createElement('div');
    item.className = 'vacation-item';
    
    const vacationTypeText = vacationer.vacationType || '휴가';
    const periodText = `${vacationer.startDate} ~ ${vacationer.endDate}`;
    const reasonText = vacationer.reason ? `사유: ${vacationer.reason}` : '';
    
    item.innerHTML = `
      <h4>${vacationer.employeeName} (${vacationer.employeeNumber})</h4>
      <span class="vacation-type">${vacationTypeText}</span>
      <p><strong>기간:</strong> ${periodText}</p>
      ${vacationer.employeeEmail ? `<p><strong>이메일:</strong> ${vacationer.employeeEmail}</p>` : ''}
      ${reasonText ? `<p>${reasonText}</p>` : ''}
    `;
    
    vacationListEl.appendChild(item);
  });
  
  vacationDetailsEl.style.display = 'block';
}
