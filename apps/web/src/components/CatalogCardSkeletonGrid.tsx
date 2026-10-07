import { WoodCardClip } from './WoodCardClip'

interface CatalogCardSkeletonGridProps {
  variant: 'wardrobe' | 'outfit'
  count?: number
}

/** 옷장·코디북의 동일한 크기 목록이 로딩 중일 때 사진과 제목 자리를 표시한다. */
export function CatalogCardSkeletonGrid({
  variant,
  count = 8,
}: CatalogCardSkeletonGridProps) {
  const loadingLabel =
    variant === 'wardrobe' ? '옷장을 불러오는 중' : '코디북을 불러오는 중'

  return (
    <div
      className="wardrobe-item-grid grid animate-pulse grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4"
      role="status"
      aria-label={loadingLabel}
    >
      <span className="sr-only">{loadingLabel}</span>
      {Array.from({ length: count }, (_, index) => (
        <div
          className="collection-clipped-card"
          aria-hidden="true"
          key={index}
        >
          <div className="collection-photo">
            <WoodCardClip />
            <div className="aspect-[4/5] rounded-xs bg-line/35" />
          </div>
          <div className="px-0.5 pt-3 pb-1">
            <span className="block h-3.5 w-2/3 rounded-full bg-line/55" />
            <span className="mt-2 block h-3 w-4/5 rounded-full bg-line/35" />
            {variant === 'outfit' && (
              <span className="mt-2 block h-3 w-1/2 rounded-full bg-line/30" />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
