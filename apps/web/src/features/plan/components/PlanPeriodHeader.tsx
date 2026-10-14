import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatPlanPeriodLabel } from '../utils/formatPlanPeriodLabel'
import type { PlanViewMode } from './PlanViewToggle'

interface PlanPeriodHeaderProps {
  viewMode: PlanViewMode
  anchorDate: string
  onPrevious: () => void
  onNext: () => void
}

/** 플래너의 하루·주·월 기간을 작은 연도 라벨과 큰 날짜 숫자로 표시하고, 기간별 이전·다음 이동을 부모에 요청한다. */
export function PlanPeriodHeader({
  viewMode,
  anchorDate,
  onPrevious,
  onNext,
}: PlanPeriodHeaderProps) {
  const start = new Date(`${anchorDate}T00:00:00`)
  const period = formatPlanPeriodLabel(viewMode, start)
  const unitLabel =
    viewMode === 'today' ? '날짜' : viewMode === 'week' ? '주' : '달'

  return (
    <div className="plan-period-header mt-4 flex items-center justify-between gap-3 pb-1 sm:mt-6 sm:gap-4">
      <div className="min-w-0">
        <p className="text-[11px] font-medium leading-4 text-muted sm:text-xs">
          {period.eyebrow}
        </p>
        <div className="w-fit max-w-full">
          <h2
            aria-label={period.accessibleLabel}
            className={`plan-period-title mt-0.5 flex items-baseline whitespace-nowrap font-editorial text-[27px] leading-8 tracking-[-0.05em] sm:text-3xl sm:leading-9 ${period.endNumber ? 'gap-1.5' : 'gap-0'}`}
          >
            <span>{period.startNumber}</span>
            {period.endNumber && (
              <>
                <span aria-hidden="true" className="font-sans text-xl font-normal tracking-normal text-accent">—</span>
                <span>{period.endNumber}</span>
              </>
            )}
            {period.unit && (
              <span className="ml-0.5 font-sans text-base font-medium tracking-normal sm:text-lg">
                {period.unit}
              </span>
            )}
          </h2>
          {period.startCaption && (
            <p className="mt-0.5 flex justify-between text-[11px] leading-4 text-muted sm:text-xs">
              <span>{period.startCaption}</span>
              {period.endCaption && <span>{period.endCaption}</span>}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onPrevious}
          className="flex size-11 items-center justify-center rounded-full border border-line bg-surface hover:border-accent"
          aria-label={`이전 ${unitLabel}`}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex size-11 items-center justify-center rounded-full border border-line bg-surface hover:border-accent"
          aria-label={`다음 ${unitLabel}`}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
