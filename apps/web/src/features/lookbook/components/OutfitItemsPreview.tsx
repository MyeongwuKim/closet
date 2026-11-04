import type { WardrobeItem } from '@closet/types'
import type { OutfitLayer } from '../types'
import { ArchivedWardrobeItemBadge } from '../../closet/components/ArchivedWardrobeItemBadge'

interface OutfitItemsPreviewProps {
  className?: string
  items: WardrobeItem[]
  layers: OutfitLayer[]
  /** 작은 날짜 버튼에서는 생략하고, 코디 카드에서 삭제 상태를 사진 위에 표시한다. */
  showArchivedStatus?: boolean
}

/** 매칭 코디의 구성 옷 사진을 레이어 순서대로 최대 두 열에 배치한다. 등록된 사진이 없으면 안내를 표시하고 높이는 부모가 전달한 className에 따른다. */
export function OutfitItemsPreview({
  className = '',
  items,
  layers,
  showArchivedStatus = false,
}: OutfitItemsPreviewProps) {
  const imageItems = layers
    .slice()
    .sort((left, right) => left.order - right.order)
    .flatMap((layer) => {
      const item = items.find(
        (candidate) => candidate.id === layer.wardrobeItemId,
      )
      const imageUrl = item?.imageUrl ?? item?.originalImageUrl

      return item && imageUrl ? [{ item, imageUrl }] : []
    })

  return (
    <div
      className={`grid auto-rows-fr ${imageItems.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-1 overflow-hidden rounded-xl bg-canvas/70 p-1.5 ${className}`}
      aria-label="코디 아이템 이미지"
    >
      {imageItems.length > 0 ? (
        imageItems.map(({ item, imageUrl }) => (
          <span className="relative flex min-h-0 min-w-0 items-center justify-center" key={item.id}>
            <img
              src={imageUrl}
              alt={item.name}
              className="size-full min-h-0 min-w-0 object-contain"
            />
            {showArchivedStatus && item.archivedAt && <ArchivedWardrobeItemBadge compact className="absolute top-0 left-0" />}
          </span>
        ))
      ) : (
        <span className="col-span-full flex items-center justify-center px-2 text-center text-[10px] leading-4 text-muted">
          표시할 아이템 이미지가 없어요
        </span>
      )}
    </div>
  )
}
