import { useMemo, useState } from 'react'
import type {
  ClothingCategory,
  ColorMode,
  FashionItemAttributes,
  WardrobeItem,
} from '@closet/types'
import { CircleCheck, CopyCheck } from 'lucide-react'
import {
  findSimilarWardrobeItems,
  type SimilarWardrobeItemMatch,
} from '../utils/similarWardrobeItems'
import { ClosetItemVisual } from './ClosetItemVisual'
import { WardrobeItemQuickViewModal } from './WardrobeItemQuickViewModal'

/** 전체 옷장 조회가 성공한 경우에만 비교할 목록을 제공한다. */
export type WardrobeComparisonCatalog =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'ready'; items: WardrobeItem[] }

interface SimilarWardrobeItemsProps {
  itemName: string
  category: ClothingCategory
  subcategory: string
  colorName: string
  colorHex: string
  colorMode: ColorMode | null
  fashionAttributes: FashionItemAttributes | null
  catalog: WardrobeComparisonCatalog
}

const visibleMatchLimit = 4

const comparisonStatusCopy = {
  loading: {
    title: '옷장과 비교하는 중이에요',
    description: '옷장 목록을 불러오면 비슷한 옷을 확인할 수 있어요.',
  },
  error: {
    title: '옷장과 비교하지 못했어요',
    description: '옷장 목록을 불러오지 못했어요.',
  },
}

const kindLabels = {
  'near-duplicate': '색상·형태 매우 유사',
  'similar-design': '비슷한 형태',
  'similar-color': '비슷한 색감',
} as const

function getMatchBadge(
  match: SimilarWardrobeItemMatch,
  colorLabel: string,
) {
  if (match.kind === 'similar-color') {
    return `${colorLabel} ${match.colorSimilarityPercent}%`
  }
  if (match.kind === 'similar-design') {
    return `형태 ${match.designSimilarityPercent ?? match.similarityPercent}%`
  }
  return `종합 ${match.similarityPercent}%`
}

function getColorComparisonLabel(score: number, colorLabel: string) {
  return score >= 50 ? `${colorLabel} ${score}%` : `${colorLabel} 다름`
}

function getShapeComparisonLabel(score: number | null) {
  if (score === null) return '형태 정보 부족'
  return score >= 70 ? `형태 ${score}%` : '형태 다름'
}

function SimilarWardrobeItemCard({
  match,
  colorHex,
  onSelect,
}: {
  match: SimilarWardrobeItemMatch
  colorHex: string
  onSelect: (item: WardrobeItem) => void
}) {
  const { item, kind, reasons, usesRepresentativeColorOnly } = match
  const colorLabel = usesRepresentativeColorOnly ? '대표색' : '색상'
  const kindLabel = kind === 'similar-color' && usesRepresentativeColorOnly
    ? '비슷한 대표색'
    : kindLabels[kind]

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="w-44 shrink-0 snap-start overflow-hidden rounded-xl border border-line bg-white p-2.5 text-left transition hover:border-ink focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      aria-label={`${item.name} 상세정보 보기`}
    >
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-canvas">
        <ClosetItemVisual item={item} />
        <span className="absolute top-2 right-2 rounded-full bg-ink px-2 py-1 text-[11px] font-black text-white shadow-sm">
          {getMatchBadge(match, colorLabel)}
        </span>
      </div>
      <p className="mt-2.5 truncate text-sm font-black">{item.name}</p>
      <p className="mt-1 truncate text-xs text-muted">
        {item.subcategory} · {item.colorDetailName ?? item.colorName}
      </p>
      <p className="mt-2 text-[11px] font-black text-accent">{kindLabel}</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] font-bold">
        <span className="rounded-lg bg-canvas px-2 py-1.5 text-center">
          {getColorComparisonLabel(match.colorSimilarityPercent, colorLabel)}
        </span>
        <span className="rounded-lg bg-canvas px-2 py-1.5 text-center">
          {getShapeComparisonLabel(match.designSimilarityPercent)}
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
  )
}

/** 옷 추가 확인 화면에서 전체 옷장 비교 상태와 유사 후보의 상세 보기를 표시한다. */
export function SimilarWardrobeItems({
  itemName,
  category,
  subcategory,
  colorName,
  colorHex,
  colorMode,
  fashionAttributes,
  catalog,
}: SimilarWardrobeItemsProps) {
  const [detailItem, setDetailItem] = useState<WardrobeItem | null>(null)
  const wardrobeItems = catalog.status === 'ready' ? catalog.items : null
  const matches = useMemo(
    () => {
      if (!wardrobeItems) return []
      return findSimilarWardrobeItems(
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
        wardrobeItems.length,
      )
    },
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
  const visibleMatches = matches.slice(0, visibleMatchLimit)
  const hasMatches = matches.length > 0
  const statusCopy = catalog.status === 'ready' ? null : comparisonStatusCopy[catalog.status]

  return (
    <section
      className="min-w-0 rounded-2xl border border-line bg-surface p-4"
      aria-labelledby="similar-wardrobe-title"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sage">
          <CopyCheck size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0" role={catalog.status === 'error' ? 'alert' : 'status'}>
          <h4 id="similar-wardrobe-title" className="text-sm font-black">
            {statusCopy?.title ?? (hasMatches ? '잠깐만요!' : '겹치는 옷은 없어요')}
          </h4>
          <p className="mt-1 text-xs leading-5 text-muted">
            {statusCopy?.description ?? (hasMatches
              ? '옷장의 대표색과 형태를 비교했어요.'
              : `색상이나 형태가 겹치는 ${subcategory}는 찾지 못했어요.`)}
          </p>
        </div>
      </div>

      {catalog.status === 'error' && (
        <button
          type="button"
          className="mt-3 min-h-9 rounded-lg border border-line bg-white px-3 text-xs font-bold hover:border-ink"
          onClick={catalog.retry}
        >
          다시 확인
        </button>
      )}

      {hasMatches && (
        <>
          <p className="mt-4 text-xs font-bold leading-5 text-[#a33a25]">
            옷장에 색상이나 형태가 겹치는 아이템이 {matches.length}개 있어요.
            {' '}
            {matches.length > visibleMatchLimit
              ? `유사도가 높은 ${visibleMatchLimit}개를 보여드려요.`
              : '좌우로 확인해보세요.'}
          </p>
          <div className="scrollbar-hidden mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
            {visibleMatches.map((match) => (
              <SimilarWardrobeItemCard
                key={match.item.id}
                match={match}
                colorHex={colorHex}
                onSelect={setDetailItem}
              />
            ))}
          </div>
        </>
      )}

      {catalog.status === 'ready' && !hasMatches && (
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
