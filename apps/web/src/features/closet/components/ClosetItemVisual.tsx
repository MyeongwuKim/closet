import type { WardrobeItem } from '@closet/types'
import { Footprints, Shirt } from 'lucide-react'

interface ClosetItemVisualProps {
  item: WardrobeItem
  compact?: boolean
}

export function ClosetItemVisual({
  item,
  compact = false,
}: ClosetItemVisualProps) {
  if (item.imageUrl) {
    return (
      <img
        src={item.imageUrl}
        alt={item.name}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain p-2"
      />
    )
  }

  if (item.category === 'bottom') {
    return (
      <span
        className={compact ? 'h-14 w-10' : 'h-24 w-16'}
        style={{
          backgroundColor: item.colorHex,
          clipPath:
            'polygon(0 0, 100% 0, 90% 100%, 56% 100%, 50% 43%, 44% 100%, 10% 100%)',
        }}
        aria-hidden="true"
      />
    )
  }

  if (item.category === 'shoes') {
    return (
      <Footprints
        size={compact ? 44 : 68}
        strokeWidth={1.3}
        style={{ color: item.colorHex }}
        aria-hidden="true"
      />
    )
  }

  return (
    <Shirt
      size={compact ? 54 : 82}
      strokeWidth={1.2}
      style={{ color: item.colorHex }}
      aria-hidden="true"
    />
  )
}
