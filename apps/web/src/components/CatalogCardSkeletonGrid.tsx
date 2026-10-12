import { WoodCardClip } from './WoodCardClip'

interface CatalogCardSkeletonGridProps {
  variant: 'wardrobe' | 'outfit'
  count?: number
}

/** 목록 조회 중 사진과 제목 자리를 표시한다. 옷장은 집게와 봉, 코디북은 룩북 표지 형태로 실제 카드 배치와 맞춘다. */
export function CatalogCardSkeletonGrid({
  variant,
  count = 8,
}: CatalogCardSkeletonGridProps) {
  const loadingLabel =
    variant === 'wardrobe' ? '옷장을 불러오는 중' : '코디북을 불러오는 중'

  return (
    <div
      className={`${variant === 'outfit' ? 'lookbook-cover-grid' : 'wardrobe-item-grid gap-x-4 sm:gap-x-6'} grid motion-safe:animate-pulse grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`}
      role="status"
      aria-label={loadingLabel}
    >
      <span className="sr-only">{loadingLabel}</span>
      {Array.from({ length: count }, (_, index) => (
        <div
          className={variant === 'outfit' ? 'lookbook-cover-card' : 'collection-clipped-card'}
          aria-hidden="true"
          key={index}
        >
          {variant === 'outfit' && <div className="lookbook-cover-masthead"><span className="h-3 w-1/3 bg-line/35" /></div>}
          <div className={variant === 'outfit' ? 'lookbook-cover-visual' : 'collection-photo'}>
            {variant === 'wardrobe' && <WoodCardClip />}
            <div className="aspect-[4/5] rounded-xs bg-line/35" />
          </div>
          <div className={variant === 'outfit' ? 'lookbook-cover-label' : 'px-0.5 pt-3 pb-1'}>
            <div className={variant === 'outfit' ? 'h-5' : undefined}>
              <span className="block h-3.5 w-2/3 rounded-full bg-line/55" />
            </div>
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
