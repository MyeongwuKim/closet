import { useMemo, useState } from 'react'
import type { Season, WardrobeItem } from '@closet/types'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { seasonOptions } from '../../../constants/seasons'
import { CatalogSearchField } from '../../../components/CatalogSearchField'
import { ClothingCategoryIcon } from '../../../components/ClothingCategoryIcon'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'
import { OutfitWardrobeCard } from './OutfitWardrobeCard'
import { OutfitWardrobeSkeleton } from './OutfitWardrobeSkeleton'
import { useOutfitWardrobeResultTransition } from '../hooks/useOutfitWardrobeResultTransition'
import { outfitSelectionLabels, type OutfitSelectionCategory } from '../utils/outfitSelection'
import {
  filterOutfitItems,
  getOutfitItemFilterOptions,
} from '../utils/outfitItemFilters'
import './OutfitItemBrowser.css'

/** 현재 카테고리 옷장에 적용한 색상 이름과 목록에 보여줄 색상값. */
export interface OutfitColorFilter {
  name: string
  hex: string
  /** 추천 색 카드에서 시작한 필터에는 명확한 하위 색상 이름도 포함한다. */
  source?: 'recommendation'
}

interface OutfitItemBrowserProps {
  category: OutfitSelectionCategory
  /** 상의 칸에서 원피스도 함께 고를 수 있을 때 목록 제목과 검색 이름에 사용한다. */
  categoryLabel?: string
  items: WardrobeItem[]
  /** 현재 칸에 담긴 옷. 여러 개를 담는 칸에서는 이 중 교체 대상을 고를 수 있다. */
  currentItems: WardrobeItem[]
  replacingItem: WardrobeItem | null
  /** 추천 색상 또는 옷장 필터에서 고른 색. 부모가 카테고리 전환 시 해제한다. */
  colorFilter: OutfitColorFilter | null
  onColorFilterChange: (color: OutfitColorFilter | null) => void
  onReplaceItem: (item: WardrobeItem) => void
  onSelect: (item: WardrobeItem) => void
  onOpenCloset: () => void
}

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`outfit-item-browser__chip shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold ${
        active
          ? 'border-ink bg-ink text-white'
          : 'border-line bg-surface text-muted hover:border-ink hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

/** 코디 편집에서 선택한 종류의 보유 옷을 검색·계절·색상으로 좁혀 격자로 보여준다. 아이템 선택과 옷장 이동은 부모에 맡긴다. */
export function OutfitItemBrowser({
  category,
  categoryLabel: categoryLabelOverride,
  items,
  currentItems,
  replacingItem,
  colorFilter,
  onColorFilterChange,
  onReplaceItem,
  onSelect,
  onOpenCloset,
}: OutfitItemBrowserProps) {
  const [query, setQuery] = useState('')
  const [season, setSeason] = useState<Season | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const filterOptions = useMemo(() => getOutfitItemFilterOptions(items), [items])
  const visibleItems = useMemo(
    () => filterOutfitItems(items, {
      query,
      season,
      color: colorFilter?.name ?? null,
      includeColorAliases: colorFilter?.source === 'recommendation',
    }),
    [colorFilter?.name, colorFilter?.source, items, query, season],
  )
  const activeFilterCount = Number(Boolean(season)) + Number(Boolean(colorFilter))
  const hasActiveConditions = Boolean(query.trim() || activeFilterCount)
  const categoryLabel = categoryLabelOverride ?? outfitSelectionLabels[category]
  const filterKey = JSON.stringify([query, season, colorFilter?.name ?? null])
  const isResultsPending = useOutfitWardrobeResultTransition(
    filterKey,
    items.length > 0,
    Boolean(colorFilter),
  )

  const clearConditions = () => {
    setQuery('')
    setSeason(null)
    onColorFilterChange(null)
  }

  return (
    <section className="outfit-item-browser" aria-labelledby="target-closet-title">
      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="text-[10px] font-black tracking-[0.08em] text-accent">
            내 옷장
          </span>
          <h3 id="target-closet-title" className="text-sm font-black">
            {categoryLabel} {replacingItem ? '바꾸기' : '목록'}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-xs font-bold text-muted" aria-live="polite">
            {isResultsPending ? '찾는 중' : `${hasActiveConditions ? `${visibleItems.length}/${items.length}` : items.length}개`}
          </span>
          <button
            type="button"
            onClick={() => {
              setIsSearchOpen((current) => {
                if (current) setQuery('')
                return !current
              })
            }}
            className={`outfit-item-browser__control flex size-11 items-center justify-center rounded-full border ${
              isSearchOpen || query
                ? 'border-ink bg-ink text-white'
                : 'border-line bg-surface text-muted'
            }`}
            aria-label={isSearchOpen ? '검색 닫기' : `${categoryLabel} 검색`}
            aria-expanded={isSearchOpen}
          >
            {isSearchOpen ? <X size={16} /> : <Search size={16} />}
          </button>
          <button
            type="button"
            onClick={() => setIsFilterOpen((current) => !current)}
            className={`outfit-item-browser__control relative flex size-11 items-center justify-center rounded-full border ${
              isFilterOpen || activeFilterCount > 0
                ? 'border-ink bg-ink text-white'
                : 'border-line bg-surface text-muted'
            }`}
            aria-label={`${categoryLabel} 필터`}
            aria-expanded={isFilterOpen}
            aria-controls="outfit-item-browser-filters"
          >
            <SlidersHorizontal size={16} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-black text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {colorFilter && (
        <div className="outfit-item-browser__active-color mt-3 flex items-center gap-2 rounded-xl border border-accent/25 bg-sage/40 px-3 py-2 text-xs font-bold text-ink">
          <span
            className="size-4 shrink-0 rounded-full border border-black/10"
            style={{ backgroundColor: colorFilter.hex }}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">{colorFilter.name} 색상만 보기</span>
          <button
            type="button"
            onClick={() => onColorFilterChange(null)}
            className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-surface"
            aria-label={`${colorFilter.name} 색상 필터 해제`}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {currentItems.length > 0 && (
        <div className="mt-3 rounded-xl border border-line bg-surface p-2">
          <p className="px-1 text-[10px] font-bold text-muted">현재 선택 · {currentItems.length}개</p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {currentItems.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => onReplaceItem(item)}
                disabled={replacingItem?.id === item.id}
                aria-pressed={replacingItem?.id === item.id}
                className="flex min-w-32 max-w-48 shrink-0 items-center gap-2 rounded-lg border border-line bg-canvas p-1.5 text-left disabled:border-accent"
              >
                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded bg-surface">
                  <ClosetItemVisual item={item} compact />
                </span>
                <span className="min-w-0 truncate text-[11px] font-bold">{item.name}</span>
                <span className="shrink-0 text-[10px] font-bold text-accent">{replacingItem?.id === item.id ? '선택됨' : '바꾸기'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <CatalogSearchField
        isOpen={isSearchOpen}
        value={query}
        label={`${categoryLabel} 검색어`}
        placeholder="이름, 종류, 색상, 태그 검색"
        onChange={setQuery}
      />

      <div
        id="outfit-item-browser-filters"
        className="outfit-item-browser__filter-panel"
        data-open={isFilterOpen}
        inert={!isFilterOpen}
        aria-hidden={!isFilterOpen}
      >
        <div className="outfit-item-browser__filter-clip">
          <div className="outfit-item-browser__filter-content space-y-3">
            {filterOptions.seasons.size > 0 && (
              <div>
                <p className="px-0.5 text-[10px] font-bold text-muted">계절</p>
                <div className="scrollbar-hidden mt-1.5 flex gap-1.5 overflow-x-auto">
                  {seasonOptions
                    .filter((option) => filterOptions.seasons.has(option.value))
                    .map((option) => (
                      <FilterChip
                        active={season === option.value}
                        onClick={() =>
                          setSeason((current) =>
                            current === option.value ? null : option.value,
                          )
                        }
                        key={option.value}
                      >
                        {option.label}
                      </FilterChip>
                    ))}
                </div>
              </div>
            )}

            {filterOptions.colors.length > 0 && (
              <div>
                <p className="px-0.5 text-[10px] font-bold text-muted">색상</p>
                <div className="scrollbar-hidden mt-1.5 flex gap-1.5 overflow-x-auto">
                  {filterOptions.colors.map((option) => (
                    <FilterChip
                      active={colorFilter?.name === option.name}
                      onClick={() =>
                        onColorFilterChange(
                          colorFilter?.name === option.name ? null : option,
                        )
                      }
                      key={option.name}
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          className="size-2.5 rounded-full border border-black/10"
                          style={{ backgroundColor: option.hex }}
                        />
                        {option.name}
                      </span>
                    </FilterChip>
                  ))}
                </div>
              </div>
            )}

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearConditions}
                className="text-[11px] font-bold text-muted underline underline-offset-2"
              >
                필터 초기화
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="outfit-item-browser__results" aria-busy={isResultsPending}>
        {items.length === 0 ? (
          <div className="mt-3 flex min-h-44 flex-col items-center justify-center rounded-3xl border border-dashed border-line px-6 text-center">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-sage">
              <ClothingCategoryIcon category={category} size={22} />
            </span>
            <strong className="mt-3 text-sm font-black">
              {currentItems.length > 0
                ? `바꿀 다른 ${categoryLabel} 아이템이 없어요`
                : `옷장에 ${categoryLabel} 아이템이 없어요`}
            </strong>
            <button
              type="button"
              onClick={onOpenCloset}
              className="mt-4 rounded-full bg-accent px-4 py-2 text-xs font-bold text-white"
            >
              {currentItems.length > 0 ? '다른 옷 등록하기' : '옷장에 추가하기'}
            </button>
          </div>
        ) : isResultsPending ? (
          <OutfitWardrobeSkeleton count={Math.min(4, Math.max(2, visibleItems.length))} />
        ) : visibleItems.length > 0 ? (
          <div className="outfit-wardrobe-grid mt-3 pb-3">
            {visibleItems.map((item) => (
              <OutfitWardrobeCard
                item={item}
                onSelect={onSelect}
                actionLabel={replacingItem ? '바꾸기' : '추가'}
                key={item.id}
              />
            ))}
          </div>
        ) : (
          <div className="outfit-item-browser__empty mt-3 rounded-2xl border border-dashed border-line px-5 py-8 text-center">
            <strong className="text-sm font-black">
              {colorFilter ? `${colorFilter.name} 색상의 ${categoryLabel} 아이템이 없어요` : '조건에 맞는 옷이 없어요'}
            </strong>
            <p className="mt-1 text-xs text-muted">
              {colorFilter ? '다른 색을 고르거나 전체 목록으로 돌아가세요.' : '검색어나 필터를 바꿔보세요.'}
            </p>
            <button
              type="button"
              onClick={clearConditions}
              className="mt-3 rounded-full border border-line bg-surface px-3 py-2 text-xs font-bold"
            >
              전체 보기
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
