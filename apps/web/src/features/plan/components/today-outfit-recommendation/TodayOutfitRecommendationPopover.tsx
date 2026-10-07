import { useEffect, useRef, useState } from 'react'
import type { WardrobeItem } from '@closet/types'
import { History, Sparkles, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ClosetItemVisual } from '../../../closet/components/ClosetItemVisual'
import { useUiStore } from '../../../../stores/useUiStore'
import { useTodayOutfitRecommendationFlow } from '../../hooks/useTodayOutfitRecommendationFlow'
import { RecommendationHistoryDialog } from './RecommendationHistoryDialog'
import { RecommendationPlannerStatus } from './RecommendationPlannerStatus'
import { RecommendationIntroStep } from './steps/RecommendationIntroStep'
import { RecommendationResultStep } from './steps/RecommendationResultStep'
import { RecommendationSeasonStep } from './steps/RecommendationSeasonStep'
import { RecommendationReadinessStatus } from './RecommendationReadinessStatus'

interface TodayOutfitRecommendationPopoverProps {
  date: string
  baseItem?: WardrobeItem
  onClose: () => void
}

/** 상단 또는 옷 상세의 AI 추천 버튼에서 하단 시트를 연다. 모든 단계에서 같은 높이를 유지하고 바깥 클릭·닫기·Escape로 종료한다. 추천 조건과 조회는 흐름 Hook 및 각 단계에 맡긴다. */
export function TodayOutfitRecommendationPopover({
  date,
  baseItem,
  onClose,
}: TodayOutfitRecommendationPopoverProps) {
  const navigate = useNavigate()
  const popoverRef = useRef<HTMLElement>(null)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const {
    step,
    seasonChoice,
    selectedSeason,
    meQuery,
    plannerWeekQuery,
    hasTodayOutfit,
    locationWeather,
    actions,
  } = useTodayOutfitRecommendationFlow({ date, baseItem })

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (useUiStore.getState().recentWearConfirmation) return
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
      if (dialogs.item(dialogs.length - 1) !== popoverRef.current) return
      onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const openCloset = () => {
    onClose()
    navigate('/closet')
  }

  let stepContent

  if (step === 'intro') {
    stepContent = <RecommendationIntroStep onNext={actions.showSeasons} />
  } else if (step === 'season' || !seasonChoice || !selectedSeason) {
    stepContent = (
      <RecommendationSeasonStep
        availableSeasons={baseItem?.seasons}
        onBack={baseItem ? onClose : actions.showIntro}
        onSelect={actions.selectSeason}
      />
    )
  } else if (
    !meQuery.data || meQuery.isError ||
    (seasonChoice === 'current-weather' && (!locationWeather.weather || locationWeather.isLoading))
  ) {
    const weatherError = seasonChoice === 'current-weather' ? locationWeather.errorMessage : null
    stepContent = (
      <RecommendationReadinessStatus
        isLoading={meQuery.isLoading || locationWeather.isLoading}
        errorMessage={weatherError ?? (meQuery.isError ? '계정 정보를 불러오지 못했어요.' : null)}
        onRetry={() => {
          if (weatherError) locationWeather.actions.retry()
          else void meQuery.refetch()
        }}
        onBack={actions.showSeasons}
      />
    )
  } else if (plannerWeekQuery.isError || !plannerWeekQuery.data) {
    stepContent = (
      <RecommendationPlannerStatus
        isError={plannerWeekQuery.isError}
        isRetrying={plannerWeekQuery.isFetching}
        onRetry={() => void plannerWeekQuery.refetch()}
      />
    )
  } else {
    stepContent = (
      <RecommendationResultStep
        viewerId={meQuery.data.id}
        date={date}
        season={selectedSeason}
        hasTodayOutfit={hasTodayOutfit}
        baseItemId={baseItem?.id}
        weather={
          seasonChoice === 'current-weather' ? locationWeather.weather : null
        }
        onOpenCloset={openCloset}
        onBack={actions.showSeasons}
      />
    )
  }

  return createPortal(
    <div
      className={`fixed inset-0 flex items-end justify-center bg-ink/20 ${baseItem ? 'z-[70]' : 'z-[60]'}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={popoverRef}
        className="ai-recommendation-sheet relative flex w-full max-w-xl flex-col overflow-hidden rounded-t-[1.75rem] border border-line border-b-0 bg-surface shadow-[0_-12px_48px_rgba(27,27,24,0.16)]"
        role="dialog"
        aria-modal="true"
        aria-label={baseItem ? '이 옷으로 AI 코디 추천' : '오늘의 AI 코디 추천'}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-line" aria-hidden="true" />
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-5 pt-2 pb-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-sm font-black">
              <Sparkles className="text-accent" size={16} /> AI 추천 코디
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-muted">
              {baseItem ? '선택한 옷에 어울리는 조합을 찾아요.' : '생각하기 귀찮을 때 추천받아보세요.'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-[11px] font-bold text-muted transition hover:border-ink hover:text-ink"
              aria-label="추천 기록 보기"
            >
              <History size={14} />
              기록
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-canvas"
              aria-label="AI 코디 추천 닫기"
              autoFocus
            >
              <X size={18} />
            </button>
          </div>
        </header>
        {baseItem && (
          <div className="flex shrink-0 items-center gap-2.5 border-b border-line bg-sage/40 px-4 py-2.5">
            <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface">
              <ClosetItemVisual item={baseItem} compact />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-muted">기준 아이템 · 추천에 항상 포함</p>
              <p className="mt-0.5 truncate text-xs font-black">{baseItem.name}</p>
            </div>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 [&>section]:mt-0">
          {stepContent}
        </div>
      </section>
      {isHistoryOpen && (
        <RecommendationHistoryDialog
          date={date}
          baseItemId={baseItem?.id}
          scope={baseItem ? 'current' : 'all'}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}
    </div>,
    document.body,
  )
}
