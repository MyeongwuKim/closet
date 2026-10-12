import { useState } from 'react'
import type { WardrobeItem } from '@closet/types'
import { OutfitCanvas } from './OutfitCanvas'
import type { OutfitSlot } from './outfitSlots'
import { OutfitWardrobePicker } from './OutfitWardrobePicker'

interface OutfitSlotEditorProps {
  items: WardrobeItem[]
  selectedItems: WardrobeItem[]
  onChange: (items: WardrobeItem[]) => void
  className?: string
}

/** 코디북·플래너의 구성 편집에서 가방과 착용 액세서리를 각각 고른다. 선택 완료 시 해당 칸의 아이템만 교체하고 변경된 코디를 부모에 전달한다. */
export function OutfitSlotEditor({
  items,
  selectedItems,
  onChange,
  className = '',
}: OutfitSlotEditorProps) {
  const [pickerSlot, setPickerSlot] = useState<OutfitSlot | null>(null)
  const layers = selectedItems.map((item, order) => ({
    wardrobeItemId: item.id,
    order,
  }))

  /** 현재 선택 칸만 교체한다. 원피스와 하의의 충돌은 정리하며 다른 칸의 소품은 유지한다. */
  const confirmSlotItems = (selectedItemIds: string[]) => {
    if (!pickerSlot) return

    const nextSlotItems = selectedItemIds.flatMap((itemId) => {
      const item = items.find((candidate) => candidate.id === itemId)
      return item ? [item] : []
    })
    let nextItems = selectedItems.filter((item) => !pickerSlot.matches(item))

    if (
      pickerSlot.id === 'top' &&
      nextSlotItems.some((item) => item.category === 'dress')
    ) {
      nextItems = nextItems.filter((item) => item.category !== 'bottom')
    }
    if (pickerSlot.id === 'bottom' && nextSlotItems.length > 0) {
      nextItems = nextItems.filter((item) => item.category !== 'dress')
    }

    onChange([...nextItems, ...nextSlotItems])
    setPickerSlot(null)
  }

  return (
    <>
      <OutfitCanvas
        items={selectedItems}
        layers={layers}
        className={className}
        onSlotClick={setPickerSlot}
      />
      {pickerSlot && (
        <OutfitWardrobePicker
          slot={pickerSlot}
          items={items}
          selectedItems={selectedItems}
          onClose={() => setPickerSlot(null)}
          onConfirm={confirmSlotItems}
        />
      )}
    </>
  )
}
