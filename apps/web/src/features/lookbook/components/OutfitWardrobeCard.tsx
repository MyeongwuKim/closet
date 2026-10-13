import type { WardrobeItem } from '@closet/types'
import { Plus } from 'lucide-react'
import { WoodCardClip } from '../../../components/WoodCardClip'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'
import { closetCategoryLabels } from '../../closet/constants'
import './OutfitWardrobeCard.css'

interface OutfitWardrobeCardProps {
  item: WardrobeItem
  onSelect: (item: WardrobeItem) => void
  /** 현재 칸을 교체할 때는 추가 대신 바꾸기로 읽어준다. */
  actionLabel?: '추가' | '바꾸기'
}

/**
 * Look 편집 시트에서 보유 옷을 옷장의 집게 사진 카드로 보여준다.
 * 카드를 누르면 추가 또는 교체할 item을 부모에 전달하며, 옷 상세 화면은 열지 않는다.
 */
export function OutfitWardrobeCard({ item, onSelect, actionLabel = '추가' }: OutfitWardrobeCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="collection-clipped-card group block min-w-0 w-full text-left transition-transform hover:-translate-y-0.5 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      aria-label={actionLabel === '바꾸기' ? `${item.name} 아이템으로 바꾸기` : `${item.name} Look에 추가`}
    >
      <span className="collection-photo block">
        <WoodCardClip />
        <span className="archive-image wardrobe-image flex aspect-[4/5] items-center justify-center">
          <ClosetItemVisual item={item} />
        </span>
        <span className="outfit-wardrobe-card__add" aria-hidden="true">
          <Plus size={14} strokeWidth={2} />
        </span>
      </span>
      <span className="block px-0.5 pt-3 pb-1">
        <strong className="block truncate text-sm font-semibold leading-5 tracking-[-.025em]" title={item.name}>
          {item.name}
        </strong>
        {item.brandName && (
          <span className="mt-1 block truncate text-[10px] text-muted">
            {item.brandName}
          </span>
        )}
        <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
          <span
            className="size-2 shrink-0 rounded-full border border-ink/15"
            style={{ backgroundColor: item.colorHex }}
            aria-hidden="true"
          />
          <span className="truncate">
            {item.subcategory ?? (item.category ? closetCategoryLabels[item.category] : '미분류')} · {item.colorDetailName ?? item.colorName}
          </span>
        </span>
      </span>
    </button>
  )
}
