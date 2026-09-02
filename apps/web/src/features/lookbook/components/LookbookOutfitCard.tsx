import type { WardrobeItem } from '@closet/types'
import { Sparkles } from 'lucide-react'
import { formatSeasonLabels } from '../../../constants/seasons'
import { getOutfitStyleLabel } from '../../../constants/styleOptions'
import type { OutfitWearSummary } from '../hooks/useOutfitWearSummaries'
import type { SavedOutfit } from '../types'
import { OutfitCardVisual } from './OutfitCardVisual'
import { OutfitWearStatus } from './OutfitWearStatus'

interface LookbookOutfitCardProps {
  outfit: SavedOutfit
  items: WardrobeItem[]
  wearSummary?: OutfitWearSummary
  onSelect: (outfitId: string) => void
}

export function LookbookOutfitCard({
  outfit,
  items,
  wearSummary,
  onSelect,
}: LookbookOutfitCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(outfit.id)}
      className="flex h-full min-w-0 w-full flex-col overflow-hidden rounded-3xl border border-line bg-surface p-2 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
      aria-label={`${outfit.name} 코디 상세 보기`}
    >
      <div className="relative aspect-[4/5] w-full shrink-0">
        <OutfitCardVisual
          outfit={outfit}
          items={items}
          className="size-full"
        />
        {outfit.previewImageUrl && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-[9px] font-bold text-white backdrop-blur">
            <Sparkles size={10} /> AI 룩
          </span>
        )}
      </div>
      <div className="flex min-w-0 w-full flex-1 flex-col px-2 pt-3 pb-2">
        <div className="flex min-h-7 min-w-0 items-start gap-1 overflow-hidden">
          <span className="inline-flex shrink-0 rounded-full bg-sage px-2 py-1 text-[10px] font-bold">
            {getOutfitStyleLabel(outfit.style)}
          </span>
          {outfit.seasons.length > 0 && (
            <span className="truncate rounded-full border border-line px-2 py-1 text-[10px] font-bold text-muted">
              {formatSeasonLabels(outfit.seasons)}
            </span>
          )}
        </div>
        <h2 className="truncate text-sm font-black">{outfit.name}</h2>
        <div className="grid min-h-8">
          <OutfitWearStatus summary={wearSummary} />
        </div>
        <p className="mt-1 truncate text-xs text-muted">
          {outfit.layers.length}개 아이템 ·{' '}
          {new Intl.DateTimeFormat('ko-KR', {
            month: 'long',
            day: 'numeric',
          }).format(new Date(outfit.createdAt))}
        </p>
      </div>
    </button>
  )
}
