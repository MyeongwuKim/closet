import type { WardrobeItem } from '@closet/types'
import { Sparkles } from 'lucide-react'
import { WoodCardClip } from '../../../components/WoodCardClip'
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

/** 코디의 착장 사진 또는 옷 조합만 집게에 걸고, 이름·스타일·계절·착용 기록은 사진 아래 캡션으로 표시한다. 선택 시 부모에 상세 표시를 요청한다. */
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
      className="collection-clipped-card wardrobe-outfit-card group flex h-full min-w-0 w-full flex-col text-left"
      aria-label={`${outfit.name} 코디 상세 보기`}
    >
      <div className="collection-photo w-full shrink-0">
        <WoodCardClip />
        <div className="archive-image relative aspect-[4/5] w-full">
          <OutfitCardVisual
            outfit={outfit}
            items={items}
            className="size-full transition-transform duration-300 group-hover:scale-[1.02]"
          />
          {outfit.previewImageUrl && (
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[9px] font-medium text-white backdrop-blur">
              <Sparkles size={10} /> AI 룩
            </span>
          )}
        </div>
      </div>
      <div className="flex min-w-0 w-full flex-1 flex-col px-0.5 pt-3 pb-1">
        <h2 className="line-clamp-2 text-sm font-semibold leading-5 tracking-[-.025em]">{outfit.name}</h2>
        <div className="mt-1.5 flex min-w-0 items-center gap-1 overflow-hidden">
          <span className="inline-flex shrink-0 text-[11px] text-muted">
            {getOutfitStyleLabel(outfit.style)}
          </span>
          {outfit.seasons.length > 0 && (
            <span className="truncate text-[11px] text-muted">
              · {formatSeasonLabels(outfit.seasons)}
            </span>
          )}
        </div>
        <OutfitWearStatus summary={wearSummary} compact />
      </div>
    </button>
  )
}
