import type { WardrobeItem } from '@closet/types'
import { Check, Plus } from 'lucide-react'
import { WoodCardClip } from '../../../components/WoodCardClip'
import { formatSeasonLabels } from '../../../constants/seasons'
import { closetCategoryLabels } from '../constants'
import { ClosetItemVisual } from './ClosetItemVisual'

interface ClosetItemCardProps {
  item: WardrobeItem
  isSelected: boolean
  onOpen: () => void
  onToggleSelection: () => void
}

/** 옷 사진만 집게에 걸고 이름·브랜드·색상은 배경 위 캡션으로 표시한다. 사진과 캡션은 상세 열기, 별도 선택 버튼은 코디에 넣을 옷 선택을 부모에 요청한다. */
export function ClosetItemCard({
  item,
  isSelected,
  onOpen,
  onToggleSelection,
}: ClosetItemCardProps) {
  return (
    <article
      className={`collection-clipped-card group relative min-w-0 text-left ${
        isSelected
          ? 'rounded-2xl outline-2 outline-accent outline-offset-4'
          : ''
      }`}
    >
      <button
        type="button"
        onClick={onToggleSelection}
        className={`absolute top-5 right-3 z-10 flex size-8 items-center justify-center rounded-full border ${
          isSelected
            ? 'border-accent bg-accent text-white'
            : 'border-line bg-surface text-muted hover:border-accent hover:text-accent'
        }`}
        aria-label={`${item.name} ${isSelected ? '선택 해제' : '코디로 선택'}`}
        aria-pressed={isSelected}
      >
        {isSelected ? <Check size={14} /> : <Plus size={14} />}
      </button>

      <button type="button" onClick={onOpen} className="block w-full text-left">
        <span className="collection-photo block">
          <WoodCardClip />
          <span className="archive-image wardrobe-image flex aspect-[4/5] items-center justify-center transition-colors">
            <ClosetItemVisual item={item} />
          </span>
        </span>
        <span className="block px-0.5 pt-3 pb-1">
          <strong className="line-clamp-2 text-sm font-semibold leading-5 tracking-[-.025em]">{item.name}</strong>
          {item.brandName && <span className="mt-1 block truncate text-[10px] text-muted">{item.brandName}</span>}
          <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
            <span className="size-2 shrink-0 rounded-full border border-ink/15" style={{ backgroundColor: item.colorHex }} aria-hidden="true" />
            <span className="truncate">
            {item.classificationStatus === 'pending'
              ? 'AI 분류 대기'
              : `${item.subcategory ?? (item.category ? closetCategoryLabels[item.category] : '미분류')} · ${item.colorDetailName ?? item.colorName}${
                  item.seasons.length > 0
                    ? ` · ${formatSeasonLabels(item.seasons)}`
                    : ''
                }`}
            </span>
          </span>
        </span>
      </button>
    </article>
  )
}
