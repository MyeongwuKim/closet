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
import { PlanDayRow } from '../components/PlanDayRow'
import { PlanMonthCalendar } from '../components/PlanMonthCalendar'
import { PlanPageHeader } from '../components/PlanPageHeader'
import { PlanPeriodHeader } from '../components/PlanPeriodHeader'
import { PlanViewToggle } from '../components/PlanViewToggle'
import { WeeklyPlanEditor } from '../components/WeeklyPlanEditor'
import { TodayOutfitRecommendationCard } from '../components/TodayOutfitRecommendationCard'
import {
  usePlannerEntriesQuery,
  usePlannerWeekQuery,
  useMovePlannerEntryMutation,
} from '../api/plannerQueries'
import {
  createMonthCalendar,
  formatDateOnly,
  formatMonthKey,
  getCurrentWeekStart,
  moveArrayItem,
  moveWeeklyPlanOutfits,
  type PlanEntry,
} from '../data/weeklyPlan'
import { usePlanStore } from '../stores/usePlanStore'

const weeklyPlanDndOptions = {
  enableMouseEvents: true,
  delayTouchStart: 90,
  delayMouseStart: 0,
  touchSlop: 5,
  ignoreContextMenu: true,
}

interface DisplayPlanRow {
  key: string
  entry: PlanEntry
}

function createDisplayRows(entries: PlanEntry[]): DisplayPlanRow[] {
  return entries.map((entry) => ({ key: entry.date, entry }))
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
  const displayRowsRef = useRef(displayRows)
  const dragStartRowsRef = useRef(displayRows)
  const isDraggingRowRef = useRef(false)
  const rowListRef = useRef<HTMLDivElement>(null)
  const previousRowRectsRef = useRef<Map<string, DOMRect>>(new Map())
  const displayWeekStartRef = useRef(entries[0]?.date ?? '')
  const [isEditingWeek, setIsEditingWeek] = useState(false)
  const [transitionDirection, setTransitionDirection] = useState<
    'backward' | 'forward' | 'switch'
  >('switch')
  const today = formatDateOnly(new Date())
  const viewMode = searchParams.get('view') === 'month' ? 'month' : 'week'
  const weekStartsOn = entries[0]?.date ?? ''
  const isCurrentWeek = weekStartsOn === getCurrentWeekStart()
  const todayEntry = entries.find((entry) => entry.date === today)
  const showTodayRecommendation = viewMode === 'week' && isCurrentWeek
  const requestedMonth = searchParams.get('month')
  const monthKey = /^\d{4}-\d{2}$/.test(requestedMonth ?? '')
    ? (requestedMonth as string)
    : formatMonthKey(new Date())
  const monthDays = createMonthCalendar(monthKey)
  const monthRangeStart = monthDays[0]?.date ?? ''
  const monthRangeEnd = monthDays.at(-1)?.date ?? ''
  const plannerWeekQuery = usePlannerWeekQuery(
    weekStartsOn,
    viewMode === 'week',
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
    displayRowsRef.current = displayRows
  }, [displayRows])

  useEffect(() => {
    if (isDraggingRowRef.current) return

    const nextWeekStart = entries[0]?.date ?? ''
    if (displayWeekStartRef.current !== nextWeekStart) {
      displayWeekStartRef.current = nextWeekStart
      setDisplayRows(createDisplayRows(entries))
      return
    }

    setDisplayRows((current) =>
      current.length === entries.length
        ? current.map((row, index) => ({ ...row, entry: entries[index]! }))
        : createDisplayRows(entries),
    )
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

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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
    dragStartRowsRef.current = displayRowsRef.current
  }, [])

  const moveRowPreview = useCallback((fromIndex: number, toIndex: number) => {
    setDisplayRows((current) => moveArrayItem(current, fromIndex, toIndex))
  }, [])

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
        movePlannerEntry.isPending
      ) {
        setDisplayRows(dragStartRowsRef.current)
        return
      }

      const movedEntries = moveWeeklyPlanOutfits(
        entries,
        source.date,
        target.date,
      )
      setDisplayRows((current) =>
        current.map((row, index) => ({
          ...row,
          entry: movedEntries[index]!,
        })),
      )

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
        .catch(() => {
          setDisplayRows(dragStartRowsRef.current)
          pushToast('코디 위치를 바꾸지 못했어요. 다시 시도해주세요.', 'error')
        })
    },
    [entries, movePlannerEntry, pushToast, weekStartsOn],
  )

  const moveWeek = (dayOffset: number) => {
    setTransitionDirection(dayOffset < 0 ? 'backward' : 'forward')
    const nextWeek = new Date(`${weekStartsOn}T00:00:00`)
    nextWeek.setDate(nextWeek.getDate() + dayOffset)
    setWeek(formatDateOnly(nextWeek))
  }

  const moveMonth = (monthOffset: number) => {
    setTransitionDirection(monthOffset < 0 ? 'backward' : 'forward')
    const nextMonth = new Date(`${monthKey}-01T00:00:00`)
    nextMonth.setMonth(nextMonth.getMonth() + monthOffset)
    setSearchParams({ view: 'month', month: formatMonthKey(nextMonth) })
  }

  const changeViewMode = (nextMode: 'week' | 'month') => {
    if (nextMode === viewMode) return
    setTransitionDirection('switch')

    if (nextMode === 'month') {
      const referenceDate = weekStartsOn
        ? new Date(`${weekStartsOn}T00:00:00`)
        : new Date()
      setSearchParams({ view: 'month', month: formatMonthKey(referenceDate) })
      return
    }

    const monthDate = new Date(`${monthKey}-01T00:00:00`)
    const todayDate = new Date(`${today}T00:00:00`)
    const referenceDate =
      formatMonthKey(todayDate) === monthKey ? todayDate : monthDate
    setWeek(getCurrentWeekStart(referenceDate))
    setSearchParams({})
  }

  const openWeekEditor = () => {
    if (viewMode === 'month') {
      changeViewMode('week')
      return
    }
    setIsEditingWeek(true)
  }

  const periodTransitionClass =
    transitionDirection === 'backward'
      ? 'plan-period-backward-enter'
      : transitionDirection === 'forward'
        ? 'plan-period-forward-enter'
        : 'plan-view-switch-enter'
  const periodTransitionKey =
    viewMode === 'week' ? `week-${weekStartsOn}` : `month-${monthKey}`

  return (
    <section
      className={`mx-auto max-w-3xl ${
        viewMode === 'week'
          ? 'flex h-[calc(100dvh-6.625rem-env(safe-area-inset-bottom))] flex-col sm:block sm:h-auto'
          : ''
      }`}
    >
      <PlanPageHeader viewMode={viewMode} onEditWeek={openWeekEditor} />
      {showTodayRecommendation && (
        <TodayOutfitRecommendationCard
          date={today}
          hasTodayOutfit={Boolean(todayEntry?.itemIds.length)}
        />
      )}
      <PlanViewToggle value={viewMode} onChange={changeViewMode} />
      <div
        key={periodTransitionKey}
        className={`${periodTransitionClass} ${
          viewMode === 'week' ? 'flex min-h-0 flex-1 flex-col' : ''
        }`}
      >
        <PlanPeriodHeader
          viewMode={viewMode}
          anchorDate={viewMode === 'week' ? weekStartsOn : `${monthKey}-01`}
          onPrevious={() =>
            viewMode === 'week' ? moveWeek(-7) : moveMonth(-1)
          }
          onNext={() => (viewMode === 'week' ? moveWeek(7) : moveMonth(1))}
        />

        {viewMode === 'week' ? (
          <DndProvider backend={TouchBackend} options={weeklyPlanDndOptions}>
            <div
              ref={rowListRef}
              className="mt-2 grid min-h-0 flex-1 grid-rows-7 gap-1.5 sm:mt-4 sm:flex-none sm:grid-rows-none sm:gap-3"
            >
              {displayRows.map((row, index) => (
                <div data-plan-row-key={row.key} key={row.key}>
                  <PlanDayRow
                    entry={row.entry}
                    index={index}
                    items={row.entry.itemIds
                      .map((itemId) => items.find((item) => item.id === itemId))
                      .filter((item) => item !== undefined)}
                    isToday={row.entry.date === today}
                    disabled={movePlannerEntry.isPending}
                    onDragStart={startRowDrag}
                    onMovePreview={moveRowPreview}
                    onDragEnd={finishRowDrag}
                  />
                </div>
              ))}
            </div>
          </DndProvider>
        ) : plannerEntriesQuery.isError ? (
          <div className="mt-4 rounded-3xl border border-dashed border-line px-6 py-12 text-center">
            <h2 className="text-sm font-black">
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
        ) : plannerEntriesQuery.isLoading ? (
          <div className="mt-4 flex min-h-80 items-center justify-center rounded-3xl border border-line bg-surface text-sm font-bold text-muted">
            월간 플래너를 불러오는 중...
          </div>
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

      {isEditingWeek && (
        <WeeklyPlanEditor onClose={() => setIsEditingWeek(false)} />
      )}
    </section>
  )
}
