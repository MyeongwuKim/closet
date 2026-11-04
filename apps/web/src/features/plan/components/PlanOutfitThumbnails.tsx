import type { WardrobeItem } from '@closet/types'
import { Plus } from 'lucide-react'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'
import { ArchivedWardrobeItemBadge } from '../../closet/components/ArchivedWardrobeItemBadge'

interface PlanOutfitThumbnailsProps {
  items: WardrobeItem[]
}

export function PlanOutfitThumbnails({ items }: PlanOutfitThumbnailsProps) {
  const slots = Array.from({ length: 4 }, (_, index) => items[index] ?? null)

  return (
    <span
      className="grid w-full max-w-[168px] min-w-0 grid-cols-4 gap-1.5 sm:max-w-none sm:gap-2"
      aria-label="아우터, 상의, 하의, 신발"
    >
      {slots.map((item, index) => (
        <span
          className={`relative flex aspect-square min-w-0 items-center justify-center overflow-hidden rounded-lg sm:rounded-xl ${
            item
              ? 'bg-canvas'
              : 'border border-dashed border-line bg-transparent text-muted'
          }`}
          key={item?.id ?? `empty-${index}`}
          title={item ? `${item.name}${item.archivedAt ? ' · 삭제된 옷' : ''}` : undefined}
        >
          {item ? <ClosetItemVisual item={item} compact /> : <Plus size={15} />}
          {item?.archivedAt && <ArchivedWardrobeItemBadge compact className="absolute inset-x-0 bottom-0 rounded-t-none" />}
        </span>
      ))}
    </span>
  )
}
