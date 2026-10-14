import type { PlanViewMode } from '../components/PlanViewToggle'

export interface PlanPeriodLabel {
  eyebrow: string
  startNumber: string
  endNumber?: string
  unit?: string
  startCaption?: string
  endCaption?: string
  accessibleLabel: string
}

const weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
const viewLabels: Record<PlanViewMode, string> = {
  today: '하루 플래너',
  week: '주간 플래너',
  month: '월간 플래너',
}

function numericDate(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

/** 하루·주간·월간의 표시 날짜를 같은 숫자 중심 구조로 만든다. 주간 끝 날짜는 현지 달력 기준 6일 뒤이며 입력 날짜는 변경하지 않는다. */
export function formatPlanPeriodLabel(viewMode: PlanViewMode, start: Date): PlanPeriodLabel {
  const startYear = start.getFullYear()
  const startMonth = start.getMonth() + 1
  const startDay = start.getDate()

  if (viewMode === 'today') {
    return {
      eyebrow: `${startYear}년 · ${viewLabels.today}`,
      startNumber: numericDate(start),
      startCaption: weekdays[start.getDay()],
      accessibleLabel: `${startYear}년 ${startMonth}월 ${startDay}일 ${weekdays[start.getDay()]}`,
    }
  }

  if (viewMode === 'month') {
    return {
      eyebrow: `${startYear}년 · ${viewLabels.month}`,
      startNumber: String(startMonth),
      unit: '월',
      accessibleLabel: `${startYear}년 ${startMonth}월`,
    }
  }

  const end = new Date(start)
  end.setDate(startDay + 6)
  const endYear = end.getFullYear()
  const endMonth = end.getMonth() + 1
  const endDay = end.getDate()
  const yearLabel = startYear === endYear ? `${startYear}년` : `${startYear}–${endYear}년`

  return {
    eyebrow: `${yearLabel} · ${viewLabels.week}`,
    startNumber: numericDate(start),
    endNumber: numericDate(end),
    startCaption: weekdays[start.getDay()],
    endCaption: weekdays[end.getDay()],
    accessibleLabel: `${startYear}년 ${startMonth}월 ${startDay}일 – ${endYear}년 ${endMonth}월 ${endDay}일`,
  }
}
