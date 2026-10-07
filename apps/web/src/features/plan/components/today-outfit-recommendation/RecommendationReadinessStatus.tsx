import { ChevronLeft, LoaderCircle, RefreshCw } from 'lucide-react'

interface RecommendationReadinessStatusProps {
  isLoading: boolean
  errorMessage: string | null
  onRetry: () => void
  onBack: () => void
}

/** 계정·현재 날씨 조회를 기다리고, 실패하면 재시도하거나 계절 선택으로 돌아가게 한다. */
export function RecommendationReadinessStatus({
  isLoading,
  errorMessage,
  onRetry,
  onBack,
}: RecommendationReadinessStatusProps) {
  return (
    <section className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-line bg-surface p-5 text-center">
      {!errorMessage && <LoaderCircle className="animate-spin text-accent" size={24} />}
      <p className="text-sm font-black" role={errorMessage ? 'alert' : 'status'}>
        {errorMessage ?? '추천에 필요한 정보를 확인하고 있어요'}
      </p>
      {errorMessage && (
        <button
          type="button"
          onClick={onRetry}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-xs font-bold disabled:opacity-50"
        >
          <RefreshCw size={14} /> 다시 시도
        </button>
      )}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs font-bold text-muted"
      >
        <ChevronLeft size={13} /> 계절 다시 선택
      </button>
    </section>
  )
}
