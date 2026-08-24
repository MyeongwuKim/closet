import { Sparkles } from 'lucide-react'

export function TodayOutfitRecommendationLoading() {
  return (
    <section
      className="flex h-full flex-col items-center justify-center rounded-2xl border border-line bg-surface px-5 py-6 text-center"
      role="status"
      aria-live="polite"
      aria-label="내 옷장에서 오늘의 코디를 고르고 있습니다"
    >
      <span className="relative flex size-12 items-center justify-center rounded-2xl bg-sage">
        <span className="absolute inset-0 animate-ping rounded-2xl bg-sage opacity-40 motion-reduce:animate-none" />
        <Sparkles
          className="ai-outfit-loading-sparkles relative"
          size={21}
          aria-hidden="true"
        />
      </span>
      <h3 className="mt-3 text-sm font-black">오늘의 조합을 고르고 있어요</h3>
      <p className="mt-1 text-xs leading-5 text-muted">
        옷장과 스타일 취향을 살펴보는 중이에요
        <span className="ml-1 inline-flex gap-0.5" aria-hidden="true">
          <span className="ai-outfit-loading-dot">.</span>
          <span className="ai-outfit-loading-dot">.</span>
          <span className="ai-outfit-loading-dot">.</span>
        </span>
      </p>
    </section>
  )
}
