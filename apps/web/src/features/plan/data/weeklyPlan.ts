export interface PlanEntry {
  date: string
  dayLabel: string
  dayNumber: number
  title: string
  occasion: string
  weather: string
  itemIds: string[]
  outfitId?: string
  plannerOnly?: boolean
  previewImageUrl?: string
}

export function formatDateOnly(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatMonthKey(date: Date) {
  return formatDateOnly(date).slice(0, 7)
}

export function getCurrentWeekStart(date = new Date()) {
  const weekStart = new Date(date)
  const mondayOffset = (weekStart.getDay() + 6) % 7
  weekStart.setDate(weekStart.getDate() - mondayOffset)
  weekStart.setHours(0, 0, 0, 0)
  return formatDateOnly(weekStart)
}

export function createEmptyWeeklyPlan(weekStartsOn = getCurrentWeekStart()) {
  const start = new Date(`${weekStartsOn}T00:00:00`)

  return Array.from({ length: 7 }, (_, index): PlanEntry => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)

    return {
      date: formatDateOnly(date),
      dayLabel: new Intl.DateTimeFormat('ko-KR', { weekday: 'short' })
        .format(date)
        .replace('요일', ''),
      dayNumber: date.getDate(),
      title: '',
      occasion: '',
      weather: '',
      itemIds: [],
    }
  })
}

export interface MonthCalendarDay {
  date: string
  dayNumber: number
  isCurrentMonth: boolean
}

export function createMonthCalendar(monthKey: string) {
  const monthStart = new Date(`${monthKey}-01T00:00:00`)
  const gridStart = new Date(monthStart)
  gridStart.setDate(monthStart.getDate() - ((monthStart.getDay() + 6) % 7))

  const monthEnd = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
  )
  const gridEnd = new Date(monthEnd)
  gridEnd.setDate(monthEnd.getDate() + (6 - ((monthEnd.getDay() + 6) % 7)))

  const dayCount =
    Math.round(
      (gridEnd.getTime() - gridStart.getTime()) / (24 * 60 * 60 * 1000),
    ) + 1

  return Array.from({ length: dayCount }, (_, index): MonthCalendarDay => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return {
      date: formatDateOnly(date),
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === monthStart.getMonth(),
    }
  })
}
