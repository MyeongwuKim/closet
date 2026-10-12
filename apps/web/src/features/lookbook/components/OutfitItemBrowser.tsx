import { useMemo, useState } from 'react'
import type { Season, WardrobeItem } from '@closet/types'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { seasonOptions } from '../../../constants/seasons'
import { ClothingCategoryIcon } from '../../../components/ClothingCategoryIcon'
import { OutfitWardrobeCard } from './OutfitWardrobeCard'
import { outfitSelectionLabels, type OutfitSelectionCategory } from '../utils/outfitSelection'
import {
  filterOutfitItems,
  getOutfitItemFilterOptions,
} from '../utils/outfitItemFilters'

interface OutfitItemBrowserProps {
  category: OutfitSelectionCategory
  /** 상의 칸에서 원피스도 함께 고를 수 있을 때 목록 제목과 검색 이름에 사용한다. */
  categoryLabel?: string
  items: WardrobeItem[]
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
      className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
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
  onSelect,
  onOpenCloset,
}: OutfitItemBrowserProps) {
  const [query, setQuery] = useState('')
  const [season, setSeason] = useState<Season | null>(null)
  const [color, setColor] = useState<string | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const filterOptions = useMemo(() => getOutfitItemFilterOptions(items), [items])
  const visibleItems = useMemo(
    () => filterOutfitItems(items, { query, season, color }),
    [color, items, query, season],
  )
  const activeFilterCount = Number(Boolean(season)) + Number(Boolean(color))
  const hasActiveConditions = Boolean(query.trim() || activeFilterCount)
  const categoryLabel = categoryLabelOverride ?? outfitSelectionLabels[category]

  const clearConditions = () => {
    setQuery('')
    setSeason(null)
    setColor(null)
  }

  return (
    <section aria-labelledby="target-closet-title">
      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="text-[10px] font-black tracking-[0.08em] text-accent">
            내 옷장
          </span>
          <h3 id="target-closet-title" className="text-sm font-black">
            {categoryLabel} 목록
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-xs font-bold text-muted">
            {hasActiveConditions ? `${visibleItems.length}/${items.length}` : items.length}개
          </span>
          <button
            type="button"
            onClick={() => {
              setIsSearchOpen((current) => {
                if (current) setQuery('')
                return !current
              })
            }}
            className={`flex size-11 items-center justify-center rounded-full border transition ${
              isSearchOpen || query
                ? 'border-ink bg-ink text-white'
                : 'border-line bg-surface text-muted'
            }`}
            aria-label={isSearchOpen ? '검색 닫기' : `${categoryLabel} 검색`}
          >
            {isSearchOpen ? <X size={16} /> : <Search size={16} />}
          </button>
          <button
            type="button"
            onClick={() => setIsFilterOpen((current) => !current)}
            className={`relative flex size-11 items-center justify-center rounded-full border transition ${
              isFilterOpen || activeFilterCount > 0
                ? 'border-ink bg-ink text-white'
                : 'border-line bg-surface text-muted'
            }`}
            aria-label={`${categoryLabel} 필터`}
            aria-expanded={isFilterOpen}
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

      {isSearchOpen && (
        <div className="relative mt-3">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이름, 종류, 색상, 태그 검색"
            className="h-11 w-full rounded-xl border border-line bg-surface pr-10 pl-9 text-xs outline-none transition placeholder:text-muted/70 focus:border-ink"
            aria-label={`${categoryLabel} 검색어`}
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-canvas"
              aria-label="검색어 지우기"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {isFilterOpen && (
        <div className="mt-3 space-y-3 rounded-2xl border border-line bg-surface p-3">
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
                    active={color === option.name}
                    onClick={() =>
                      setColor((current) =>
                        current === option.name ? null : option.name,
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
      )}

      {items.length === 0 ? (
        <div className="mt-3 flex min-h-44 flex-col items-center justify-center rounded-3xl border border-dashed border-line px-6 text-center">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-sage">
            <ClothingCategoryIcon category={category} size={22} />
          </span>
          <strong className="mt-3 text-sm font-black">
            옷장에 {categoryLabel} 아이템이 없어요
          </strong>
          <button
            type="button"
            onClick={onOpenCloset}
            className="mt-4 rounded-full bg-accent px-4 py-2 text-xs font-bold text-white"
          >
            옷장에 추가하기
          </button>
        </div>
      ) : visibleItems.length > 0 ? (
        <div className="outfit-wardrobe-grid mt-3 pb-3">
          {visibleItems.map((item) => (
            <OutfitWardrobeCard
              item={item}
              onSelect={onSelect}
              key={item.id}
            />
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-dashed border-line px-5 py-8 text-center">
          <strong className="text-sm font-black">조건에 맞는 옷이 없어요</strong>
          <p className="mt-1 text-xs text-muted">검색어나 필터를 바꿔보세요.</p>
          <button
            type="button"
            onClick={clearConditions}
            className="mt-3 rounded-full border border-line bg-surface px-3 py-2 text-xs font-bold"
          >
            전체 보기
          </button>
        </div>
      )}
    </section>
  )
}
