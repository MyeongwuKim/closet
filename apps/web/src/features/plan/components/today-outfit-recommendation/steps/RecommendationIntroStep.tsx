import { Sparkles } from 'lucide-react'

interface RecommendationIntroStepProps {
  onNext: () => void
}

/** 추천 시트의 소개 문구와 시작 버튼을 표시한다. 별도 카드 테두리 없이 시트 배경을 사용하며 시작을 누르면 부모에 계절 선택을 요청한다. */
export function RecommendationIntroStep({
  onNext,
}: RecommendationIntroStepProps) {
  return (
    <section className="flex h-full flex-col justify-center py-2 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-sage text-ink">
        <Sparkles size={21} />
      </span>
      <h3 className="mt-3 text-base font-black tracking-[-0.02em]">
        오늘 입을 코디를 골라드릴까요?
      </h3>
      <p className="mx-auto mt-1.5 max-w-64 text-xs leading-5 text-muted">
        등록한 옷의 색과 핏 균형을 비교해 계절과 날씨에 맞는 조합을 추천해요.
      </p>
      <div className="mt-3 flex justify-center gap-1.5 text-[10px] font-bold text-muted">
        <span className="rounded-full bg-canvas px-2.5 py-1">내 옷장</span>
        <span className="rounded-full bg-canvas px-2.5 py-1">계절·날씨</span>
      </div>
      <button
        type="button"
        onClick={onNext}
        className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white transition hover:bg-accent/90"
      >
        <Sparkles size={17} /> 추천받기
      </button>
    </section>
  )
}
