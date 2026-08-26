import type { Season } from '@closet/types'
import { ChevronLeft } from 'lucide-react'
import { seasonOptions } from '../../../../../constants/seasons'
import {
  RecommendationAssistantMessage,
  RecommendationQuickReply,
} from '../RecommendationChatUi'
import type { SeasonChoice } from '../recommendationFlow'

interface RecommendationSeasonStepProps {
  onBack: () => void
  onSelect: (choice: SeasonChoice) => void
}

export function RecommendationSeasonStep({
  onBack,
  onSelect,
}: RecommendationSeasonStepProps) {
  return (
    <section
      className="flex h-full flex-col gap-2 py-1"
      aria-live="polite"
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col justify-center gap-3 py-1">
          <RecommendationAssistantMessage>
            <p className="font-black">어떤 계절의 코디를 찾을까요?</p>
            <p className="mt-0.5 text-muted">
              현재 날씨를 선택하거나 계절을 직접 골라주세요.
            </p>
          </RecommendationAssistantMessage>

          <div className="ml-10 flex flex-wrap justify-end gap-2">
            <RecommendationQuickReply
              delayMs={80}
              onClick={() => onSelect('current-weather')}
            >
              현재 날씨로 받기
            </RecommendationQuickReply>
            {seasonOptions.map((option, index) => (
              <RecommendationQuickReply
                key={option.value}
                delayMs={130 + index * 45}
                onClick={() => onSelect(option.value as Season)}
              >
                {option.label}
              </RecommendationQuickReply>
            ))}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 justify-end">
        <RecommendationQuickReply secondary delayMs={330} onClick={onBack}>
          <span className="inline-flex items-center gap-1">
            <ChevronLeft size={13} /> 뒤로가기
          </span>
        </RecommendationQuickReply>
      </div>
    </section>
  )
}
