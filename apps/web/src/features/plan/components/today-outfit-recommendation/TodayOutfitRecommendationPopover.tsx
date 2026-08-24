import { useEffect, useState } from 'react'
import type { Season } from '@closet/types'
import { Sparkles, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import {
  getOutfitStyleLabel,
  outfitStyleOptions,
  type OutfitStyle,
} from '../../../../constants/styleOptions'
import { useMeQuery } from '../../../settings/api/profileQueries'
import {
  getSeasonForDate,
  type RecommendationStep,
  type SeasonChoice,
} from './recommendationFlow'
import { RecommendationIntroStep } from './steps/RecommendationIntroStep'
import { RecommendationResultStep } from './steps/RecommendationResultStep'
import { RecommendationSeasonStep } from './steps/RecommendationSeasonStep'
import { RecommendationStyleStep } from './steps/RecommendationStyleStep'

interface TodayOutfitRecommendationPopoverProps {
  date: string
  hasTodayOutfit: boolean
  onClose: () => void
}

export function TodayOutfitRecommendationPopover({
  date,
  hasTodayOutfit,
  onClose,
}: TodayOutfitRecommendationPopoverProps) {
  const [step, setStep] = useState<RecommendationStep>('intro')
  const [seasonChoice, setSeasonChoice] = useState<SeasonChoice | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<OutfitStyle | null>(null)
  const meQuery = useMeQuery()
  const currentSeason = getSeasonForDate(date)
  const selectedSeason: Season | null =
    seasonChoice === 'current-weather' ? currentSeason : seasonChoice
  const preferredStyles = meQuery.data?.styleProfile.preferredStyles ?? []
  const availableStyleOptions =
    preferredStyles.length > 0
      ? preferredStyles.map((style) => ({
          value: style,
          label: getOutfitStyleLabel(style),
        }))
      : outfitStyleOptions

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const selectSeason = (choice: SeasonChoice) => {
    setSeasonChoice(choice)
    setSelectedStyle(null)
    setStep('style')
  }

  const selectStyle = (style: OutfitStyle) => {
    setSelectedStyle(style)
    setStep('result')
  }

  let stepContent

  if (step === 'intro') {
    stepContent = <RecommendationIntroStep onNext={() => setStep('season')} />
  } else if (step === 'season' || !seasonChoice || !selectedSeason) {
    stepContent = (
      <RecommendationSeasonStep
        onBack={() => setStep('intro')}
        onSelect={selectSeason}
      />
    )
  } else if (step === 'style' || !selectedStyle || !meQuery.data) {
    stepContent = (
      <RecommendationStyleStep
        season={selectedSeason}
        seasonChoice={seasonChoice}
        options={availableStyleOptions}
        hasPreferredStyles={preferredStyles.length > 0}
        isLoading={meQuery.isLoading}
        isError={meQuery.isError || (!meQuery.isLoading && !meQuery.data)}
        onBack={() => {
          setSeasonChoice(null)
          setSelectedStyle(null)
          setStep('season')
        }}
        onRetry={() => void meQuery.refetch()}
        onSelect={selectStyle}
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
        onBack={() => {
          setSelectedStyle(null)
          setStep('style')
        }}
      />
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-ink/5 md:bg-transparent"
      onMouseDown={onClose}
    >
      <section
        className="selection-bar-enter absolute inset-x-3 bottom-[calc(9.25rem+env(safe-area-inset-bottom))] flex h-96 max-h-[calc(100dvh-10.25rem)] flex-col overflow-hidden rounded-[1.75rem] border border-line bg-canvas shadow-[0_22px_60px_rgba(27,27,24,0.22)] sm:right-5 sm:left-auto sm:w-[25rem] md:right-6 md:bottom-20 md:h-96 md:max-h-[calc(100dvh-6rem)]"
        role="dialog"
        aria-modal="true"
        aria-label="오늘의 AI 코디 추천"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3.5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-sm font-black">
              <Sparkles className="text-accent" size={16} /> AI 추천 코디
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-muted">
              생각하기 귀찮을 때 추천받아보세요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-canvas"
            aria-label="AI 코디 추천 닫기"
            autoFocus
          >
            <X size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 [&>section]:mt-0 sm:p-4">
          {stepContent}
        </div>
      </section>
    </div>,
    document.body,
  )
}
