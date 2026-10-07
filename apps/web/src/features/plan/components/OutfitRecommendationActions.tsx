import { useState } from 'react'
import { History, Sparkles } from 'lucide-react'
import { formatDateOnly } from '../data/weeklyPlan'
import { RecommendationHistoryDialog } from './today-outfit-recommendation/RecommendationHistoryDialog'
import { TodayOutfitRecommendationPopover } from './today-outfit-recommendation/TodayOutfitRecommendationPopover'

interface OutfitRecommendationActionsProps {
  placement?: 'floating' | 'header'
}

/** 추천·기록 팝업의 열림 상태를 관리한다. 기본값 floating은 하단 탭·안전 영역 위에 고정하고, header는 상단에 작은 버튼으로 배치한다. 추천 버튼의 아이콘·문구는 열림 상태와 관계없이 유지하며 추천과 기록 조회는 각 팝업에 맡긴다. */
export function OutfitRecommendationActions({ placement = 'floating' }: OutfitRecommendationActionsProps) {
  const [isRecommendationOpen, setIsRecommendationOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const date = formatDateOnly(new Date())
  const inHeader = placement === 'header'

  return (
    <>
      <div
        className={inHeader ? 'flex shrink-0 items-center gap-2' : 'fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[70] flex items-center gap-2 md:right-6 md:bottom-6'}
        role="group"
        aria-label="AI 코디 추천과 기록"
      >
        <button
          type="button"
          onClick={() => setIsHistoryOpen(true)}
          className={`flex items-center justify-center rounded-full border border-line bg-surface text-ink transition hover:border-ink focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 ${inHeader ? 'size-10' : 'size-12 shadow-[0_8px_24px_rgba(27,27,24,0.12)]'}`}
          aria-label="AI 코디 추천 기록 열기"
          title="추천 기록"
          aria-expanded={isHistoryOpen}
          aria-haspopup="dialog"
        >
          <History size={inHeader ? 17 : 19} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setIsRecommendationOpen((current) => !current)}
          className={`flex items-center justify-center rounded-full bg-accent text-surface transition hover:bg-ink ${inHeader ? 'h-10 gap-1.5 px-3' : 'size-12 shadow-[0_8px_24px_rgba(41,59,49,0.18)] md:w-auto md:gap-2 md:px-4'}`}
          aria-label="AI 코디 추천"
          aria-expanded={isRecommendationOpen}
          aria-haspopup="dialog"
        >
          <Sparkles size={inHeader ? 17 : 19} />
          <span className={inHeader ? 'text-[11px] font-medium' : 'hidden text-xs font-medium md:inline'}>
            {inHeader ? 'AI 추천' : 'AI 코디'}
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
