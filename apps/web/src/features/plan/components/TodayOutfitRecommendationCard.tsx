import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { TodayOutfitRecommendationPopover } from './today-outfit-recommendation/TodayOutfitRecommendationPopover'

interface TodayOutfitRecommendationCardProps {
  date: string
  hasTodayOutfit: boolean
}

export function TodayOutfitRecommendationCard({
  date,
  hasTodayOutfit,
}: TodayOutfitRecommendationCardProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[70] flex size-12 items-center justify-center rounded-full bg-ink text-white shadow-[0_12px_30px_rgba(27,27,24,0.28)] transition hover:bg-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 md:right-6 md:bottom-6 md:w-auto md:gap-2 md:px-4"
        aria-label={isOpen ? 'AI 코디 추천 닫기' : 'AI 코디 추천 열기'}
        aria-expanded={isOpen}
      >
        {isOpen ? <X size={20} /> : <Sparkles size={19} />}
        <span className="hidden text-xs font-black md:inline">
          {isOpen ? '닫기' : 'AI 코디'}
        </span>
      </button>

      {isOpen && (
        <TodayOutfitRecommendationPopover
          date={date}
          hasTodayOutfit={hasTodayOutfit}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
