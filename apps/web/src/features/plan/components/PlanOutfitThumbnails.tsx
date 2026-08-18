import type { WardrobeItem } from '@closet/types'
import { Plus } from 'lucide-react'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'

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
          className={`flex aspect-square min-w-0 items-center justify-center overflow-hidden rounded-lg sm:rounded-xl ${
            item
              ? 'bg-canvas'
              : 'border border-dashed border-line bg-transparent text-muted'
          }`}
          key={item?.id ?? `empty-${index}`}
        >
          {item ? <ClosetItemVisual item={item} compact /> : <Plus size={15} />}
        </span>
      ))}
    </span>
  )
}
