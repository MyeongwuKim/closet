import type { WardrobeItem } from '@closet/types'
import { ClothingCategoryIcon } from '../../../components/ClothingCategoryIcon'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'
import { ArchivedWardrobeItemBadge } from '../../closet/components/ArchivedWardrobeItemBadge'
import type { OutfitLayer, OutfitWardrobeItem } from '../types'
import { outfitSlots, type OutfitSlot } from './outfitSlots'

interface OutfitCanvasProps {
  items: WardrobeItem[]
  layers: OutfitLayer[]
  baseLayers?: OutfitWardrobeItem[]
  className?: string
  onItemClick?: (item: WardrobeItem) => void
  onSlotClick?: (slot: OutfitSlot) => void
  /** 저장된 코디에서는 옷장에 없는 옷도 표시하고 삭제 상태를 사진 위에 알린다. */
  showArchivedStatus?: boolean
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
  showArchivedStatus,
}: {
  slot: OutfitSlot
  selectedItems: SelectedItem[]
  onItemClick?: (item: WardrobeItem) => void
  onSlotClick?: (slot: OutfitSlot) => void
  showArchivedStatus?: boolean
}) {
  const slotItem = selectedItems
    .filter(({ item }) => slot.matches(item))
    .sort((left, right) => left.order - right.order)
    .slice(0, slot.limit ?? 1)
  const hasMultipleItems = slotItem.length > 1
  const isEmpty = slotItem.length === 0
  const visibleItems =
    slot.id === 'accessory' && hasMultipleItems ? slotItem.slice(0, 1) : slotItem
  const label = slotItem[0]?.item.category === 'dress' ? '원피스' : slot.label

  return (
    <div
      role="group"
      aria-label={label}
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
        <span className="pointer-events-none absolute inset-x-0 top-0 bottom-8 flex flex-col items-center justify-center gap-1.5 text-muted" aria-hidden="true">
          {onSlotClick ? (
            <>
              <span className="flex size-7 items-center justify-center rounded-full border border-line bg-surface/80 transition-colors group-hover:border-accent/30 group-hover:text-accent sm:size-8">
                <ClothingCategoryIcon
                  category={slot.iconCategory}
                  size={17}
                  strokeWidth={1.6}
                />
              </span>
              <span className="text-xs font-medium">추가하기</span>
            </>
          ) : <span className="text-xs">선택한 옷 없음</span>}
        </span>
      ) : (
        <span
          className={`absolute inset-x-1 top-1 bottom-8 flex items-center justify-center overflow-hidden rounded-t-xl ${
            hasMultipleItems ? 'gap-0.5' : ''
          }`}
        >
          {visibleItems.map(({ item }) => {
            const itemClassName = `relative flex h-full min-w-0 items-center justify-center rounded-xl ${
              visibleItems.length > 1 ? 'w-1/2' : 'w-full'
            }`
            const itemVisual = (
              <>
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
                {showArchivedStatus && item.archivedAt && <ArchivedWardrobeItemBadge className="absolute top-0.5 left-1/2 z-20 -translate-x-1/2" />}
              </>
            )

            return onItemClick && !item.archivedAt ? (
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
              <span className={itemClassName} title={item.name} aria-label={`${item.name}${item.archivedAt ? ', 삭제된 옷' : ''}`} key={item.id}>
                {itemVisual}
              </span>
            )
          })}
        </span>
      )}

      <span className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex h-8 items-center justify-center border-t px-1 text-center text-xs font-bold ${
        isEmpty ? 'border-line/60 text-muted' : 'border-line/40 bg-white/75 text-ink'
      }`}>
        {label}
        {hasMultipleItems ? ` · ${slotItem.length}` : ''}
      </span>
    </div>
  )
}

export function OutfitCanvas({
  items,
  layers,
  baseLayers = [],
  className = '',
  onItemClick,
  onSlotClick,
  showArchivedStatus = false,
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
      {/* 이너 목록이 있으면 옷 칸의 폭을 줄여 목록 공간을 확보하고, 짧은 화면에서는 스크롤한다. */}
      <div className={`my-auto min-w-[min(100%,16rem)] max-w-xl shrink-0 rounded-[1.5rem] bg-[#efede6] p-3 shadow-[inset_0_0_0_1px_#dedad1] ${
        baseLayers.length > 0 ? 'w-[min(100cqw,calc((100cqh-8rem)*0.68))]' : 'w-[min(100cqw,calc((100cqh-2rem)*0.68))]'
      }`}>
        <div className="pointer-events-none mb-5 flex h-7 items-center justify-between gap-2 px-1">
          <span className="text-xs font-bold tracking-tight text-ink/75">코디 구성</span>
          <span className="rounded-full border border-line/70 bg-white/60 px-2.5 py-1 text-xs font-medium tabular-nums text-muted">
            {selectedItems.length + baseLayers.length}개 아이템
          </span>
        </div>

        <div className="grid grid-cols-3 grid-rows-7 gap-x-3 gap-y-2">
          {outfitSlots.map((slot) => (
            <OutfitItemTile
              slot={slot}
              selectedItems={selectedItems}
              onItemClick={onItemClick}
              onSlotClick={onSlotClick}
              showArchivedStatus={showArchivedStatus}
              key={slot.id}
            />
          ))}
        </div>

        {baseLayers.length > 0 && (
          <div role="group" aria-label="받쳐 입는 옷" className="mt-3 border-t border-line pt-3">
            <p className="px-1 text-xs font-bold text-ink">받쳐 입는 옷</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {baseLayers.map((item) => (
                <li key={item.id} className="flex max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-line bg-surface py-0.5 pr-2 text-xs">
                  <span className="grid size-8 shrink-0 place-items-center [&_img]:p-0.5 [&_svg]:size-5" aria-hidden="true">
                    <ClosetItemVisual item={item} compact />
                  </span>
                  <span className="min-w-0 break-words">{item.name}</span>
                  {showArchivedStatus && item.archivedAt && <ArchivedWardrobeItemBadge compact />}
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>
    </div>
  )
}
