import type { WardrobeItem } from '@closet/types'
import type { OutfitLayer } from '../types'

interface OutfitItemsPreviewProps {
  className?: string
  items: WardrobeItem[]
  layers: OutfitLayer[]
}

export function OutfitItemsPreview({
  className = '',
  items,
  layers,
}: OutfitItemsPreviewProps) {
  const imageItems = layers
    .slice()
    .sort((left, right) => left.order - right.order)
    .flatMap((layer) => {
      const item = items.find(
        (candidate) => candidate.id === layer.wardrobeItemId,
      )
      const imageUrl = item?.imageUrl ?? item?.originalImageUrl

      return item && imageUrl ? [{ item, imageUrl }] : []
    })

  return (
    <div
      className={`flex items-center justify-center gap-1.5 overflow-hidden rounded-[1.5rem] bg-[#fbfaf6] p-3 shadow-[inset_0_0_0_1px_#dedad1] ${className}`}
      aria-label="코디 아이템 이미지"
    >
      {imageItems.length > 0 ? (
        imageItems.map(({ item, imageUrl }) => (
          <img
            src={imageUrl}
            alt={item.name}
            className="h-[88%] w-0 min-w-0 flex-1 object-contain"
            key={item.id}
          />
        ))
      ) : (
        <span className="text-xs font-bold text-muted">
          표시할 아이템 이미지가 없어요
        </span>
      )}
    </div>
  )
}
