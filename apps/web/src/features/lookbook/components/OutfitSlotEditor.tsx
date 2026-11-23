import { useState } from 'react'
import type { WardrobeItem } from '@closet/types'
import { OutfitCanvas } from './OutfitCanvas'
import type { OutfitSlot } from './outfitSlots'
import type { OutfitWardrobeItem } from '../types'
import { OutfitBaseLayerControl } from './OutfitBaseLayerControl'
import { OutfitWardrobePicker } from './OutfitWardrobePicker'
import { applyOutfitLayerSlot, getOutfitLayerSlot } from '../utils/outfitSelection'

interface OutfitSlotEditorProps {
  items: WardrobeItem[]
  selectedItems: OutfitWardrobeItem[]
  onChange: (items: OutfitWardrobeItem[]) => void
  className?: string
  /** 착용 완료한 날짜에서는 저장된 구성을 표시하고 교체 화면을 열지 않는다. */
  readOnly?: boolean
  /** 저장된 코디에 남은 삭제된 옷을 사진과 배지로 표시한다. 선택 목록에는 다시 넣지 않는다. */
  showArchivedStatus?: boolean
  allowAdditionalLayers?: boolean
  allowBaseLayers?: boolean
}

/** 코디북·플래너의 구성 편집에서 가방과 착용 액세서리를 각각 고른다. 선택 완료 시 해당 칸의 아이템만 교체하고 변경된 코디를 부모에 전달한다. */
export function OutfitSlotEditor({
  items,
  selectedItems,
  onChange,
  className = '',
  readOnly = false,
  showArchivedStatus = false,
  allowAdditionalLayers = false,
  allowBaseLayers = false,
}: OutfitSlotEditorProps) {
  const [pickerSlot, setPickerSlot] = useState<OutfitSlot | null>(null)
  const mainItems = selectedItems.filter((item) => !item.isBaseLayer)
  const layers = mainItems.map((item, order) => ({
    wardrobeItemId: item.id,
    order,
  }))

  /** 현재 선택 칸만 교체한다. 원피스와 하의의 충돌은 정리하며 다른 칸의 소품은 유지한다. */
  const confirmSlotItems = (selectedItemIds: string[]) => {
    if (!pickerSlot) return

    const nextSlotItems = selectedItemIds.flatMap((itemId) => {
      const item = items.find((candidate) => candidate.id === itemId)
      if (!item) return []
      const slot = allowAdditionalLayers ? getOutfitLayerSlot(item, pickerSlot.id) : undefined
      return [applyOutfitLayerSlot(item, slot)]
    })
    let nextItems = selectedItems.filter((item) => item.isBaseLayer || !pickerSlot.matches(item))

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

  const showsBaseLayerControl = !readOnly && allowBaseLayers
  const canvas = (
    <OutfitCanvas
      items={mainItems}
      layers={layers}
      className={showsBaseLayerControl ? 'min-h-0 w-full flex-1' : className}
      onSlotClick={readOnly ? undefined : setPickerSlot}
      showArchivedStatus={showArchivedStatus}
    />
  )
  return (
    <>
      {showsBaseLayerControl ? (
        <div className={`flex min-h-0 flex-col ${className}`}>
          <div className="mx-auto w-fit shrink-0">
            <OutfitBaseLayerControl items={items} selectedItems={selectedItems} onChange={(baseLayers) => onChange([...baseLayers, ...mainItems])} />
          </div>
          {canvas}
        </div>
      ) : canvas}
      {!readOnly && pickerSlot && (
        <OutfitWardrobePicker
          slot={pickerSlot}
          items={items}
          selectedItems={selectedItems}
          allowAdditionalLayers={allowAdditionalLayers}
          onClose={() => setPickerSlot(null)}
          onConfirm={confirmSlotItems}
        />
      )}
    </>
  )
}
