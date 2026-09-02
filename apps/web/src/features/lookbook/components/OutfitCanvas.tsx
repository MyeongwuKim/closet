import type { WardrobeItem } from '@closet/types'
import { ClothingCategoryIcon } from '../../../components/ClothingCategoryIcon'
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
  const isEmpty = slotItem.length === 0
  const visibleItems =
    slot.id === 'accessory' && hasMultipleItems ? slotItem.slice(0, 1) : slotItem

  return (
    <div
      className={`group relative row-span-2 aspect-[4/5] min-w-0 overflow-hidden rounded-2xl border transition-[border-color,box-shadow] ${
        isEmpty
          ? 'border-dashed border-[#cdc7ba] bg-white/35'
          : 'border-white bg-surface shadow-[0_4px_16px_-7px_rgba(57,48,32,0.24)]'
      } ${
        onSlotClick || onItemClick
          ? 'hover:border-accent/40 focus-within:border-accent/60'
          : ''
      } ${slot.position}`}
    >
      {onSlotClick && (
        <button
          type="button"
          onClick={() => onSlotClick(slot)}
          className="absolute inset-0 z-30 rounded-2xl transition-colors hover:bg-accent/5 active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[-2px]"
          aria-label={`${slot.label} ${slotItem.length > 0 ? '교체하기' : '고르기'}`}
        />
      )}
      {isEmpty ? (
        <span className="pointer-events-none absolute inset-x-0 top-0 bottom-8 flex flex-col items-center justify-center gap-1.5 text-muted/70" aria-hidden="true">
          {onSlotClick ? (
            <>
              <span className="flex size-7 items-center justify-center rounded-full border border-line bg-surface/80 transition-colors group-hover:border-accent/30 group-hover:text-accent sm:size-8">
                <ClothingCategoryIcon
                  category={slot.iconCategory}
                  size={17}
                  strokeWidth={1.6}
                />
              </span>
              <span className="text-[10px] font-medium sm:text-xs">추가하기</span>
            </>
          ) : <span className="text-[10px] sm:text-xs">선택한 옷 없음</span>}
        </span>
      ) : (
        <span
          className={`absolute inset-x-1 top-1 bottom-8 flex items-center justify-center overflow-hidden rounded-t-xl ${
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
                  item.imageUrl ? 'scale-[1.25] [&_img]:p-1' : 'scale-[1.12]'
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

      <span className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex h-8 items-center justify-center border-t px-1 text-center text-[11px] font-bold sm:text-xs ${
        isEmpty ? 'border-line/60 text-muted' : 'border-line/40 bg-white/75 text-ink'
      }`}>
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
      className={`flex flex-col items-center overflow-y-auto [container-type:size] ${className}`}
      aria-label="코디 미리보기"
    >
      {/* 3열·7행이 높이 안에 들어오도록 폭도 줄이되, 짧은 화면에서는 스크롤한다. */}
      <div className="my-auto w-[min(100cqw,calc((100cqh-2rem)*0.68))] min-w-[min(100%,16rem)] max-w-xl shrink-0 rounded-[1.5rem] bg-[#efede6] p-3 shadow-[inset_0_0_0_1px_#dedad1]">
        <div className="pointer-events-none mb-5 flex h-7 items-center justify-between gap-2 px-1">
          <span className="text-xs font-bold tracking-tight text-ink/75">코디 구성</span>
          <span className="rounded-full border border-line/70 bg-white/60 px-2.5 py-1 text-[10px] font-medium tabular-nums text-muted">
            {selectedItems.length}개 아이템
          </span>
        </div>

        <div className="grid grid-cols-3 grid-rows-7 gap-x-3 gap-y-2">
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
    </div>
  )
}
