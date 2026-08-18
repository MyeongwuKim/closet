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
