import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PlanPeriodHeaderProps {
  viewMode: 'week' | 'month'
  anchorDate: string
  onPrevious: () => void
  onNext: () => void
}

export function PlanPeriodHeader({
  viewMode,
  anchorDate,
  onPrevious,
  onNext,
}: PlanPeriodHeaderProps) {
  const start = new Date(`${anchorDate}T00:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const title = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
  }).format(start)
  const period =
    viewMode === 'week'
      ? `${start.getMonth() + 1}월 ${start.getDate()}일–${
          end.getMonth() + 1
        }월 ${end.getDate()}일`
      : '한 달의 코디 계획과 빈 날짜를 한눈에 확인해보세요.'
  const unitLabel = viewMode === 'week' ? '주' : '달'

  return (
    <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5 sm:mt-6 sm:items-end sm:gap-4 sm:rounded-3xl sm:p-6">
      <div className="min-w-0">
        <h2 className="truncate text-lg font-black tracking-[-0.04em] sm:text-3xl">
          {title}
        </h2>
        <p className="mt-0.5 truncate text-xs text-muted sm:mt-2 sm:text-sm">
          {period}
        </p>
      </div>

      <div className="flex shrink-0 gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onPrevious}
          className="flex size-8 items-center justify-center rounded-full border border-line bg-surface hover:border-ink sm:size-10"
          aria-label={`이전 ${unitLabel}`}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex size-8 items-center justify-center rounded-full border border-line bg-surface hover:border-ink sm:size-10"
          aria-label={`다음 ${unitLabel}`}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
