import type { Season, WeatherSnapshot } from '@closet/types'
import { ChevronLeft } from 'lucide-react'
import { RecommendationQuickReply } from '../RecommendationChatUi'
import { TodayOutfitRecommendationResult } from '../TodayOutfitRecommendationResult'

interface RecommendationResultStepProps {
  viewerId: string
  date: string
  season: Season
  hasTodayOutfit: boolean
  baseItemId?: string
  weather?: WeatherSnapshot | null
  onBack: () => void
  onOpenCloset: () => void
}

export function RecommendationResultStep({
  viewerId,
  date,
  season,
  hasTodayOutfit,
  baseItemId,
  weather,
  onBack,
  onOpenCloset,
}: RecommendationResultStepProps) {
  return (
    <section className="flex h-full min-h-0 flex-col gap-2 py-1">
      <div className="min-h-0 flex-1">
        <TodayOutfitRecommendationResult
          key={`${viewerId}:${date}:${season}:${baseItemId ?? 'all'}`}
          viewerId={viewerId}
          date={date}
          season={season}
          hasTodayOutfit={hasTodayOutfit}
          baseItemId={baseItemId}
          weather={weather}
          onOpenCloset={onOpenCloset}
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
