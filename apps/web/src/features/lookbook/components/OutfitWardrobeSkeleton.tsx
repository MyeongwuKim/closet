import { WoodCardClip } from '../../../components/WoodCardClip'

interface OutfitWardrobeSkeletonProps {
  count: number
}

/** 편집 시트의 두 열 옷장 카드와 같은 자리에 검색·필터 결과의 임시 사진과 정보를 표시한다. */
export function OutfitWardrobeSkeleton({ count }: OutfitWardrobeSkeletonProps) {
  return (
    <div className="outfit-wardrobe-grid mt-3 pb-3" role="status" aria-label="옷장 아이템 찾는 중">
      <span className="sr-only">옷장 아이템 찾는 중</span>
      {Array.from({ length: count }, (_, index) => (
        <div className="collection-clipped-card motion-safe:animate-pulse" aria-hidden="true" key={index}>
          <span className="collection-photo block">
            <WoodCardClip />
            <span className="block aspect-[4/5] rounded-xs bg-line/35" />
          </span>
          <span className="block px-0.5 pt-3 pb-1">
            <span className="block h-3.5 w-2/3 rounded-full bg-line/55" />
            <span className="mt-2 block h-3 w-4/5 rounded-full bg-line/35" />
            <span className="mt-2 block h-3 w-1/2 rounded-full bg-line/30" />
          </span>
        </div>
      ))}
    </div>
  )
}
