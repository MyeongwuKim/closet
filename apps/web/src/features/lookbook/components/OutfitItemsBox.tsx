import type { WardrobeItem } from '@closet/types'
import { PackageOpen } from 'lucide-react'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'
import { ArchivedWardrobeItemBadge } from '../../closet/components/ArchivedWardrobeItemBadge'

interface OutfitItemsBoxProps {
  outfitName: string
  /** 코디 레이어 순서로 정리한 옷. 조회되지 않은 옷은 호출한 쪽에서 제외한다. */
  items: WardrobeItem[]
  className?: string
}

/**
 * 코디를 구성하는 옷 사진을 표지 위의 콜라주로 펼쳐 표시한다.
 * 카드 크기에 맞춰 최대 여섯 개를 표시하고, 남은 개수는 마지막 칸의 작은 라벨에 표시한다.
 * 삭제된 옷도 사진과 배지로 유지한다. 옷이 하나면 표지 전체를 사용하며 정보가 없으면 안내한다.
 */
export function OutfitItemsBox({ outfitName, items, className = '' }: OutfitItemsBoxProps) {
  const visibleItems = items.slice(0, 6)
  const hiddenCount = items.length - visibleItems.length

  if (items.length === 0) {
    return (
      <div className={`outfit-items-box outfit-items-box-empty ${className}`}>
        <PackageOpen size={28} strokeWidth={1.3} aria-hidden="true" />
        <span className="text-[11px] text-muted">옷 정보가 없어요</span>
      </div>
    )
  }

  return (
    <div
      className={`outfit-items-box ${className}`}
      data-single-item={visibleItems.length === 1}
      style={{ gridTemplateRows: `repeat(${Math.ceil(visibleItems.length / 2)}, minmax(0, 1fr))` }}
      aria-label={`${outfitName} 코디 아이템`}
    >
      {visibleItems.map((item, index) => (
        <span className="outfit-item-compartment relative" aria-label={`${item.name}${item.archivedAt ? ', 삭제된 옷' : ''}`} key={`${item.id}-${index}`}>
          <ClosetItemVisual item={item} compact />
          {item.archivedAt && <ArchivedWardrobeItemBadge compact className="absolute top-1 left-1" />}
          {hiddenCount > 0 && index === visibleItems.length - 1 && (
            <span className="outfit-item-extra-count">+{hiddenCount}</span>
          )}
        </span>
      ))}
    </div>
  )
}
