import type { WardrobeItem } from '@closet/types'
import { Plus, X } from 'lucide-react'
import { ClothingCategoryIcon } from '../../../components/ClothingCategoryIcon'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'
import type { OutfitSelectionCategory } from '../utils/outfitSelection'
import { outfitSlots, type OutfitSlot } from './outfitSlots'
import './ComposerLookCanvas.css'

interface ComposerLookCanvasProps {
  /** 현재 편집 중인 코디에 담긴 옷. 배열 순서를 선택 아이템 목록에도 그대로 사용한다. */
  selectedItems: WardrobeItem[]
  /** 저장된 번호가 아닌 편집 화면의 표지 문구. 기본값은 NEW LOOK이다. */
  lookLabel?: string
  /** 표지에 표시할 임시 코디 이름. 비어 있으면 기본 제목을 표시한다. */
  lookName?: string
  /** 빈 칸 또는 채워진 칸에서 아이템을 더 고를 수 있는 종류. 생략하면 모든 종류를 선택할 수 있다. */
  selectableCategories?: OutfitSelectionCategory[]
  /** 모바일 옷장 시트가 열린 동안 접힌 선택 목록의 제거 버튼을 Tab 순서에서 뺀다. */
  isSelectedListInert?: boolean
  className?: string
  /** 칸을 누르면 해당 종류의 옷장을 열도록 부모에 전달한다. 선택된 옷의 교체나 저장은 여기서 수행하지 않는다. */
  onSlotSelect?: (category: OutfitSelectionCategory) => void
  /** 아래 선택 아이템 목록에서 빼기 버튼을 누르면 해당 옷을 부모에 전달한다. */
  onItemRemove?: (item: WardrobeItem) => void
}

function ComposerLookSlot({
  slot,
  items,
  canSelect,
  canSelectDress,
  onSelect,
}: {
  slot: OutfitSlot
  items: WardrobeItem[]
  canSelect: boolean
  canSelectDress: boolean
  onSelect?: (category: OutfitSelectionCategory) => void
}) {
  const isEmpty = items.length === 0
  const isDress = slot.id === 'top' && items[0]?.category === 'dress'
  const label = isDress ? '원피스' : isEmpty && canSelectDress ? '상의·원피스' : slot.label
  const category = isDress ? 'dress' : slot.id
  const itemNames = items.map((item) => item.name).join(', ')

  return (
    <div
      className={`composer-look-canvas__slot composer-look-canvas__slot--${slot.id}${isDress ? ' composer-look-canvas__slot--dress' : ''}`}
      data-empty={isEmpty}
      data-multiple={items.length > 1}
    >
      {items.length > 0 && (
        <span className="composer-look-canvas__slot-visual" aria-hidden="true">
          {items.map((item) => (
            <span className="composer-look-canvas__visual-item" key={item.id}>
              <ClosetItemVisual item={item} compact={!slot.onBody} />
            </span>
          ))}
        </span>
      )}
      <span className="composer-look-canvas__slot-caption" aria-hidden="true">
        {isEmpty && <Plus size={12} strokeWidth={1.6} />}
        {label}
        {items.length > 1 && <span>· {items.length}</span>}
      </span>
      {isEmpty && (
        <span className="composer-look-canvas__empty-mark" aria-hidden="true">
          <ClothingCategoryIcon category={slot.iconCategory} size={22} strokeWidth={1.25} />
        </span>
      )}
      {canSelect && onSelect && (
        <button
          type="button"
          className="composer-look-canvas__slot-action"
          onClick={() => onSelect(category)}
          aria-label={
            isEmpty
              ? `${label} 아이템 고르기`
              : `${itemNames}, ${label} 아이템 바꾸기`
          }
        />
      )}
    </div>
  )
}

/**
 * 코디 맞춰보기의 편집 중인 조합을 한 장의 룩북 페이지로 표시한다.
 * 상의·하의·신발을 가운데에, 아우터·소품을 주변에 배치하고 원피스는 상·하의 자리를 함께 쓴다.
 * 칸 선택과 아이템 제거는 부모 콜백에 전달하며 데이터 조회나 저장은 수행하지 않는다.
 */
export function ComposerLookCanvas({
  selectedItems,
  lookLabel = 'NEW LOOK',
  lookName,
  selectableCategories,
  isSelectedListInert = false,
  className = '',
  onSlotSelect,
  onItemRemove,
}: ComposerLookCanvasProps) {
  const hasDress = selectedItems.some((item) => item.category === 'dress')
  const title = lookName?.trim() || '새로운 코디'

  return (
    <section className={`composer-look-canvas ${className}`} aria-label="편집 중인 코디">
      <div className="composer-look-canvas__paper">
        <div className="composer-look-canvas__masthead" aria-hidden="true">
          <span>WEARROOM</span>
          <span>MY STYLE JOURNAL</span>
        </div>
        <div className="composer-look-canvas__heading">
          <div className="composer-look-canvas__heading-copy">
            <span className="composer-look-canvas__look-label">{lookLabel}</span>
            <h2 title={title}>{title}</h2>
          </div>
          <span className="composer-look-canvas__piece-count">
            {String(selectedItems.length).padStart(2, '0')} PIECES
          </span>
        </div>

        <div
          className="composer-look-canvas__composition"
          role="group"
          aria-label={`${title} 조합 보드: ${selectedItems.length > 0 ? selectedItems.map((item) => item.name).join(', ') : '선택한 옷 없음'}`}
        >
          {outfitSlots.map((slot) => {
            if (hasDress && slot.id === 'bottom') return null
            const slotItems = selectedItems.filter(slot.matches).slice(0, slot.limit ?? 1)
            const slotCategory = slot.id === 'top' && slotItems[0]?.category === 'dress'
              ? 'dress'
              : slot.id
            const canSelect = slotItems.length > 0 || !selectableCategories || selectableCategories.includes(slotCategory)

            return (
              <ComposerLookSlot
                key={slot.id}
                slot={slot}
                items={slotItems}
                canSelect={canSelect}
                canSelectDress={slot.id === 'top' && Boolean(selectableCategories?.includes('dress'))}
                onSelect={onSlotSelect}
              />
            )
          })}
          <span className="composer-look-canvas__stage-note" aria-hidden="true">
            STYLE IT<br />YOUR WAY
          </span>
          <span className="composer-look-canvas__stage-rule" aria-hidden="true" />
        </div>

        <div className="composer-look-canvas__footnote" aria-hidden="true">
          <span>CURATED FROM YOUR CLOSET</span>
          <span>WEARROOM / LOOKBOOK</span>
        </div>
      </div>

      {selectedItems.length > 0 ? (
        <div className="composer-look-canvas__selected" aria-label="현재 코디에 담긴 아이템" aria-hidden={isSelectedListInert} inert={isSelectedListInert}>
          <span className="composer-look-canvas__selected-label">IN THIS LOOK</span>
          <ul className="composer-look-canvas__selected-list">
            {selectedItems.map((item) => (
              <li className="composer-look-canvas__selected-chip" key={item.id}>
                <span
                  className="composer-look-canvas__swatch"
                  style={{ backgroundColor: item.colorHex }}
                  aria-hidden="true"
                />
                <span className="composer-look-canvas__selected-name" title={item.name}>{item.name}</span>
                {onItemRemove && (
                  <button
                    type="button"
                    onClick={() => onItemRemove(item)}
                    aria-label={`${item.name} 코디에서 빼기`}
                  >
                    <X size={16} strokeWidth={1.7} aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="composer-look-canvas__empty-note">옷장에서 아이템을 골라 나만의 룩을 완성해 보세요.</p>
      )}
    </section>
  )
}
