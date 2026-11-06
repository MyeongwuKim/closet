import { AiCreditActionButton } from '../../../../lookbook/components/AiCreditActionButton'
import { PreviewCreditSummary } from '../../../../lookbook/components/PreviewCreditSummary'
import { Sparkles } from 'lucide-react'

interface RecommendationIntroStepProps {
  dayLabel: '오늘' | '내일'
  onRecommendWithWeather: () => void
  onChooseConditions: () => void
}

/** 대상 날짜의 날씨와 자동 색감으로 바로 추천하거나, 계절·색감을 직접 고르는 시작 단계다. */
export function RecommendationIntroStep({
  dayLabel,
  onRecommendWithWeather,
  onChooseConditions,
}: RecommendationIntroStepProps) {
  return (
    <section className="flex h-full flex-col justify-center py-2 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-sage text-ink">
        <Sparkles size={21} />
      </span>
      <h3 className="mt-3 text-base font-black tracking-[-0.02em]">
        {dayLabel} 입을 코디를 골라드릴까요?
      </h3>
      <p className="mx-auto mt-1.5 max-w-64 text-xs leading-5 text-muted">
        등록한 옷의 색과 핏 균형을 비교해 계절과 날씨에 맞는 조합을 추천해요.
      </p>
      <div className="mt-3 flex justify-center gap-1.5 text-[10px] font-bold text-muted">
        <span className="rounded-full bg-canvas px-2.5 py-1">내 옷장</span>
        <span className="rounded-full bg-canvas px-2.5 py-1">계절·날씨</span>
      </div>
      <div className="mt-3"><PreviewCreditSummary kind="recommendation" /></div>
      <AiCreditActionButton
        kind="recommendation"
        label={`${dayLabel} 날씨로 바로 추천`}
        adLabel="광고 보고 추천받기"
        onClick={onRecommendWithWeather}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white transition hover:bg-accent/90"
      >
        <Sparkles size={17} />
      </AiCreditActionButton>
      <button
        type="button"
        onClick={onChooseConditions}
        className="mt-2 min-h-11 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-bold text-ink transition hover:border-ink"
      >
        조건 바꾸기
      </button>
    </section>
  )
}
