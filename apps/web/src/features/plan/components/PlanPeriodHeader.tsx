import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PlanViewMode } from './PlanViewToggle'

interface PlanPeriodHeaderProps {
  viewMode: PlanViewMode
  anchorDate: string
  onPrevious: () => void
  onNext: () => void
}

/** 보기별 날짜와 이전·다음 이동 버튼을 표시한다. 하루 보기에서는 날짜와 요일을 한 줄에 모아 코디 영역의 공간을 확보한다. */
export function PlanPeriodHeader({
  viewMode,
  anchorDate,
  onPrevious,
  onNext,
}: PlanPeriodHeaderProps) {
  const start = new Date(`${anchorDate}T00:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const title = new Intl.DateTimeFormat('ko-KR', viewMode === 'today'
    ? { month: 'long', day: 'numeric', weekday: 'long' }
    : { year: 'numeric', month: 'long' },
  ).format(start)
  const period =
    viewMode === 'week'
      ? `${start.getMonth() + 1}월 ${start.getDate()}일–${
          end.getMonth() + 1
        }월 ${end.getDate()}일`
      : '한 달의 코디 계획과 빈 날짜를 한눈에 확인해보세요.'
  const unitLabel =
    viewMode === 'today' ? '날짜' : viewMode === 'week' ? '주' : '달'

  return (
    <div className="plan-period-header mt-4 flex items-center justify-between gap-3 pb-1 sm:mt-6 sm:items-end sm:gap-4">
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold tracking-[-0.04em] sm:text-2xl">
          {title}
        </h2>
        {viewMode !== 'today' && <p className="mt-0.5 truncate text-xs text-muted sm:mt-2 sm:text-sm">
          {period}
        </p>}
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
