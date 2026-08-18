import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useClosetStore } from '../../closet/stores/useClosetStore'
import { PlanDayRow } from '../components/PlanDayRow'
import { PlanMonthCalendar } from '../components/PlanMonthCalendar'
import { PlanPageHeader } from '../components/PlanPageHeader'
import { PlanPeriodHeader } from '../components/PlanPeriodHeader'
import { PlanViewToggle } from '../components/PlanViewToggle'
import { WeeklyPlanEditor } from '../components/WeeklyPlanEditor'
import {
  usePlannerEntriesQuery,
  usePlannerWeekQuery,
} from '../api/plannerQueries'
import {
  createMonthCalendar,
  formatDateOnly,
  formatMonthKey,
  getCurrentWeekStart,
} from '../data/weeklyPlan'
import { usePlanStore } from '../stores/usePlanStore'

export function PlanPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const items = useClosetStore((state) => state.items)
  const entries = usePlanStore((state) => state.entries)
  const setWeek = usePlanStore((state) => state.setWeek)
  const hydrateEntries = usePlanStore((state) => state.hydrateEntries)
  const [isEditingWeek, setIsEditingWeek] = useState(false)
  const [transitionDirection, setTransitionDirection] = useState<
    'backward' | 'forward' | 'switch'
  >('switch')
  const today = formatDateOnly(new Date())
  const viewMode = searchParams.get('view') === 'month' ? 'month' : 'week'
  const weekStartsOn = entries[0]?.date ?? ''
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
          <div className="mt-2 grid min-h-0 flex-1 grid-rows-7 gap-1.5 sm:mt-4 sm:flex-none sm:grid-rows-none sm:gap-3">
            {entries.map((entry) => (
              <PlanDayRow
                entry={entry}
                items={entry.itemIds
                  .map((itemId) => items.find((item) => item.id === itemId))
                  .filter((item) => item !== undefined)}
                isToday={entry.date === today}
                key={entry.date}
              />
            ))}
          </div>
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
