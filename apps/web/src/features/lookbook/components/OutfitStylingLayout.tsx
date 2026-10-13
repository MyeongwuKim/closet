import type { ReactNode } from 'react'
import type { WardrobeItem } from '@closet/types'
import type { OutfitSelectionCategory } from '../utils/outfitSelection'
import { ComposerLookCanvas } from './ComposerLookCanvas'
import { OutfitWardrobeSheet } from './OutfitWardrobeSheet'
import './OutfitStylingLayout.css'

interface OutfitStylingLayoutProps {
  selectedItems: WardrobeItem[]
  selectableCategories: OutfitSelectionCategory[]
  /** 모바일에서 슬롯에 맞는 옷장 시트를 열었는지 나타낸다. Look 보드는 열린 동안에도 위에 남는다. */
  isWardrobeExpanded: boolean
  /** 옷장 시트의 열림·닫힘을 부모 UI 상태에 반영한다. */
  onWardrobeExpandedChange: (expanded: boolean) => void
  onSlotSelect: (category: OutfitSelectionCategory) => void
  onItemRemove: (item: WardrobeItem) => void
  /** 옷장 시트 상단에서 닫기와 나란히 보여줄 동작. 추천 화면의 상태는 전달한 컴포넌트가 관리한다. */
  wardrobeAction?: ReactNode
  children: ReactNode
}

/**
 * 코디 맞춰보기에서 조합 결과와 옷장 선택 영역을 함께 보여준다.
 * 모바일에서 Look의 종류 칸을 누르면 위의 조합을 유지한 채 아래에 해당 옷장 시트를 연다.
 * 데스크톱은 Look과 옷장을 나란히 고정한다.
 * 선택·제거 동작은 부모에 전달하며 코디 데이터나 저장 상태를 따로 보관하지 않는다.
 */
export function OutfitStylingLayout({
  selectedItems,
  selectableCategories,
  isWardrobeExpanded,
  onWardrobeExpandedChange,
  onSlotSelect,
  onItemRemove,
  wardrobeAction,
  children,
}: OutfitStylingLayoutProps) {
  return (
    <section className={`outfit-styling-layout${isWardrobeExpanded ? ' outfit-styling-layout--expanded' : ''}`}>
      <div className="outfit-styling-layout__stage scrollbar-hidden">
        <div className="outfit-styling-layout__stage-inner">
          <ComposerLookCanvas
            selectedItems={selectedItems}
            selectableCategories={selectableCategories}
            isSelectedListInert={isWardrobeExpanded}
            onSlotSelect={onSlotSelect}
            onItemRemove={onItemRemove}
          />
        </div>
      </div>
      <div className="outfit-styling-layout__sheet-space" aria-hidden="true" />
      <OutfitWardrobeSheet
        isOpen={isWardrobeExpanded}
        onClose={() => onWardrobeExpandedChange(false)}
        action={wardrobeAction}
      >
        {children}
      </OutfitWardrobeSheet>
    </section>
  )
}
