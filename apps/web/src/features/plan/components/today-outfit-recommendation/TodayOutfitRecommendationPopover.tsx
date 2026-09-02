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
import { RecommendationStyleStep } from './steps/RecommendationStyleStep'

interface TodayOutfitRecommendationPopoverProps {
  date: string
  baseItem?: WardrobeItem
  onClose: () => void
}

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
    selectedStyle,
    availableStyleOptions,
    hasPreferredStyles,
    meQuery,
    plannerWeekQuery,
    hasTodayOutfit,
    locationWeather,
    actions,
  } = useTodayOutfitRecommendationFlow({ date, baseItem })

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (useUiStore.getState().recentWearConfirmation) return
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
      if (dialogs.item(dialogs.length - 1) !== popoverRef.current) return
      onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
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
  } else if (step === 'style' || !selectedStyle || !meQuery.data) {
    stepContent = (
      <RecommendationStyleStep
        season={selectedSeason}
        seasonChoice={seasonChoice}
        options={availableStyleOptions}
        hasPreferredStyles={hasPreferredStyles}
        isLoading={meQuery.isLoading}
        isError={meQuery.isError || (!meQuery.isLoading && !meQuery.data)}
        weather={locationWeather.weather}
        isWeatherLoading={
          seasonChoice === 'current-weather' && locationWeather.isLoading
        }
        weatherError={
          seasonChoice === 'current-weather'
            ? locationWeather.errorMessage
            : null
        }
        onBack={actions.showSeasons}
        onRetry={() => void meQuery.refetch()}
        onWeatherRetry={locationWeather.actions.retry}
        onSelect={actions.selectStyle}
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
        style={selectedStyle}
        hasTodayOutfit={hasTodayOutfit}
        baseItemId={baseItem?.id}
        weather={
          seasonChoice === 'current-weather' ? locationWeather.weather : null
        }
        onOpenCloset={openCloset}
        onBack={actions.showStyles}
      />
    )
  }

  return createPortal(
    <div
      className={`fixed inset-0 ${baseItem ? 'z-[70] bg-ink/20' : 'z-[60] bg-ink/5 md:bg-transparent'}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={popoverRef}
        className={`selection-bar-enter absolute inset-x-3 flex flex-col overflow-hidden rounded-[1.75rem] border border-line bg-canvas shadow-[0_22px_60px_rgba(27,27,24,0.22)] sm:right-5 sm:left-auto sm:w-[25rem] ${baseItem
          ? 'bottom-[calc(1rem+env(safe-area-inset-bottom))] h-[28rem] max-h-[calc(100dvh-3rem-env(safe-area-inset-bottom))] md:right-6 md:bottom-6'
          : 'bottom-[calc(9.25rem+env(safe-area-inset-bottom))] h-96 max-h-[calc(100dvh-10.25rem)] md:right-6 md:bottom-20 md:max-h-[calc(100dvh-6rem)]'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={baseItem ? '이 옷으로 AI 코디 추천' : '오늘의 AI 코디 추천'}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3.5">
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
        <div className="min-h-0 flex-1 overflow-y-auto p-3 [&>section]:mt-0 sm:p-4">
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
