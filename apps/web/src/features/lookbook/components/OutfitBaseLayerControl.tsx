import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { MAX_OUTFIT_ITEMS, type WardrobeItem } from '@closet/types'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'
import type { OutfitWardrobeItem } from '../types'
import { OutfitWardrobePicker } from './OutfitWardrobePicker'
import type { OutfitSlot } from './outfitSlots'

const baseLayerSlot: OutfitSlot = {
  id: 'top',
  label: '받쳐 입는 옷',
  iconCategory: 'top',
  matches: (item) => item.category === 'top',
  position: '',
}

/** 상의 칸 아래에서 받쳐 입는 옷을 고른다. 이미 다른 칸에 담긴 옷은 중복 선택할 수 없다. */
export function OutfitBaseLayerControl({
  items,
  selectedItems,
  onChange,
}: {
  items: WardrobeItem[]
  selectedItems: OutfitWardrobeItem[]
  onChange: (layers: OutfitWardrobeItem[]) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const baseLayers = selectedItems.filter((item) => item.isBaseLayer)
  const mainIds = new Set(selectedItems.filter((item) => !item.isBaseLayer).map((item) => item.id))
  const availableItems = items.filter((item) => !mainIds.has(item.id))

  const closePicker = () => {
    setIsOpen(false)
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }))
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className="inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-1 rounded-md text-xs font-medium text-accent hover:bg-sage/40 focus-visible:outline-2 focus-visible:outline-accent"
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
      >
        {baseLayers.length ? (
          <>
            <span className="flex shrink-0" aria-hidden="true">
              {baseLayers.slice(0, 2).map((item) => (
                <span key={item.id} className="grid size-5 place-items-center overflow-hidden [&>img]:p-0 [&>svg]:size-full">
                  <ClosetItemVisual item={item} compact />
                </span>
              ))}
            </span>
            <span>받쳐 입는 옷 {baseLayers.length}개</span>
          </>
        ) : (
          <>
            <Plus size={14} className="shrink-0" aria-hidden="true" />
            <span>받쳐 입는 옷 추가</span>
          </>
        )}
      </button>
      {isOpen && (
        <OutfitWardrobePicker
          slot={baseLayerSlot}
          items={availableItems}
          selectedItems={baseLayers}
          maxSelections={MAX_OUTFIT_ITEMS - mainIds.size}
          orderSelections
          onClose={closePicker}
          onConfirm={(ids) => {
            const byId = new Map([...baseLayers, ...availableItems].map((item) => [item.id, item]))
            onChange(ids.flatMap((id) => {
              const item = byId.get(id)
              return item ? [{ ...item, isBaseLayer: true }] : []
            }))
            closePicker()
          }}
        />
      )}
    </>
  )
}
