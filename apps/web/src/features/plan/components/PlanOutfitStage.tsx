import type { WardrobeItem } from '@closet/types'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'
import { closetCategoryLabels } from '../../closet/constants'
import { sortPlanOutfitItems } from '../utils/planOutfitItems'

interface PlanOutfitStageProps {
  items: WardrobeItem[]
}

/** 플래너에 설정한 실제 옷 사진과 분류 이름을 같은 크기의 두 열에 표시한다. 미분류 옷도 누락하지 않고, 한 개 또는 홀수 개의 마지막 옷은 전체 너비를 사용한다. */
export function PlanOutfitStage({ items }: PlanOutfitStageProps) {
  if (items.length > 0) {
    const orderedItems = sortPlanOutfitItems(items)
    return (
      <span className="dressing-board dressing-board-outfit" data-single-item={orderedItems.length === 1 || undefined} aria-label={orderedItems.map((item) => item.name).join(', ')}>
        {orderedItems.map((item) => (
          <span key={item.id} className="dressing-board-tile">
            <span className="dressing-board-item">
              <ClosetItemVisual item={item} compact />
            </span>
            <span className="dressing-board-tile-label">
              {item.category ? closetCategoryLabels[item.category] : '미분류'}
            </span>
          </span>
        ))}
      </span>
    )
  }
  return (
    <span className="dressing-board dressing-board-empty">
      <span className="text-xs text-muted">표시할 옷이 없어요.</span>
    </span>
  )
}
