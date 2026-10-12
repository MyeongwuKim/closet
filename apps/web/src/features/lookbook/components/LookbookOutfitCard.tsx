import type { WardrobeItem } from '@closet/types'
import { Sparkles } from 'lucide-react'
import { formatSeasonLabels } from '../../../constants/seasons'
import { getOutfitStyleLabel } from '../../../constants/styleOptions'
import type { OutfitWearSummary } from '../hooks/useOutfitWearSummaries'
import type { LookbookViewMode, SavedOutfit } from '../types'
import { OutfitCardVisual } from './OutfitCardVisual'
import { OutfitWearStatus } from './OutfitWearStatus'

interface LookbookOutfitCardProps {
  outfit: SavedOutfit
  items: WardrobeItem[]
  wearSummary?: OutfitWearSummary
  onSelect: (outfitId: string) => void
  viewMode?: LookbookViewMode
  /** 현재 목록에서의 순서. 정렬·필터 결과의 표지 번호이며 저장된 코디 ID나 생성 순번은 아니다. */
  order?: number
}

/** 저장한 코디를 룩북 표지로 표시한다. viewMode에 따라 착장 사진 또는 아이템 콜라주를 담고, 한 줄 제목과 스타일·착용 기록을 표시한다. 선택 시 부모에 코디 ID를 전달한다. */
export function LookbookOutfitCard({
  outfit,
  items,
  wearSummary,
  onSelect,
  viewMode = 'ai',
  order,
}: LookbookOutfitCardProps) {
  return (
    <button
      data-catalog-item
      type="button"
      onClick={() => onSelect(outfit.id)}
      className="lookbook-cover-card group flex h-full min-w-0 w-full flex-col text-left"
      aria-label={`${outfit.name} 코디 상세 보기`}
    >
      <div className="lookbook-cover-masthead" aria-hidden="true">
        <span className="lookbook-cover-number">LOOK{order !== undefined && <span>{String(order).padStart(2, '0')}</span>}</span>
        <span className="truncate">{outfit.seasons.length > 0 ? formatSeasonLabels(outfit.seasons) : 'MY LOOKBOOK'}</span>
      </div>
      <div className="lookbook-cover-visual relative aspect-[4/5] w-full shrink-0">
        <OutfitCardVisual
          outfit={outfit}
          items={items}
          viewMode={viewMode}
          className="size-full"
        />
        {viewMode === 'ai' && outfit.previewImageUrl && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 bg-surface/90 px-1.5 py-1 text-[9px] font-medium text-ink backdrop-blur">
            <Sparkles size={10} /> AI 룩
          </span>
        )}
      </div>
      <div className="lookbook-cover-label flex min-w-0 w-full flex-1 flex-col">
        <h2 className="truncate text-sm font-semibold leading-5 tracking-[-.025em]" title={outfit.name}>{outfit.name}</h2>
        <div className="mt-1 flex min-w-0 items-center justify-between gap-2 overflow-hidden text-[10px] text-muted">
          <span className="truncate">
            {getOutfitStyleLabel(outfit.style)}
          </span>
          <span className="shrink-0">{outfit.layers.length}개 아이템</span>
        </div>
        <OutfitWearStatus summary={wearSummary} compact />
      </div>
    </button>
  )
}
