import type { WardrobeItem } from '@closet/types'
import type { LookbookViewMode, SavedOutfit } from '../types'
import { OutfitItemsBox } from './OutfitItemsBox'
import { getSavedOutfitItems } from '../utils/savedOutfitItems'
import { ArchivedWardrobeItemBadge } from '../../closet/components/ArchivedWardrobeItemBadge'

interface OutfitCardVisualProps {
  outfit: SavedOutfit
  items: WardrobeItem[]
  className?: string
  /** ai에서도 생성 이미지가 없으면 옷 사진으로 표시한다. 기본값 ai는 기존 소비 화면의 표현을 유지한다. */
  viewMode?: LookbookViewMode
}

/** AI 표지 또는 저장된 옷 관계의 콜라주를 표시한다. 옷장에서 삭제한 구성도 사진과 삭제 안내를 유지한다. */
export function OutfitCardVisual({
  outfit,
  items,
  className = '',
  viewMode = 'ai',
}: OutfitCardVisualProps) {
  const outfitItems = getSavedOutfitItems(outfit, items)
  const hasArchivedItems = outfitItems.some((item) => item.archivedAt)
  if (viewMode === 'ai' && outfit.previewImageUrl) {
    return (
      <div className={`relative overflow-hidden bg-canvas ${className}`}>
        <img
          src={outfit.previewImageUrl}
          loading="lazy"
          decoding="async"
          alt={`${outfit.name} AI 룩북 이미지`}
          className="size-full object-contain"
        />
        {hasArchivedItems && <ArchivedWardrobeItemBadge label="삭제된 옷 포함" className="absolute top-2 left-2" />}
      </div>
    )
  }

  return (
    <OutfitItemsBox outfitName={outfit.name} items={outfitItems} className={className} />
  )
}
