import { useEffect, useRef, useState } from 'react'
import type { WardrobeItem, WeatherSnapshot } from '@closet/types'
import { History, Sparkles, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ClosetItemVisual } from '../../../closet/components/ClosetItemVisual'
import { useUiStore } from '../../../../stores/useUiStore'
import { useTodayOutfitRecommendationFlow } from '../../hooks/useTodayOutfitRecommendationFlow'
import { RecommendationHistoryDialog } from './RecommendationHistoryDialog'
import { RecommendationPlannerStatus } from './RecommendationPlannerStatus'
import { RecommendationColorSchemeStep } from './steps/RecommendationColorSchemeStep'
import { RecommendationIntroStep } from './steps/RecommendationIntroStep'
import { RecommendationResultStep } from './steps/RecommendationResultStep'
import { RecommendationSeasonStep } from './steps/RecommendationSeasonStep'
import { RecommendationReadinessStatus } from './RecommendationReadinessStatus'
import { recommendationDayLabels, type RecommendationMode } from './recommendationFlow'

interface TodayOutfitRecommendationPopoverProps {
  date: string
  baseItem?: WardrobeItem
  mode?: RecommendationMode
  initialWeather?: WeatherSnapshot
  onClose: () => void
  onApplied?: () => void
}

/** 상단·옷 상세·플래너의 추천 시트다. 내일 플래너에서 열면 해당 날짜의 예보와 자동 색감으로 추천을 시작한다. */
export function TodayOutfitRecommendationPopover({
  date,
  baseItem,
  mode = 'today',
  initialWeather,
  onClose,
  onApplied,
}: TodayOutfitRecommendationPopoverProps) {
  const navigate = useNavigate()
  const popoverRef = useRef<HTMLElement>(null)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const {
    step,
    seasonChoice,
    colorScheme,
    selectedSeason,
    meQuery,
    plannerWeekQuery,
    hasScheduledOutfit,
    weather,
    locationWeather,
    actions,
  } = useTodayOutfitRecommendationFlow({ date, baseItem, mode, initialWeather })
  const dayLabel = recommendationDayLabels[mode]

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
  const isWeatherShortcut = step === 'weather-result'

  if (step === 'intro') {
    stepContent = (
      <RecommendationIntroStep
        dayLabel={dayLabel}
        onRecommendWithWeather={actions.recommendWithWeather}
        onChooseConditions={actions.showSeasons}
      />
    )
  } else if (step === 'season' || !seasonChoice || !selectedSeason) {
    stepContent = (
      <RecommendationSeasonStep
        mode={mode}
        availableSeasons={baseItem?.seasons}
        onBack={baseItem ? onClose : actions.showIntro}
        onSelect={actions.selectSeason}
      />
    )
  } else if (step === 'color-scheme' || !colorScheme) {
    stepContent = (
      <RecommendationColorSchemeStep
        requiresCredit={!baseItem}
        onBack={actions.showSeasons}
        onSelect={actions.selectColorScheme}
      />
    )
  } else if (
    !meQuery.data || meQuery.isError ||
    (seasonChoice === 'current-weather' && (!weather || locationWeather.isLoading))
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
        onBack={isWeatherShortcut ? actions.showSeasons : actions.showColorSchemes}
        backLabel={isWeatherShortcut ? '조건 바꾸기' : '색감 다시 선택'}
        loadingMessage={mode === 'tomorrow' ? '내일 예보와 추천에 필요한 정보를 확인하고 있어요' : undefined}
      />
    )
  } else if (plannerWeekQuery.isError || !plannerWeekQuery.data) {
    stepContent = (
      <RecommendationPlannerStatus
        dayLabel={dayLabel}
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
        colorScheme={colorScheme}
        hasScheduledOutfit={hasScheduledOutfit}
        mode={mode}
        baseItemId={baseItem?.id}
        weather={seasonChoice === 'current-weather' ? weather : null}
        onOpenCloset={openCloset}
        onOpenLookbook={onClose}
        onBack={isWeatherShortcut ? actions.showIntro : actions.showColorSchemes}
        onApplied={onApplied}
      />
    )
  }

  return createPortal(
    <div
      className={`fixed inset-0 flex items-end justify-center bg-ink/20 ${mode === 'tomorrow' ? 'z-[85]' : baseItem ? 'z-[70]' : 'z-[60]'}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={popoverRef}
        className="ai-recommendation-sheet ai-recommendation-sheet--flow relative flex w-full max-w-xl flex-col overflow-hidden rounded-t-[1.75rem] border border-line border-b-0 bg-surface shadow-[0_-12px_48px_rgba(27,27,24,0.16)]"
        role="dialog"
        aria-modal="true"
        aria-label={baseItem ? '이 옷으로 AI 코디 추천' : `${dayLabel}의 AI 코디 추천`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-line" aria-hidden="true" />
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-5 pt-2 pb-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-sm font-black">
              <Sparkles className="text-accent" size={16} /> {mode === 'tomorrow' ? '내일 코디 추천' : 'AI 추천 코디'}
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-muted">
              {mode === 'tomorrow' ? '내일 입을 조합을 골라보세요.' : baseItem ? '선택한 옷에 어울리는 조합을 찾아요.' : '생각하기 귀찮을 때 추천받아보세요.'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {mode === 'today' && (
              <button
                type="button"
                onClick={() => setIsHistoryOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-[11px] font-bold text-muted transition hover:border-ink hover:text-ink"
                aria-label="추천 기록 보기"
              >
                <History size={14} />
                기록
              </button>
            )}
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
          onOpenLookbook={onClose}
        />
      )}
    </div>,
    document.body,
  )
}
