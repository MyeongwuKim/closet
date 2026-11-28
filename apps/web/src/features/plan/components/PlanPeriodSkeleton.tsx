interface PlanPeriodSkeletonProps {
  viewMode: 'today' | 'week' | 'month'
  monthWeekCount?: number
}

function PlanTodaySkeleton() {
  return (
    <div className="plan-today-card plan-today-skeleton flex min-h-0 flex-1 animate-pulse flex-col items-center justify-center gap-3 rounded-3xl border border-line bg-surface p-5" aria-hidden="true">
      <span className="plan-today-empty-icon size-12 shrink-0 rounded-2xl bg-sage" />
      <span className="h-5 w-44 shrink-0 rounded-full bg-line/50" />
      <span className="plan-today-empty-description h-3 w-32 shrink-0 rounded-full bg-line/30" />
      <span className="mt-2 h-11 w-28 shrink-0 rounded-full bg-sage" />
    </div>
  )
}

function PlanWeekSkeleton() {
  return (
    <div className="plan-week-rows animate-pulse">
      {Array.from({ length: 7 }, (_, index) => (
        <div
          className="plan-week-row-body rounded-2xl border border-line/70 bg-surface"
          aria-hidden="true"
          key={index}
        >
          <span className="mx-auto block size-7 rounded-full bg-line/45 sm:size-9" />
          <span className="hidden min-w-0 sm:block">
            <span className="block h-3.5 w-2/3 rounded-full bg-line/55" />
            <span className="mt-2 block h-3 w-1/2 rounded-full bg-line/30" />
          </span>
          <span className="plan-week-thumbnails">
            <span className="aspect-square rounded-lg bg-line/35" />
            <span className="aspect-square rounded-lg bg-line/25" />
            <span className="aspect-square rounded-lg bg-line/20" />
            <span className="aspect-square rounded-lg bg-line/20" />
          </span>
          <span className="block size-3 rounded-full bg-line/45" />
        </div>
      ))}
    </div>
  )
}

function PlanMonthSkeleton({ weekCount }: { weekCount: number }) {
  return (
    <section className="plan-month-calendar animate-pulse overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="grid grid-cols-7 border-b border-line bg-canvas/70">
        {Array.from({ length: 7 }, (_, index) => (
          <span
            className="mx-auto my-[9px] block h-2.5 w-4 rounded-full bg-line/50"
            aria-hidden="true"
            key={index}
          />
        ))}
      </div>

      <div className="plan-month-calendar-days grid grid-cols-7"
        style={{ gridTemplateRows: `repeat(${weekCount}, minmax(var(--plan-month-row-min), 1fr))` }}>
        {Array.from({ length: weekCount * 7 }, (_, index) => (
          <div
            className={`plan-month-calendar-day ${
              index % 7 !== 6 ? 'border-r border-line' : ''
            } ${index >= 7 ? 'border-t border-line' : ''}`}
            aria-hidden="true"
            key={index}
          >
            <span className="plan-month-calendar-date shrink-0 rounded-full bg-line/45" />
            {index % 3 !== 1 && (
              <span className="plan-month-calendar-preview rounded-md bg-line/25" />
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

/** 선택한 플래너 보기와 같은 카드 구조를 유지하며 조회 중 상태를 표시한다. */
export function PlanPeriodSkeleton({ viewMode, monthWeekCount = 6 }: PlanPeriodSkeletonProps) {
  const loadingLabel =
    viewMode === 'today'
      ? '하루 플래너를 불러오는 중'
      : viewMode === 'week'
      ? '주간 플래너를 불러오는 중'
      : '월간 플래너를 불러오는 중'

  return (
    <div
      role="status"
      aria-label={loadingLabel}
      className={`flex flex-1 flex-col${viewMode === 'today' ? ' min-h-0' : ''}`}
    >
      <span className="sr-only">{loadingLabel}</span>
      {viewMode === 'today' ? (
        <PlanTodaySkeleton />
      ) : viewMode === 'week' ? (
        <PlanWeekSkeleton />
      ) : (
        <PlanMonthSkeleton weekCount={monthWeekCount} />
      )}
    </div>
  )
}
