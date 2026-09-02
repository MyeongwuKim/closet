import { useState } from 'react'
import { History, Sparkles, X } from 'lucide-react'
import { formatDateOnly } from '../data/weeklyPlan'
import { RecommendationHistoryDialog } from './today-outfit-recommendation/RecommendationHistoryDialog'
import { TodayOutfitRecommendationPopover } from './today-outfit-recommendation/TodayOutfitRecommendationPopover'

export function OutfitRecommendationActions() {
  const [isRecommendationOpen, setIsRecommendationOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const date = formatDateOnly(new Date())

  return (
    <>
      <div
        className="fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[70] flex items-center gap-2 md:right-6 md:bottom-6"
        role="group"
        aria-label="AI 코디 추천과 기록"
      >
        <button
          type="button"
          onClick={() => setIsHistoryOpen(true)}
          className="flex size-12 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-[0_8px_24px_rgba(27,27,24,0.12)] transition hover:border-ink focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
          aria-label="AI 코디 추천 기록 열기"
          title="추천 기록"
          aria-expanded={isHistoryOpen}
          aria-haspopup="dialog"
        >
          <History size={19} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setIsRecommendationOpen((current) => !current)}
          className="flex size-12 items-center justify-center rounded-full bg-ink text-white shadow-[0_12px_30px_rgba(27,27,24,0.28)] transition hover:bg-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 md:w-auto md:gap-2 md:px-4"
          aria-label={isRecommendationOpen ? 'AI 코디 추천 닫기' : 'AI 코디 추천 열기'}
          aria-expanded={isRecommendationOpen}
          aria-haspopup="dialog"
        >
          {isRecommendationOpen ? <X size={20} /> : <Sparkles size={19} />}
          <span className="hidden text-xs font-black md:inline">
            {isRecommendationOpen ? '닫기' : 'AI 코디'}
          </span>
        </button>
      </div>

      {isRecommendationOpen && (
        <TodayOutfitRecommendationPopover
          date={date}
          onClose={() => setIsRecommendationOpen(false)}
        />
      )}
      {isHistoryOpen && (
        <RecommendationHistoryDialog
          date={date}
          scope="all"
          onClose={() => setIsHistoryOpen(false)}
        />
      )}
    </>
  )
}
