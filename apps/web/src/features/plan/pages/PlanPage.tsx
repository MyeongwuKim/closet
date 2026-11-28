/**
 * 진입 경로: 하단 플래너 탭
 *
 * 일간·주간·월간 데이터를 조회하고, 버튼과 본문 스와이프로 기간을 이동한다.
 * 일간 보기는 선택한 날짜의 코디와 내일 예보·추천을 표시한다. 주간 보기는 착용 완료를 보호하며 코디를 옮기고, 월간 보기는 달력 범위를 조회한다.
 * 코디북 선택은 일간이나 주간에서 고른 날짜에 코디를 배정한다.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { DndProvider } from 'react-dnd'
import { TouchBackend } from 'react-dnd-touch-backend'
import { useSearchParams } from 'react-router-dom'
import { useClosetStore } from '../../closet/stores/useClosetStore'
import { useUiStore } from '../../../stores/useUiStore'
import { GraphqlRequestError } from '../../../lib/graphql'
import { PlanDayRow } from '../components/PlanDayRow'
import { PlanDayRowDragLayer } from '../components/PlanDayRowDragLayer'
import { PlanMonthCalendar } from '../components/PlanMonthCalendar'
import { PlanPageHeader } from '../components/PlanPageHeader'
import { PlanPeriodHeader } from '../components/PlanPeriodHeader'
import { PlanPeriodSkeleton } from '../components/PlanPeriodSkeleton'
import { PlanTodayCard } from '../components/PlanTodayCard'
import { PlannerWearReview } from '../components/PlannerWearReview'
import { PlanFutureForecast } from '../components/PlanFutureForecast'
import { PlanViewToggle } from '../components/PlanViewToggle'
import type { PlanViewMode } from '../components/PlanViewToggle'
import { PlannerOutfitPicker } from '../components/PlannerOutfitPicker'
import {
  usePlannerEntriesQuery,
  usePlannerWeekQuery,
  useMovePlannerEntryMutation,
} from '../api/plannerQueries'
import {
  canMoveWeeklyPlanOutfit,
  createMonthCalendar,
  createEmptyPlanEntry,
  formatDateOnly,
  formatMonthKey,
  getCurrentWeekStart,
  moveArrayItem,
  moveWeeklyPlanOutfits,
  placePlanOutfitInDate,
  type PlanEntry,
} from '../data/weeklyPlan'
import { usePlanStore } from '../stores/usePlanStore'
import { usePlannerLocationWeather } from '../hooks/usePlannerLocationWeather'
import { useKoreaPlannerToday } from '../hooks/useKoreaPlannerToday'
import { usePlanPeriodSwipe } from '../hooks/usePlanPeriodSwipe'
import { getKoreaPlannerTomorrow } from '../utils/plannerWear'

const weeklyPlanDndOptions = {
  enableMouseEvents: true,
  delayTouchStart: 150,
  delayMouseStart: 0,
  touchSlop: 8,
  ignoreContextMenu: true,
}

interface DisplayPlanRow {
  key: string
  weekStartsOn: string
  entry: PlanEntry
}

function createDisplayRows(entries: PlanEntry[]): DisplayPlanRow[] {
  const identityCounts = new Map<string, number>()
  const weekStartsOn = entries[0]?.date ?? ''

  return entries.map((entry) => {
    const identity = entry.outfitId ? `outfit-${entry.outfitId}` : 'empty'
    const occurrence = identityCounts.get(identity) ?? 0
    identityCounts.set(identity, occurrence + 1)

    return {
      key: `${identity}-${occurrence}`,
      weekStartsOn,
      entry,
    }
  })
}

export function PlanPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const items = useClosetStore((state) => state.items)
  const entries = usePlanStore((state) => state.entries)
  const setWeek = usePlanStore((state) => state.setWeek)
  const hydrateEntries = usePlanStore((state) => state.hydrateEntries)
  const pushToast = useUiStore((state) => state.pushToast)
  const movePlannerEntry = useMovePlannerEntryMutation()
  const [displayRows, setDisplayRows] = useState(() =>
    createDisplayRows(entries),
  )
  const isDraggingRowRef = useRef(false)
  const rowListRef = useRef<HTMLDivElement>(null)
  const previousRowRectsRef = useRef<Map<string, DOMRect>>(new Map())
  const shouldAnimateRowReorderRef = useRef(false)
  const displayWeekStartRef = useRef(entries[0]?.date ?? '')
  const [outfitPickerView, setOutfitPickerView] = useState<'today' | 'week' | null>(null)
  const [transitionDirection, setTransitionDirection] = useState<
    'backward' | 'forward' | 'switch'
  >('switch')
  const today = useKoreaPlannerToday()
  const requestedView = searchParams.get('view')
  const viewMode: PlanViewMode =
    requestedView === 'week'
      ? 'week'
      : requestedView === 'month'
        ? 'month'
        : 'today'
  const requestedDay = searchParams.get('date')
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDay ?? '')
    ? (requestedDay as string)
    : today
  const isFutureDayView = viewMode === 'today' && selectedDate > today
  const isTomorrow = selectedDate === getKoreaPlannerTomorrow(today)
  const weatherDate = isFutureDayView ? selectedDate : today
  const forecast = usePlannerLocationWeather(weatherDate)
  const weekStartsOn = entries[0]?.date ?? ''
  const requestedMonth = searchParams.get('month')
  const monthKey = /^\d{4}-\d{2}$/.test(requestedMonth ?? '')
    ? (requestedMonth as string)
    : today.slice(0, 7)
  const periodStart = viewMode === 'today' ? selectedDate : viewMode === 'week' ? weekStartsOn : `${monthKey}-01`
  const currentPeriodStart = viewMode === 'today'
    ? today
    : viewMode === 'week'
      ? getCurrentWeekStart(new Date(`${today}T00:00:00`))
      : `${today.slice(0, 7)}-01`
  const monthDays = createMonthCalendar(monthKey)
  const monthRangeStart = monthDays[0]?.date ?? ''
  const monthRangeEnd = monthDays.at(-1)?.date ?? ''
  const plannerWeekQuery = usePlannerWeekQuery(
    weekStartsOn,
    viewMode === 'week',
  )
  const plannerDayQuery = usePlannerEntriesQuery(
    selectedDate,
    selectedDate,
    viewMode === 'today',
  )
  const plannerEntriesQuery = usePlannerEntriesQuery(
    monthRangeStart,
    monthRangeEnd,
    viewMode === 'month',
  )

  useEffect(() => {
    if (plannerWeekQuery.data?.length) {
      hydrateEntries(plannerWeekQuery.data)
    }
  }, [hydrateEntries, plannerWeekQuery.data])

  useEffect(() => {
    if (isDraggingRowRef.current) return

    const nextWeekStart = entries[0]?.date ?? ''
    if (displayWeekStartRef.current !== nextWeekStart) {
      displayWeekStartRef.current = nextWeekStart
      shouldAnimateRowReorderRef.current = false
      previousRowRectsRef.current.clear()
      setDisplayRows(createDisplayRows(entries))
      return
    }

    setDisplayRows(createDisplayRows(entries))
  }, [entries])

  useLayoutEffect(() => {
    const rowElements = rowListRef.current?.querySelectorAll<HTMLElement>(
      '[data-plan-row-key]',
    )
    if (!rowElements) return

    const nextRects = new Map<string, DOMRect>()
    rowElements.forEach((element) => {
      const rowKey = element.dataset.planRowKey
      if (rowKey) nextRects.set(rowKey, element.getBoundingClientRect())
    })

    const shouldAnimateRowReorder = shouldAnimateRowReorderRef.current
    shouldAnimateRowReorderRef.current = false

    if (
      shouldAnimateRowReorder &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      rowElements.forEach((element) => {
        const rowKey = element.dataset.planRowKey
        if (!rowKey) return
        const previousRect = previousRowRectsRef.current.get(rowKey)
        const nextRect = nextRects.get(rowKey)
        if (!previousRect || !nextRect) return

        const offsetY = previousRect.top - nextRect.top
        if (Math.abs(offsetY) < 1) return
        element.getAnimations().forEach((animation) => animation.cancel())
        element.animate(
          [
            { transform: `translateY(${offsetY}px)` },
            { transform: 'translateY(0)' },
          ],
          {
            duration: 240,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          },
        )
      })
    }

    previousRowRectsRef.current = nextRects
  }, [displayRows])

  const startRowDrag = useCallback(() => {
    isDraggingRowRef.current = true
  }, [])

  const moveRowPreview = useCallback((fromIndex: number, toIndex: number) => {
    shouldAnimateRowReorderRef.current = true
    setDisplayRows((current) => moveArrayItem(current, fromIndex, toIndex))
  }, [])

  const restoreDisplayRows = useCallback((nextRows: DisplayPlanRow[]) => {
    setDisplayRows((currentRows) => {
      shouldAnimateRowReorderRef.current = currentRows.some(
        (row, index) => row.key !== nextRows[index]?.key,
      )
      return nextRows
    })
  }, [])

  const canMoveTo = useCallback(
    (sourceIndex: number, targetIndex: number) =>
      canMoveWeeklyPlanOutfit(entries, sourceIndex, targetIndex),
    [entries],
  )

  const finishRowDrag = useCallback(
    (sourceIndex: number, targetIndex: number, didDrop: boolean) => {
      isDraggingRowRef.current = false

      const source = entries[sourceIndex]
      const target = entries[targetIndex]
      if (
        !didDrop ||
        !source?.outfitId ||
        !target ||
        sourceIndex === targetIndex ||
        movePlannerEntry.isPending ||
        !canMoveTo(sourceIndex, targetIndex)
      ) {
        restoreDisplayRows(createDisplayRows(entries))
        return
      }

      const movedEntries = moveWeeklyPlanOutfits(
        entries,
        source.date,
        target.date,
      )
      restoreDisplayRows(createDisplayRows(movedEntries))

      void movePlannerEntry
        .mutateAsync({
          weekStartsOn,
          sourceDate: source.date,
          targetDate: target.date,
        })
        .then(() => {
          pushToast(
            `${source.dayLabel}요일 코디를 ${target.dayLabel}요일로 옮겼어요.`,
            'success',
          )
        })
        .catch((error) => {
          // 다시 조회한 착용 상태가 있으면 드래그 시작 시점의 행으로 덮어쓰지 않는다.
          restoreDisplayRows(createDisplayRows(usePlanStore.getState().entries))
          const message = error instanceof GraphqlRequestError && error.code === 'PLANNER_WEAR_CONFIRMED'
            ? error.message
            : '코디 위치를 바꾸지 못했어요. 다시 시도해주세요.'
          pushToast(message, 'error')
        })
    },
    [canMoveTo, entries, movePlannerEntry, pushToast, restoreDisplayRows, weekStartsOn],
  )

  /** 주간 날짜는 스토어에서, 일간과 월간 날짜는 URL에서 바꾸고 이동 방향을 기록한다. */
  const goToPeriod = (nextStart: string) => {
    if (nextStart === periodStart) return
    setTransitionDirection(nextStart < periodStart ? 'backward' : 'forward')

    if (viewMode === 'week') {
      setWeek(nextStart)
    } else if (viewMode === 'month') {
      setSearchParams({ view: 'month', month: nextStart.slice(0, 7) })
    } else {
      setSearchParams(nextStart === today ? { view: 'today' } : { view: 'today', date: nextStart })
    }
  }

  /** 선택한 보기의 단위로 한 기간 이동한다. 월간 이동은 달의 첫날을 기준으로 계산한다. */
  const movePeriod = (offset: -1 | 1) => {
    const nextStart = new Date(`${periodStart}T00:00:00`)
    if (viewMode === 'month') {
      nextStart.setMonth(nextStart.getMonth() + offset)
    } else {
      nextStart.setDate(nextStart.getDate() + offset * (viewMode === 'week' ? 7 : 1))
    }
    goToPeriod(formatDateOnly(nextStart))
  }
  const periodSwipeHandlers = usePlanPeriodSwipe(movePeriod)

  const changeViewMode = (nextMode: PlanViewMode) => {
    if (nextMode === viewMode) return
    setOutfitPickerView(null)
    setTransitionDirection('switch')

    if (nextMode === 'today') {
      setSearchParams({ view: 'today' })
      return
    }

    if (nextMode === 'month') {
      const referenceDate =
        viewMode === 'week' && weekStartsOn
          ? new Date(`${weekStartsOn}T00:00:00`)
          : viewMode === 'today'
            ? new Date(`${selectedDate}T00:00:00`)
            : new Date()
      setSearchParams({ view: 'month', month: formatMonthKey(referenceDate) })
      return
    }

    const todayDate = new Date(`${today}T00:00:00`)
    const referenceDate =
      viewMode === 'month'
        ? formatMonthKey(todayDate) === monthKey
          ? todayDate
          : new Date(`${monthKey}-01T00:00:00`)
        : viewMode === 'today'
          ? new Date(`${selectedDate}T00:00:00`)
          : todayDate
    setWeek(getCurrentWeekStart(referenceDate))
    setSearchParams({ view: 'week' })
  }

  const periodTransitionClass =
    transitionDirection === 'backward'
      ? 'plan-period-backward-enter'
      : transitionDirection === 'forward'
        ? 'plan-period-forward-enter'
        : 'plan-view-switch-enter'
  const periodTransitionKey =
    viewMode === 'today'
      ? `today-${selectedDate}`
      : viewMode === 'week'
        ? `week-${weekStartsOn}`
        : `month-${monthKey}`
  const currentWeekRows =
    displayRows[0]?.weekStartsOn === weekStartsOn
      ? displayRows
      : createDisplayRows(entries)
  const selectedDayEntry =
    plannerDayQuery.data?.find((entry) => entry.date === selectedDate) ??
    createEmptyPlanEntry(selectedDate)
  const selectedDayItems = selectedDayEntry.itemIds
    .map((itemId) => items.find((item) => item.id === itemId))
    .filter((item) => item !== undefined)

  return (
    <section
      className={`plan-page mx-auto w-full max-w-3xl ${viewMode === 'today' ? 'plan-today-page' : 'plan-overview-page'}`}
      {...periodSwipeHandlers}
    >
      <PlanPageHeader
        weatherDate={weatherDate}
        forecast={forecast}
        forecastLabel={isFutureDayView ? (isTomorrow ? '내일 예보' : '이날 예보') : undefined}
        historyDate={viewMode === 'today' ? selectedDate : undefined}
        onEditWeek={viewMode === 'week' ? () => setOutfitPickerView('week') : undefined}
      />
      <PlanViewToggle value={viewMode} onChange={changeViewMode} />
      <PlanPeriodHeader
        viewMode={viewMode}
        isCurrentPeriod={periodStart === currentPeriodStart}
        anchorDate={periodStart}
        onPrevious={() => movePeriod(-1)}
        onNext={() => movePeriod(1)}
        onCurrentPeriod={() => goToPeriod(currentPeriodStart)}
      />
      <div
        key={periodTransitionKey}
        data-plan-period-body=""
        className={`${periodTransitionClass} ${
          viewMode === 'today' ? 'flex min-h-0 flex-1 flex-col' : 'plan-overview-content'
        } ${isFutureDayView ? 'relative' : ''}`}
      >
        {viewMode === 'today' && selectedDate === today && <PlannerWearReview today={today} />}
        {isFutureDayView && <PlanFutureForecast key={selectedDate} date={selectedDate} forecast={forecast} isTomorrow={isTomorrow} />}
        {viewMode === 'today' && plannerDayQuery.isError ? (
          <div className="mt-4 rounded-3xl border border-dashed border-line px-6 py-12 text-center">
            <h2 className="text-sm font-semibold">
              선택한 날짜의 플래너를 불러오지 못했어요
            </h2>
            <button
              type="button"
              onClick={() => void plannerDayQuery.refetch()}
              className="mt-4 rounded-full bg-ink px-4 py-2 text-xs font-bold text-white"
            >
              다시 불러오기
            </button>
          </div>
        ) : viewMode === 'today' && plannerDayQuery.isPending ? (
          <PlanPeriodSkeleton viewMode="today" />
        ) : viewMode === 'today' ? (
          <>
            <PlanTodayCard
              entry={selectedDayEntry}
              items={selectedDayItems}
              isToday={selectedDate === today}
              onChooseOutfit={() => setOutfitPickerView('today')}
            />
          </>
        ) : viewMode === 'week' && plannerWeekQuery.isPending ? (
          <PlanPeriodSkeleton viewMode="week" />
        ) : viewMode === 'week' ? (
          <DndProvider backend={TouchBackend} options={weeklyPlanDndOptions}>
            <PlanDayRowDragLayer />
            {entries.some((entry) => entry.wornAt) && (
              <p className="plan-week-move-note text-xs text-muted">착용 완료 날짜를 포함한 범위는 옮길 수 없어요.</p>
            )}
            <div
              ref={rowListRef}
              className="plan-week-rows"
            >
              {currentWeekRows.map((row, index) => {
                const dateEntry = entries[index] ?? row.entry
                const displayEntry = placePlanOutfitInDate(
                  dateEntry,
                  row.entry,
                )

                return (
                  <div
                    className="h-full min-h-0"
                    data-plan-row-key={row.key}
                    key={row.key}
                  >
                    <PlanDayRow
                      dragKey={row.key}
                      entry={displayEntry}
                      index={index}
                      items={row.entry.itemIds
                        .map((itemId) =>
                          items.find((item) => item.id === itemId),
                        )
                        .filter((item) => item !== undefined)}
                      isToday={dateEntry.date === today}
                      disabled={movePlannerEntry.isPending}
                      canMoveTo={canMoveTo}
                      onDragStart={startRowDrag}
                      onMovePreview={moveRowPreview}
                      onDragEnd={finishRowDrag}
                    />
                  </div>
                )
              })}
            </div>
          </DndProvider>
        ) : plannerEntriesQuery.isError ? (
          <div className="mt-4 rounded-3xl border border-dashed border-line px-6 py-12 text-center">
            <h2 className="text-sm font-semibold">
              월간 플래너를 불러오지 못했어요
            </h2>
            <button
              type="button"
              onClick={() => void plannerEntriesQuery.refetch()}
              className="mt-4 rounded-full bg-ink px-4 py-2 text-xs font-bold text-white"
            >
              다시 불러오기
            </button>
          </div>
        ) : plannerEntriesQuery.isPending ? (
          <PlanPeriodSkeleton viewMode="month" monthWeekCount={monthDays.length / 7} />
        ) : (
          <PlanMonthCalendar
            days={monthDays}
            entries={plannerEntriesQuery.data ?? []}
            items={items}
            monthKey={monthKey}
            today={today}
          />
        )}
      </div>

      {outfitPickerView === viewMode && (
        <PlannerOutfitPicker
          key={viewMode === 'today' ? selectedDate : weekStartsOn}
          dayEntry={viewMode === 'today' ? selectedDayEntry : undefined}
          onClose={() => setOutfitPickerView(null)}
        />
      )}
    </section>
  )
}
