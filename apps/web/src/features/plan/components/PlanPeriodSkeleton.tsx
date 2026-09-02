interface PlanPeriodSkeletonProps {
  viewMode: 'week' | 'month'
}

function PlanWeekSkeleton() {
  return (
    <div className="mt-2 grid min-h-0 flex-1 animate-pulse grid-rows-7 gap-2 pb-2 sm:mt-4 sm:flex-none sm:grid-rows-none sm:gap-3 sm:pb-0">
      {Array.from({ length: 7 }, (_, index) => (
        <div
          className="grid h-full min-h-11 grid-cols-[38px_minmax(0,1fr)_16px] items-center gap-2 rounded-xl border border-line/70 bg-surface py-1.5 pr-4 pl-2 sm:min-h-23 sm:grid-cols-[58px_minmax(220px,0.85fr)_minmax(180px,1fr)_auto] sm:gap-3 sm:rounded-2xl sm:p-4"
          aria-hidden="true"
          key={index}
        >
          <span className="mx-auto block size-7 rounded-full bg-line/45 sm:size-9" />
          <span className="hidden min-w-0 sm:block">
            <span className="block h-3.5 w-2/3 rounded-full bg-line/55" />
            <span className="mt-2 block h-3 w-1/2 rounded-full bg-line/30" />
          </span>
          <span className="flex min-w-0 items-center justify-end gap-1.5 sm:justify-start">
            <span className="size-8 rounded-lg bg-line/35 sm:size-12 sm:rounded-xl" />
            <span className="hidden size-12 rounded-xl bg-line/25 sm:block" />
            <span className="hidden size-12 rounded-xl bg-line/20 sm:block" />
          </span>
          <span className="block size-3 rounded-full bg-line/45" />
        </div>
      ))}
    </div>
  )
}

function PlanMonthSkeleton() {
  return (
    <section className="mt-4 animate-pulse overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="grid grid-cols-7 border-b border-line bg-canvas/70">
        {Array.from({ length: 7 }, (_, index) => (
          <span
            className="mx-auto my-3 block h-2.5 w-4 rounded-full bg-line/50"
            aria-hidden="true"
            key={index}
          />
        ))}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: 42 }, (_, index) => (
          <div
            className={`min-h-20 min-w-0 p-1.5 sm:min-h-32 sm:p-2.5 ${
              index % 7 !== 6 ? 'border-r border-line' : ''
            } ${index >= 7 ? 'border-t border-line' : ''}`}
            aria-hidden="true"
            key={index}
          >
            <span className="block size-6 rounded-full bg-line/45 sm:size-7" />
            {index % 3 !== 1 && (
              <span className="mt-1 block h-10 rounded-lg bg-line/25 sm:h-16 sm:rounded-xl" />
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export function PlanPeriodSkeleton({ viewMode }: PlanPeriodSkeletonProps) {
  const loadingLabel =
    viewMode === 'week'
      ? '주간 플래너를 불러오는 중'
      : '월간 플래너를 불러오는 중'

  return (
    <div
      role="status"
      aria-label={loadingLabel}
      className={
        viewMode === 'week' ? 'flex min-h-0 flex-1 flex-col' : undefined
      }
    >
      <span className="sr-only">{loadingLabel}</span>
      {viewMode === 'week' ? <PlanWeekSkeleton /> : <PlanMonthSkeleton />}
    </div>
  )
}
