import { useMemo } from 'react'
import type {
  ClothingCategory,
  ColorMode,
  WardrobeItem,
} from '@closet/types'
import { CircleCheck, CopyCheck } from 'lucide-react'
import { findSimilarWardrobeItems } from '../utils/similarWardrobeItems'
import { ClosetItemVisual } from './ClosetItemVisual'

interface SimilarWardrobeItemsProps {
  category: ClothingCategory
  subcategory: string
  colorName: string
  colorHex: string
  colorMode: ColorMode | null
  wardrobeItems: WardrobeItem[]
}

export function SimilarWardrobeItems({
  category,
  subcategory,
  colorName,
  colorHex,
  colorMode,
  wardrobeItems,
}: SimilarWardrobeItemsProps) {
  const matches = useMemo(
    () =>
      findSimilarWardrobeItems(
        { category, subcategory, colorName, colorHex, colorMode },
        wardrobeItems,
      ),
    [category, colorHex, colorMode, colorName, subcategory, wardrobeItems],
  )

  return (
    <section
      className="rounded-2xl border border-line bg-surface p-4"
      aria-labelledby="similar-wardrobe-title"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sage">
          <CopyCheck size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h4 id="similar-wardrobe-title" className="text-sm font-black">
            {matches.length > 0 ? '잠깐만요!' : '겹치는 옷은 없어요'}
          </h4>
          <p className="mt-1 text-xs leading-5 text-muted">
            {matches.length > 0
              ? 'AI가 지갑을 지켜드리려고 비슷한 옷을 찾아왔어요.'
              : `AI가 옷장을 둘러봤지만 비슷한 ${subcategory}는 찾지 못했어요.`}
          </p>
        </div>
      </div>

      {matches.length > 0 ? (
        <>
          <p className="mt-4 text-xs font-bold leading-5 text-[#a33a25]">
            옷장에 닮은 아이템이 {matches.length}개 있어요. 좌우로
            확인해보세요.
          </p>
          <div className="scrollbar-hidden mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
            {matches.map(({ item, level, similarityPercent }) => (
              <article
                className="w-40 shrink-0 snap-start overflow-hidden rounded-xl border border-line bg-white p-2.5"
                key={item.id}
              >
                <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-canvas">
                  <ClosetItemVisual item={item} />
                  <span className="absolute top-2 right-2 rounded-full bg-ink px-2 py-1 text-[11px] font-black text-white shadow-sm">
                    유사도 {similarityPercent}%
                  </span>
                </div>
                <p className="mt-2.5 truncate text-sm font-black">{item.name}</p>
                <p className="mt-1 truncate text-xs text-muted">
                  {item.subcategory} · {item.colorDetailName ?? item.colorName}
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span
                    className="size-4 rounded-full border border-black/10"
                    style={{ backgroundColor: colorHex }}
                    aria-label="추가할 옷의 대표 색상"
                  />
                  <span
                    className="size-4 rounded-full border border-black/10"
                    style={{ backgroundColor: item.colorHex }}
                    aria-label={`${item.name}의 대표 색상`}
                  />
                  <span className="ml-1 truncate text-[11px] font-bold text-accent">
                    {level === 'very-similar'
                      ? '거의 같은 색감'
                      : '비슷한 색감'}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-bold text-muted">
          <CircleCheck size={16} className="text-[#56724f]" aria-hidden="true" />
          안심하고 옷장에 담아도 좋아요.
        </p>
      )}
    </section>
  )
}
