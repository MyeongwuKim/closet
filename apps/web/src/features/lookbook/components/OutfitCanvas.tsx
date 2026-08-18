import type { WardrobeItem } from '@closet/types'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'
import type { OutfitLayer } from '../types'
import { outfitSlots, type OutfitSlot } from './outfitSlots'

interface OutfitCanvasProps {
  items: WardrobeItem[]
  layers: OutfitLayer[]
  className?: string
  onItemClick?: (item: WardrobeItem) => void
  onSlotClick?: (slot: OutfitSlot) => void
}

interface SelectedItem {
  item: WardrobeItem
  order: number
}

function OutfitMannequin() {
  return (
    <svg
      viewBox="0 0 391 782"
      className="absolute top-[5%] left-1/2 h-[90%] w-[82%] -translate-x-1/2 text-[#436990]"
      aria-hidden="true"
    >
      <g fill="currentColor">
        <circle cx="195.5" cy="88" r="60" />
        <path d="M128 162h135c41.4 0 75 33.6 75 75v186.5c0 14.6-11.8 26.5-26.5 26.5S285 438.2 285 423.5V257h-12v461c0 19.9-15.9 36-35.5 36S202 737.9 202 718V451h-14v267c0 19.9-15.9 36-35.5 36S117 737.9 117 718V257h-11v166.5c0 14.6-11.8 26.5-26.5 26.5S53 438.2 53 423.5V237c0-41.4 33.6-75 75-75Z" />
      </g>
    </svg>
  )
}

function OutfitItemTile({
  slot,
  selectedItems,
  onItemClick,
  onSlotClick,
}: {
  slot: OutfitSlot
  selectedItems: SelectedItem[]
  onItemClick?: (item: WardrobeItem) => void
  onSlotClick?: (slot: OutfitSlot) => void
}) {
  const slotItem = selectedItems
    .filter(({ item }) => slot.matches(item))
    .sort((left, right) => left.order - right.order)
    .slice(0, slot.limit ?? 1)
  const hasMultipleItems = slotItem.length > 1
  const visibleItems =
    slot.id === 'accessory' && hasMultipleItems ? slotItem.slice(0, 1) : slotItem

  return (
    <div
      className={`group absolute aspect-[4/5] w-[28%] overflow-hidden rounded-2xl border ${
        slot.onBody
          ? 'border-dashed border-line bg-white/72 shadow-sm backdrop-blur-sm'
          : 'border-line bg-white/88 shadow-sm backdrop-blur-sm'
      } ${slot.position}`}
    >
      {onSlotClick && (
        <button
          type="button"
          onClick={() => onSlotClick(slot)}
          className="absolute inset-0 z-30 rounded-2xl transition hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[-2px]"
          aria-label={`${slot.label} ${slotItem.length > 0 ? '교체하기' : '고르기'}`}
        />
      )}
      {slotItem.length === 0 ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center pb-7 text-lg font-light text-muted/25 transition group-hover:text-accent/60 sm:text-2xl">
          +
        </span>
      ) : (
        <span
          className={`absolute inset-x-1 top-1 bottom-7 flex items-center justify-center ${
            hasMultipleItems ? 'gap-0.5' : ''
          }`}
        >
          {visibleItems.map(({ item }) => {
            const itemClassName = `flex h-full min-w-0 items-center justify-center rounded-xl ${
              visibleItems.length > 1 ? 'w-1/2' : 'w-full'
            }`
            const itemVisual = (
              <span
                className={`flex size-full items-center justify-center ${
                  item.imageUrl ? 'scale-[1.4]' : 'scale-[1.12]'
                }`}
              >
                <ClosetItemVisual
                  item={item}
                  compact={visibleItems.length > 1 || !slot.onBody}
                />
              </span>
            )

            return onItemClick ? (
              <button
                type="button"
                onClick={() => onItemClick(item)}
                className={`${itemClassName} transition hover:bg-accent/8 focus-visible:outline-2 focus-visible:outline-accent`}
                aria-label={`${item.name} 상세 보기`}
                key={item.id}
              >
                {itemVisual}
              </button>
            ) : (
              <span className={itemClassName} key={item.id}>
                {itemVisual}
              </span>
            )
          })}
        </span>
      )}

      <span className="pointer-events-none absolute right-1 bottom-1 left-1 z-20 truncate rounded-lg bg-white/94 px-1.5 py-1 text-center text-[11px] leading-none font-extrabold text-ink shadow-sm backdrop-blur sm:text-xs">
        {slotItem[0]?.item.category === 'dress' ? '원피스' : slot.label}
        {hasMultipleItems ? ` · ${slotItem.length}` : ''}
      </span>
    </div>
  )
}

export function OutfitCanvas({
  items,
  layers,
  className = '',
  onItemClick,
  onSlotClick,
}: OutfitCanvasProps) {
  const selectedItems = layers.flatMap((layer) => {
    const item = items.find(
      (candidate) => candidate.id === layer.wardrobeItemId,
    )
    return item ? [{ item, order: layer.order }] : []
  })

  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-[1.5rem] bg-[#fbfaf6] p-3 shadow-[inset_0_0_0_1px_#dedad1] sm:p-5 ${className}`}
      aria-label="코디 미리보기"
    >
      <div className="relative h-full max-h-[42rem] w-full max-w-2xl">
        <OutfitMannequin />

        {outfitSlots.map((slot) => (
          <OutfitItemTile
            slot={slot}
            selectedItems={selectedItems}
            onItemClick={onItemClick}
            onSlotClick={onSlotClick}
            key={slot.id}
          />
        ))}
      </div>
    </div>
  )
}
