import type { WardrobeItem } from '@closet/types'
import type { LookbookViewMode, SavedOutfit } from '../types'
import { OutfitItemsBox } from './OutfitItemsBox'

interface OutfitCardVisualProps {
  outfit: SavedOutfit
  items: WardrobeItem[]
  className?: string
  /** ai에서도 생성 이미지가 없으면 옷 사진으로 표시한다. 기본값 ai는 기존 소비 화면의 표현을 유지한다. */
  viewMode?: LookbookViewMode
}

/** 보기 옵션이 ai이고 생성 이미지가 있으면 AI 룩을 표시한다. 나머지 경우에는 조회된 옷을 레이어 순서로 정리해 콜라주로 표시한다. 원본 레이어 배열은 변경하지 않는다. */
export function OutfitCardVisual({
  outfit,
  items,
  className = '',
  viewMode = 'ai',
}: OutfitCardVisualProps) {
  if (viewMode === 'ai' && outfit.previewImageUrl) {
    return (
      <div className={`overflow-hidden bg-canvas ${className}`}>
        <img
          src={outfit.previewImageUrl}
          loading="lazy"
          decoding="async"
          alt={`${outfit.name} AI 룩북 이미지`}
          className="size-full object-contain"
        />
      </div>
    )
  }

  const outfitItems = [...outfit.layers]
    .sort((left, right) => left.order - right.order)
    .flatMap((layer) => {
      const item = items.find(
        (candidate) => candidate.id === layer.wardrobeItemId,
      )
      return item ? [item] : []
    })
  return (
    <OutfitItemsBox outfitName={outfit.name} items={outfitItems} className={className} />
  )
}
