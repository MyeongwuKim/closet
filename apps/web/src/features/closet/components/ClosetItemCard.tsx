import type { WardrobeItem } from '@closet/types'
import { Check, Plus } from 'lucide-react'
import { formatSeasonLabels } from '../../../constants/seasons'
import { closetCategoryLabels } from '../constants'
import { ClosetItemVisual } from './ClosetItemVisual'

interface ClosetItemCardProps {
  item: WardrobeItem
  isSelected: boolean
  onOpen: () => void
  onToggleSelection: () => void
}

export function ClosetItemCard({
  item,
  isSelected,
  onOpen,
  onToggleSelection,
}: ClosetItemCardProps) {
  return (
    <article
      className={`relative overflow-hidden rounded-3xl bg-surface p-2 text-left transition-shadow hover:shadow-sm ${
        isSelected
          ? 'ring-2 ring-accent ring-offset-2 ring-offset-canvas'
          : 'shadow-[inset_0_0_0_1px_#dedad1]'
      }`}
    >
      <button
        type="button"
        onClick={onToggleSelection}
        className={`absolute top-3.5 right-3.5 z-10 flex size-6 items-center justify-center rounded-full border shadow-sm ${
          isSelected
            ? 'border-accent bg-accent text-white'
            : 'border-line bg-white/90 text-muted hover:border-accent hover:text-accent'
        }`}
        aria-label={`${item.name} ${isSelected ? '선택 해제' : '코디로 선택'}`}
        aria-pressed={isSelected}
      >
        {isSelected ? <Check size={14} /> : <Plus size={14} />}
      </button>

      <button type="button" onClick={onOpen} className="block w-full text-left">
        <span className="flex aspect-square items-center justify-center overflow-hidden rounded-[1.25rem] bg-canvas">
          <ClosetItemVisual item={item} />
        </span>
        <span className="block px-2 pt-3 pb-2">
          <strong className="block truncate text-sm">{item.name}</strong>
          <span className="mt-1 block truncate text-xs text-muted">
            {item.classificationStatus === 'pending'
              ? 'AI 분류 대기'
              : `${item.subcategory ?? (item.category ? closetCategoryLabels[item.category] : '미분류')} · ${item.colorDetailName ?? item.colorName}${
                  item.seasons.length > 0
                    ? ` · ${formatSeasonLabels(item.seasons)}`
                    : ''
                }`}
          </span>
        </span>
      </button>
    </article>
  )
}
