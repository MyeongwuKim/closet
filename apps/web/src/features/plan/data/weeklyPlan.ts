import type { WardrobeItem, WearFeeling } from '@closet/types'

export interface PlanEntry {
  date: string
  dayLabel: string
  dayNumber: number
  title: string
  occasion: string
  weather: string
  itemIds: string[]
  /** 날짜 코디에 연결된 옷의 표시 정보. 삭제된 옷도 현재 옷장 목록과 별개로 유지한다. */
  outfitItems?: WardrobeItem[]
  outfitId?: string
  /** 이 날짜에 실제 입었다고 확인한 시각. 미확인 일정과 편집 중 코디는 null 또는 undefined다. */
  wornAt?: string | null
  /** 착용 완료한 코디에 남긴 온도 체감. 착용 취소·코디 변경 시 함께 비운다. */
  wearFeeling?: WearFeeling | null
  outfitStyle?: string
  plannerOnly?: boolean
  /** 이 날짜에 저장한 이미지 번호. 같은 옷 조합의 공용 생성 결과와 독립적으로 유지한다. */
  previewImageAssetId?: string
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

/** 지정한 날짜에 저장된 코디가 없을 때 화면에 표시할 빈 플래너 항목을 만든다. */
export function createEmptyPlanEntry(dateValue: string): PlanEntry {
  const date = new Date(`${dateValue}T00:00:00`)

  return {
    date: dateValue,
    dayLabel: new Intl.DateTimeFormat('ko-KR', { weekday: 'short' })
      .format(date)
      .replace('요일', ''),
    dayNumber: date.getDate(),
    title: '',
    occasion: '',
    weather: '',
    itemIds: [],
  }
}

export function createEmptyWeeklyPlan(weekStartsOn = getCurrentWeekStart()) {
  const start = new Date(`${weekStartsOn}T00:00:00`)

  return Array.from({ length: 7 }, (_, index): PlanEntry => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return createEmptyPlanEntry(formatDateOnly(date))
  })
}

export function mergeWeeklyPlanEntries(
  weekStartsOn: string,
  entries: PlanEntry[],
) {
  const entryByDate = new Map(entries.map((entry) => [entry.date, entry]))

  return createEmptyWeeklyPlan(weekStartsOn).map(
    (emptyEntry) => entryByDate.get(emptyEntry.date) ?? emptyEntry,
  )
}

function getOutfitFields(entry: PlanEntry) {
  return {
    title: entry.title,
    itemIds: entry.itemIds,
    outfitItems: entry.outfitItems,
    outfitId: entry.outfitId,
    outfitStyle: entry.outfitStyle,
    plannerOnly: entry.plannerOnly,
    previewImageAssetId: entry.previewImageAssetId,
    previewImageUrl: entry.previewImageUrl,
  }
}

export function placePlanOutfitInDate(
  dateEntry: PlanEntry,
  outfitEntry: PlanEntry,
) {
  return {
    ...dateEntry,
    ...getOutfitFields(outfitEntry),
    wornAt: dateEntry.outfitId === outfitEntry.outfitId ? dateEntry.wornAt : null,
    wearFeeling: dateEntry.outfitId === outfitEntry.outfitId && dateEntry.wornAt ? dateEntry.wearFeeling : null,
  }
}

export function moveArrayItem<T>(
  items: T[],
  fromIndex: number,
  toIndex: number,
) {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items
  }

  const nextItems = [...items]
  const [movedItem] = nextItems.splice(fromIndex, 1)
  if (movedItem === undefined) return items
  nextItems.splice(toIndex, 0, movedItem)
  return nextItems
}

export function shouldMovePlanRow(
  dragIndex: number,
  hoverIndex: number,
  pointerOffsetY: number,
  rowHeight: number,
) {
  if (dragIndex === hoverIndex || rowHeight <= 0) return false

  const rowMiddleY = rowHeight / 2
  return dragIndex < hoverIndex
    ? pointerOffsetY >= rowMiddleY
    : pointerOffsetY <= rowMiddleY
}

export function moveWeeklyPlanOutfits(
  entries: PlanEntry[],
  sourceDate: string,
  targetDate: string,
) {
  if (sourceDate === targetDate) return entries

  const sourceIndex = entries.findIndex((entry) => entry.date === sourceDate)
  const targetIndex = entries.findIndex((entry) => entry.date === targetDate)
  if (sourceIndex < 0 || targetIndex < 0 || !entries[sourceIndex]?.outfitId) {
    return entries
  }

  const movedOutfits = moveArrayItem(
    entries.map(getOutfitFields),
    sourceIndex,
    targetIndex,
  )

  return entries.map((entry, index) => ({
    ...entry,
    ...movedOutfits[index],
    wornAt: entry.outfitId === movedOutfits[index]?.outfitId ? entry.wornAt : null,
    wearFeeling: entry.outfitId === movedOutfits[index]?.outfitId && entry.wornAt ? entry.wearFeeling : null,
  }))
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
