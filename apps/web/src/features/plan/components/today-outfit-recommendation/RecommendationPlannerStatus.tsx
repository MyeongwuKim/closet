import { CalendarDays, LoaderCircle, RefreshCw } from 'lucide-react'

interface RecommendationPlannerStatusProps {
  isError: boolean
  isRetrying: boolean
  onRetry: () => void
}

export function RecommendationPlannerStatus({
  isError,
  isRetrying,
  onRetry,
}: RecommendationPlannerStatusProps) {
  return (
    <section className="flex h-full flex-col items-center justify-center rounded-2xl border border-line bg-surface p-5 text-center">
      {isError ? (
        <CalendarDays className="text-muted" size={24} />
      ) : (
        <LoaderCircle className="animate-spin text-accent" size={24} />
      )}
      <p className="mt-3 text-sm font-black" role={isError ? 'alert' : 'status'}>
        {isError ? '오늘 일정을 불러오지 못했어요' : '오늘 일정을 확인하고 있어요'}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted">
        등록된 코디가 있는지 확인한 뒤 추천을 보여드릴게요.
      </p>
      {isError && (
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-xs font-bold disabled:opacity-50"
        >
          <RefreshCw className={isRetrying ? 'animate-spin' : ''} size={14} />
          다시 시도
        </button>
      )}
    </section>
  )
}
