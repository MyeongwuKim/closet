interface CatalogCardSkeletonGridProps {
  variant: 'wardrobe' | 'outfit'
  count?: number
}

export function CatalogCardSkeletonGrid({
  variant,
  count = 8,
}: CatalogCardSkeletonGridProps) {
  const loadingLabel =
    variant === 'wardrobe' ? '옷장을 불러오는 중' : '코디북을 불러오는 중'

  return (
    <div
      className="mt-6 grid animate-pulse grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      role="status"
      aria-label={loadingLabel}
    >
      <span className="sr-only">{loadingLabel}</span>
      {Array.from({ length: count }, (_, index) => (
        <div
          className="overflow-hidden rounded-3xl border border-line/70 bg-surface p-2"
          aria-hidden="true"
          key={index}
        >
          <div
            className={`rounded-[1.25rem] bg-line/35 ${
              variant === 'wardrobe' ? 'aspect-square' : 'aspect-[4/5]'
            }`}
          />
          <div className="px-2 pt-3 pb-2">
            {variant === 'outfit' && (
              <div className="mb-2 flex gap-1.5">
                <span className="h-5 w-12 rounded-full bg-sage" />
                <span className="h-5 w-10 rounded-full bg-line/45" />
              </div>
            )}
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
