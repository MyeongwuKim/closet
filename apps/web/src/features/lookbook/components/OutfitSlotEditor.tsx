import { useState } from 'react'
import type { WardrobeItem } from '@closet/types'
import { ComposerLookCanvas } from './ComposerLookCanvas'
import { OutfitCanvas } from './OutfitCanvas'
import { outfitSlots, type OutfitSlot } from './outfitSlots'
import type { OutfitWardrobeItem } from '../types'
import { OutfitBaseLayerControl } from './OutfitBaseLayerControl'
import { OutfitWardrobePicker } from './OutfitWardrobePicker'
import { applyOutfitLayerSlot, getOutfitLayerSlot, type OutfitSelectionCategory } from '../utils/outfitSelection'
import './OutfitStylingLayout.css'

interface OutfitSlotEditorProps {
  items: WardrobeItem[]
  selectedItems: OutfitWardrobeItem[]
  onChange: (items: OutfitWardrobeItem[]) => void
  className?: string
  /** 착용 완료한 날짜에서는 저장된 구성을 표시하고 교체 화면을 열지 않는다. */
  readOnly?: boolean
  /** 저장된 코디에 남은 삭제된 옷을 사진과 배지로 표시한다. 선택 목록에는 다시 넣지 않는다. */
  showArchivedStatus?: boolean
  /** 코디북에서는 새 코디 만들기와 같은 보드를 사용한다. */
  variant?: 'planner' | 'lookbook'
  lookName?: string
}

/** 코디북·플래너의 구성 편집에서 가방과 착용 액세서리를 각각 고른다. 선택 완료 시 해당 칸의 아이템만 교체하고 변경된 코디를 부모에 전달한다. */
export function OutfitSlotEditor({
  items,
  selectedItems,
  onChange,
  className = '',
  readOnly = false,
  showArchivedStatus = false,
  variant = 'planner',
  lookName,
}: OutfitSlotEditorProps) {
  const [pickerSlot, setPickerSlot] = useState<OutfitSlot | null>(null)
  const isLookbook = variant === 'lookbook'
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
      const slot = isLookbook ? getOutfitLayerSlot(item, pickerSlot.id) : undefined
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

  const openComposerSlot = (category: OutfitSelectionCategory) => {
    const slotId = category === 'dress' ? 'top' : category
    setPickerSlot(outfitSlots.find((slot) => slot.id === slotId) ?? null)
  }

  return (
    <>
      {isLookbook && !readOnly ? (
        <div className={`outfit-styling-layout outfit-styling-layout--board-only ${className}`} inert={pickerSlot !== null}>
          <div className="outfit-styling-layout__stage scrollbar-hidden">
            <div className="outfit-styling-layout__stage-inner">
              <ComposerLookCanvas
                selectedItems={selectedItems}
                lookLabel="EDIT LOOK"
                lookName={lookName}
                onSlotSelect={openComposerSlot}
                onItemRemove={(item) => onChange(selectedItems.filter((selected) => selected.id !== item.id))}
                baseLayerControl={(
                  <OutfitBaseLayerControl
                    items={items}
                    selectedItems={selectedItems}
                    onChange={(baseLayers) => onChange([...baseLayers, ...mainItems])}
                  />
                )}
              />
            </div>
          </div>
        </div>
      ) : (
        <OutfitCanvas
          items={mainItems}
          layers={layers}
          baseLayers={selectedItems.filter((item) => item.isBaseLayer)}
          className={className}
          onSlotClick={readOnly ? undefined : setPickerSlot}
          showArchivedStatus={showArchivedStatus}
        />
      )}
      {!readOnly && pickerSlot && (
        <OutfitWardrobePicker
          slot={pickerSlot}
          items={items}
          selectedItems={selectedItems}
          allowAdditionalLayers={isLookbook}
          onClose={() => setPickerSlot(null)}
          onConfirm={confirmSlotItems}
        />
      )}
    </>
  )
}
