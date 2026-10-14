import { ChevronLeft } from 'lucide-react'
import { colorSchemeOptions, type ColorScheme } from '../../../data/colorSchemes'
import {
  RecommendationAssistantMessage,
  RecommendationQuickReply,
} from '../RecommendationChatUi'

interface RecommendationColorSchemeStepProps {
  onBack: () => void
  onSelect: (colorScheme: ColorScheme) => void
}

/** 계절 선택 다음에 색 조합 방향을 고른다. 예시 색상은 선택지를 설명하며 실제 보유 옷 색을 뜻하지 않는다. */
export function RecommendationColorSchemeStep({
  onBack,
  onSelect,
}: RecommendationColorSchemeStepProps) {
  return (
    <section className="flex h-full flex-col gap-2 py-1" aria-live="polite">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col justify-center gap-3 py-1">
          <RecommendationAssistantMessage>
            <p className="font-black">어떤 색감으로 맞춰볼까요?</p>
            <p className="mt-0.5 text-muted">
              선택한 계절의 옷 중에서 원하는 색 조합을 먼저 찾아볼게요.
            </p>
          </RecommendationAssistantMessage>

          <div className="ml-8 flex flex-col items-stretch gap-1.5">
            {colorSchemeOptions.map((option, index) => (
              <RecommendationQuickReply
                key={option.value}
                delayMs={80 + index * 45}
                onClick={() => onSelect(option.value)}
              >
                <span className="flex items-center gap-2 text-left">
                  <span className="flex shrink-0 -space-x-1" aria-hidden="true">
                    {option.swatches.map((swatch, swatchIndex) => (
                      <span
                        key={`${swatch}-${swatchIndex}`}
                        className="size-4 rounded-full border border-ink/10 ring-1 ring-white"
                        style={{ backgroundColor: swatch }}
                      />
                    ))}
                  </span>
                  <span className="min-w-0 truncate whitespace-nowrap">
                    <span className="font-black">{option.label}</span>
                    {option.hint && (
                      <span className="text-[11px] font-medium text-muted"> · {option.hint}</span>
                    )}
                  </span>
                </span>
              </RecommendationQuickReply>
            ))}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 justify-end">
        <RecommendationQuickReply secondary delayMs={350} onClick={onBack}>
          <span className="inline-flex items-center gap-1">
            <ChevronLeft size={13} /> 계절 다시 선택
          </span>
        </RecommendationQuickReply>
      </div>
    </section>
  )
}
