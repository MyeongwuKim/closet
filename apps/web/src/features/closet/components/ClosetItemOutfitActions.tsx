import type { WardrobeItem } from '@closet/types'
import { Layers3, Sparkles } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { createOutfitComposerPath } from '../../lookbook/utils/outfitComposerNavigation'
import { TodayOutfitRecommendationPopover } from '../../plan/components/today-outfit-recommendation/TodayOutfitRecommendationPopover'
import { formatDateOnly } from '../../plan/data/weeklyPlan'

interface ClosetItemOutfitActionsProps {
  item: WardrobeItem
  isRecommendationOpen: boolean
  onRecommendationOpenChange: (isOpen: boolean) => void
}

export function ClosetItemOutfitActions({
  item,
  isRecommendationOpen,
  onRecommendationOpenChange,
}: ClosetItemOutfitActionsProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const date = formatDateOnly(new Date())
  const isClassified = item.classificationStatus === 'classified'
  const unavailableReason = !isClassified
    ? '옷 정보 분석이 끝나면 AI 코디를 추천받을 수 있어요.'
    : !item.category || item.category === 'other'
      ? '옷의 카테고리를 지정하면 AI 코디를 추천받을 수 있어요.'
      : item.seasons.length === 0
        ? '옷의 계절 정보를 등록하면 AI 코디를 추천받을 수 있어요.'
        : null

  return (
    <>
      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(27,27,24,0.06)]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onRecommendationOpenChange(true)}
            disabled={Boolean(unavailableReason)}
            aria-expanded={isRecommendationOpen}
            aria-haspopup="dialog"
            title={unavailableReason ?? undefined}
            className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-3.5 text-xs font-bold text-white transition hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
          >
            <Sparkles className="shrink-0" size={17} />
            <span className="truncate">AI 코디 추천</span>
          </button>
          <button
            type="button"
            onClick={() =>
              navigate(
                createOutfitComposerPath(
                  [item.id],
                  `${location.pathname}${location.search}${location.hash}`,
                ),
              )
            }
            disabled={!isClassified}
            title={
              isClassified
                ? undefined
                : '옷 정보 분석이 끝나면 직접 코디를 만들 수 있어요.'
            }
            className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-line bg-canvas px-3 py-3.5 text-xs font-bold transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
          >
            <Layers3 className="shrink-0" size={17} />
            <span className="truncate">직접 코디 맞추기</span>
          </button>
        </div>
      </footer>

      {isRecommendationOpen && (
        <TodayOutfitRecommendationPopover
          key={item.id}
          date={date}
          baseItem={item}
          onClose={() => onRecommendationOpenChange(false)}
        />
      )}
    </>
  )
}
