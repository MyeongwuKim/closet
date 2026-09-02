import { useState } from 'react'
import { useRecommendationHistory } from '../../hooks/useRecommendationHistory'
import { formatRecommendationHeadline } from '../../utils/todayOutfitRecommendation'
import { TodayOutfitRecommendationDialog } from '../TodayOutfitRecommendationDialog'
import { RecommendationExplanationDialog } from './RecommendationExplanationDialog'
import { RecommendationHistorySheet } from './RecommendationHistorySheet'

interface RecommendationHistoryDialogProps {
  date: string
  baseItemId?: string
  scope?: 'all' | 'current'
  onClose: () => void
}

export function RecommendationHistoryDialog({
  date,
  baseItemId,
  scope = 'current',
  onClose,
}: RecommendationHistoryDialogProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const history = useRecommendationHistory({
    date,
    baseItemId,
    scope,
  })

  if (
    history.selectedEntry &&
    isEditorOpen &&
    !history.isLoading &&
    !history.errorMessage
  ) {
    return (
      <TodayOutfitRecommendationDialog
        date={date}
        title={formatRecommendationHeadline(
          history.selectedEntry.recommendation.headline,
        )}
        backLabel="추천 설명으로 돌아가기"
        items={history.closetItems}
        initialItems={history.selectedEntry.recommendation.items}
        style={history.selectedEntry.style}
        hasTodayOutfit={history.hasTodayOutfit}
        isSaving={history.isSaving}
        onClose={() => setIsEditorOpen(false)}
        onApplied={() => {
          setIsEditorOpen(false)
          history.actions.showList()
        }}
        onApply={history.actions.applyRecommendation}
      />
    )
  }

  if (history.selectedEntry && !history.isLoading && !history.errorMessage) {
    return (
      <RecommendationExplanationDialog
        headline={history.selectedEntry.recommendation.headline}
        summary={history.selectedEntry.recommendation.summary}
        reasons={history.selectedEntry.recommendation.reasons}
        season={history.selectedEntry.season}
        style={history.selectedEntry.style}
        items={history.selectedEntry.recommendation.items}
        backLabel="추천 기록으로 돌아가기"
        onClose={history.actions.showList}
        onOpenDetails={() => setIsEditorOpen(true)}
      />
    )
  }

  return (
    <RecommendationHistorySheet
      entries={history.entries}
      isLoading={history.isLoading}
      errorMessage={history.errorMessage}
      isRetrying={history.isRetrying}
      onRetry={history.actions.retry}
      onSelect={(entry) => {
        setIsEditorOpen(false)
        history.actions.selectEntry(entry)
      }}
      onClose={onClose}
    />
  )
}
