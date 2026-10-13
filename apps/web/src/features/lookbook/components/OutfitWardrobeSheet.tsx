import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

interface OutfitWardrobeSheetProps {
  isOpen: boolean
  onClose: () => void
  action?: ReactNode
  children: ReactNode
}

/**
 * 모바일에서는 화면 아래에 고정한 옷장 시트를, 데스크톱에서는 Look 옆의 옷장 영역을 표시한다.
 * 추천 선택·결과 화면도 이 영역 안에서 전환하며, 닫기 동작은 부모의 열림 상태에 전달한다.
 */
export function OutfitWardrobeSheet({ isOpen, onClose, action, children }: OutfitWardrobeSheetProps) {
  return (
    <aside className="outfit-styling-layout__wardrobe" aria-label="Look에 추가할 옷 고르기" data-open={isOpen}>
      <div className={`outfit-styling-layout__drawer-toolbar${action ? ' outfit-styling-layout__drawer-toolbar--has-action' : ''}`}>
        {action && <div className="outfit-styling-layout__drawer-action">{action}</div>}
        <button
          type="button"
          className="outfit-styling-layout__drawer-toggle"
          onClick={onClose}
          aria-controls="outfit-styling-wardrobe-content"
          aria-expanded={isOpen}
          aria-label="옷장 닫기"
        >
          <span>닫기</span>
          <ChevronDown size={15} aria-hidden="true" />
        </button>
      </div>
      <div id="outfit-styling-wardrobe-content" className="outfit-styling-layout__wardrobe-content">
        {children}
      </div>
    </aside>
  )
}
