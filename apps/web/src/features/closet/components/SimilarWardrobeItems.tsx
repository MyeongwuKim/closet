import { useMemo, useState } from 'react'
import type {
  ClothingCategory,
  ColorMode,
  FashionItemAttributes,
  WardrobeItem,
} from '@closet/types'
import { CircleCheck, CopyCheck } from 'lucide-react'
import { findSimilarWardrobeItems } from '../utils/similarWardrobeItems'
import { ClosetItemVisual } from './ClosetItemVisual'
import { WardrobeItemQuickViewModal } from './WardrobeItemQuickViewModal'

interface SimilarWardrobeItemsProps {
  itemName: string
  category: ClothingCategory
  subcategory: string
  colorName: string
  colorHex: string
  colorMode: ColorMode | null
  fashionAttributes: FashionItemAttributes | null
  wardrobeItems: WardrobeItem[]
}

const kindLabels = {
  'near-duplicate': '컬러·형태 매우 유사',
  'similar-design': '비슷한 형태',
  'similar-color': '비슷한 색감',
} as const

function getMatchBadge(
  kind: keyof typeof kindLabels,
  similarityPercent: number,
  colorSimilarityPercent: number,
  designSimilarityPercent: number | null,
) {
  if (kind === 'similar-color') return `컬러 ${colorSimilarityPercent}%`
  if (kind === 'similar-design') {
    return `형태 ${designSimilarityPercent ?? similarityPercent}%`
  }
  return `종합 ${similarityPercent}%`
}

function getColorComparisonLabel(score: number) {
  return score >= 50 ? `컬러 ${score}%` : '컬러 다름'
}

function getShapeComparisonLabel(score: number | null) {
  if (score === null) return '형태 정보 부족'
  return score >= 70 ? `형태 ${score}%` : '형태 다름'
}

export function SimilarWardrobeItems({
  itemName,
  category,
  subcategory,
  colorName,
  colorHex,
  colorMode,
  fashionAttributes,
  wardrobeItems,
}: SimilarWardrobeItemsProps) {
  const [detailItem, setDetailItem] = useState<WardrobeItem | null>(null)
  const matches = useMemo(
    () =>
      findSimilarWardrobeItems(
        {
          itemName,
          category,
          subcategory,
          colorName,
          colorHex,
          colorMode,
          fashionAttributes,
        },
        wardrobeItems,
      ),
    [
      category,
      colorHex,
      colorMode,
      colorName,
      fashionAttributes,
      itemName,
      subcategory,
      wardrobeItems,
    ],
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
              ? '옷장의 컬러와 실루엣, 여밈, 포켓 등 관찰된 형태를 비교했어요.'
              : `색상과 형태가 겹치는 ${subcategory}는 찾지 못했어요.`}
          </p>
        </div>
      </div>

      {matches.length > 0 ? (
        <>
          <p className="mt-4 text-xs font-bold leading-5 text-[#a33a25]">
            옷장에 색상이나 형태가 겹치는 아이템이 {matches.length}개 있어요.
            좌우로 확인해보세요.
          </p>
          <div className="scrollbar-hidden mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
            {matches.map(
              ({
                item,
                kind,
                similarityPercent,
                colorSimilarityPercent,
                designSimilarityPercent,
                reasons,
              }) => (
                <button
                  type="button"
                  onClick={() => setDetailItem(item)}
                  className="w-44 shrink-0 snap-start overflow-hidden rounded-xl border border-line bg-white p-2.5 text-left transition hover:border-ink focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                  aria-label={`${item.name} 상세정보 보기`}
                  key={item.id}
                >
                  <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-canvas">
                    <ClosetItemVisual item={item} />
                    <span className="absolute top-2 right-2 rounded-full bg-ink px-2 py-1 text-[11px] font-black text-white shadow-sm">
                      {getMatchBadge(
                        kind,
                        similarityPercent,
                        colorSimilarityPercent,
                        designSimilarityPercent,
                      )}
                    </span>
                  </div>
                  <p className="mt-2.5 truncate text-sm font-black">
                    {item.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted">
                    {item.subcategory} · {item.colorDetailName ?? item.colorName}
                  </p>
                  <p className="mt-2 text-[11px] font-black text-accent">
                    {kindLabels[kind]}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] font-bold">
                    <span className="rounded-lg bg-canvas px-2 py-1.5 text-center">
                      {getColorComparisonLabel(colorSimilarityPercent)}
                    </span>
                    <span className="rounded-lg bg-canvas px-2 py-1.5 text-center">
                      {getShapeComparisonLabel(designSimilarityPercent)}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-muted">
                    {reasons.join(' · ')}
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
                      대표색 비교
                    </span>
                  </div>
                </button>
              ),
            )}
          </div>
        </>
      ) : (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-bold text-muted">
          <CircleCheck size={16} className="text-[#56724f]" aria-hidden="true" />
          안심하고 옷장에 담아도 좋아요.
        </p>
      )}

      {detailItem && (
        <WardrobeItemQuickViewModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
        />
      )}
    </section>
  )
}
