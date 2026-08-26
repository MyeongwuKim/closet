import type { Season } from '@closet/types'
import { ChevronLeft } from 'lucide-react'
import type { OutfitStyle } from '../../../../../constants/styleOptions'
import { RecommendationQuickReply } from '../RecommendationChatUi'
import { TodayOutfitRecommendationResult } from '../TodayOutfitRecommendationResult'

interface RecommendationResultStepProps {
  viewerId: string
  date: string
  season: Season
  style: OutfitStyle
  hasTodayOutfit: boolean
  onHistoryChange?: () => void
  onBack: () => void
}

export function RecommendationResultStep({
  viewerId,
  date,
  season,
  style,
  hasTodayOutfit,
  onHistoryChange,
  onBack,
}: RecommendationResultStepProps) {
  return (
    <section className="flex h-full min-h-0 flex-col gap-2 py-1">
      <div className="min-h-0 flex-1">
        <TodayOutfitRecommendationResult
          key={`${viewerId}:${date}:${season}:${style}`}
          viewerId={viewerId}
          date={date}
          season={season}
          style={style}
          hasTodayOutfit={hasTodayOutfit}
          onHistoryChange={onHistoryChange}
        />
      </div>
      <div className="flex shrink-0 justify-end">
        <RecommendationQuickReply secondary delayMs={440} onClick={onBack}>
          <span className="inline-flex items-center gap-1">
            <ChevronLeft size={13} /> 뒤로가기
          </span>
        </RecommendationQuickReply>
      </div>
    </section>
  )
}
