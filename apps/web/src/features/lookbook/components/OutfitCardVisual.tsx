import type { WardrobeItem } from '@closet/types'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'
import type { SavedOutfit } from '../types'

interface OutfitCardVisualProps {
  outfit: SavedOutfit
  items: WardrobeItem[]
  className?: string
}

export function OutfitCardVisual({
  outfit,
  items,
  className = '',
}: OutfitCardVisualProps) {
  if (outfit.previewImageUrl) {
    return (
      <div className={`overflow-hidden rounded-[1.25rem] bg-canvas ${className}`}>
        <img
          src={outfit.previewImageUrl}
          alt={`${outfit.name} AI 룩북 이미지`}
          className="size-full object-contain"
        />
      </div>
    )
  }

  const outfitItems = [...outfit.layers]
    .sort((left, right) => left.order - right.order)
    .flatMap((layer) => {
      const item = items.find(
        (candidate) => candidate.id === layer.wardrobeItemId,
      )
      return item ? [item] : []
    })
  const visibleItems = outfitItems.slice(0, 4)
  const hiddenCount = outfitItems.length - visibleItems.length

  return (
    <div
      className={`grid grid-cols-2 gap-2 overflow-hidden rounded-[1.25rem] bg-canvas p-3 ${className}`}
      aria-label={`${outfit.name} 코디 아이템`}
    >
      {visibleItems.map((item, index) => (
        <span
          className="relative flex min-h-0 items-center justify-center overflow-hidden rounded-xl bg-surface"
          key={item.id}
        >
          <ClosetItemVisual item={item} compact />
          {hiddenCount > 0 && index === visibleItems.length - 1 && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-black text-white backdrop-blur-[1px]">
              +{hiddenCount}
            </span>
          )}
        </span>
      ))}
    </div>
  )
}
