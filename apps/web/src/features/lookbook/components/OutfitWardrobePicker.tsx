import type { Season, WardrobeItem } from '@closet/types'
import { ArrowDown, ArrowUp, CalendarDays, Check, ChevronLeft, Search, SlidersHorizontal, X } from 'lucide-react'
import { CatalogSearchField } from '../../../components/CatalogSearchField'
import { ClothingCategoryIcon } from '../../../components/ClothingCategoryIcon'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatRecentWearLabel } from '../../../utils/wearDate'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'
import { closetCategoryLabels } from '../../closet/constants'
import { wardrobeItemMatchesSearch } from '../../closet/utils/wardrobeTags'
import { useOutfitRecentWearFilter } from '../hooks/useOutfitRecentWearFilter'
import { filterOutfitItems, getOutfitItemFilterOptions } from '../utils/outfitItemFilters'
import { getOutfitLayerSlot } from '../utils/outfitSelection'
import { getCenteredScrollTop } from '../utils/outfitPickerScroll'
import type { OutfitWardrobeItem } from '../types'
import type { OutfitSlot } from './outfitSlots'
import { getOutfitSelectionCapacity } from '../utils/outfitSelection'
import { OutfitSubcategoryChips } from './OutfitSubcategoryChips'
import { OutfitWardrobeFilters } from './OutfitWardrobeFilters'

interface OutfitWardrobePickerProps {
  slot: OutfitSlot
  items: WardrobeItem[]
  selectedItems: OutfitWardrobeItem[]
  allowAdditionalLayers?: boolean
  maxSelections?: number
  orderSelections?: boolean
  onClose: () => void
  onConfirm: (itemIds: string[]) => void
}

/** 슬롯의 옷을 검색어·세부 종류·계절·색상·최근 착용 조건으로 좁히되 이미 고른 옷은 유지한다. 완료하면 선택한 ID를 부모에 전달한다. */
export function OutfitWardrobePicker({
  slot,
  items,
  selectedItems,
  allowAdditionalLayers = false,
  maxSelections,
  orderSelections = false,
  onClose,
  onConfirm,
}: OutfitWardrobePickerProps) {
  const selectableItems = items.filter(
    (item) => item.classificationStatus === 'classified' &&
      (slot.matches(item) || (allowAdditionalLayers && getOutfitLayerSlot(item, slot.id))) &&
      !selectedItems.some((selected) => selected.id === item.id && (!slot.matches(selected) || (!orderSelections && selected.isBaseLayer))),
  )
  const subcategories = [
    ...new Set(
      selectableItems
        .map((item) => item.subcategory?.trim())
        .filter((subcategory): subcategory is string => Boolean(subcategory)),
    ),
  ]
  const selectionLimit = maxSelections ?? getOutfitSelectionCapacity(slot.id, selectedItems)
  const filterPanelId = useId()
  const searchButtonRef = useRef<HTMLButtonElement>(null)
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const itemButtonRefs = useRef(new Map<string, HTMLButtonElement>())
  const initialSelectedItemIdRef = useRef(
    selectedItems.find((item) => (orderSelections || !item.isBaseLayer) && slot.matches(item))?.id ?? null,
  )
  const [activeSubcategory, setActiveSubcategory] = useState('all')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [season, setSeason] = useState<Season | null>(null)
  const [color, setColor] = useState<string | null>(null)
  const { recentWearDays, today, hideRecentlyWorn, setHideRecentlyWorn } =
    useOutfitRecentWearFilter()
  const [selectedIds, setSelectedIds] = useState(() =>
    selectedItems
      .filter((item) => (orderSelections || !item.isBaseLayer) && slot.matches(item))
      .slice(0, selectionLimit)
      .map((item) => item.id),
  )
  const filterOptions = getOutfitItemFilterOptions(selectableItems)
  const activeFilterCount = Number(season !== null) + Number(color !== null) + Number(hideRecentlyWorn)
  const visibleItems = filterOutfitItems(selectableItems, {
    query: '',
    season,
    color,
    recentWear: hideRecentlyWorn ? { intervalDays: recentWearDays, today } : undefined,
  }).filter(
    (item) =>
      (activeSubcategory === 'all' || item.subcategory?.trim() === activeSubcategory)
      && wardrobeItemMatchesSearch(item, query),
  )
  const hasSearchQuery = Boolean(query.trim())

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (isSearchOpen) {
        setIsSearchOpen(false)
        setQuery('')
        searchButtonRef.current?.focus()
        return
      }
      if (isFilterOpen) {
        setIsFilterOpen(false)
        filterButtonRef.current?.focus()
        return
      }
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isFilterOpen, isSearchOpen, onClose])

  useLayoutEffect(() => {
    const selectedItemId = initialSelectedItemIdRef.current
    const scrollContainer = scrollContainerRef.current
    const itemButton = selectedItemId
      ? itemButtonRefs.current.get(selectedItemId)
      : null
    if (!scrollContainer || !itemButton) return

    const containerRect = scrollContainer.getBoundingClientRect()
    const itemRect = itemButton.getBoundingClientRect()
    const centeredScrollTop = getCenteredScrollTop({
      currentScrollTop: scrollContainer.scrollTop,
      containerTop: containerRect.top,
      containerHeight: scrollContainer.clientHeight,
      itemTop: itemRect.top,
      itemHeight: itemRect.height,
    })

    scrollContainer.scrollTo({
      top: centeredScrollTop,
      behavior: 'auto',
    })
  }, [])

  const toggleItem = (itemId: string) => {
    setSelectedIds((currentIds) => {
      if (currentIds.includes(itemId)) {
        return currentIds.filter((selectedId) => selectedId !== itemId)
      }
      if (selectionLimit === 1) return [itemId]
      if (currentIds.length >= selectionLimit) return currentIds
      return [...currentIds, itemId]
    })
  }

  /** 위쪽에 있는 옷을 몸에 더 가까운 레이어로 저장한다. */
  const moveSelectedItem = (index: number, offset: number) => {
    const nextIndex = index + offset
    if (nextIndex < 0 || nextIndex >= selectedIds.length) return
    const next = [...selectedIds]
    const [itemId] = next.splice(index, 1)
    next.splice(nextIndex, 0, itemId)
    setSelectedIds(next)
  }

  return createPortal(
    <section
      className="classification-page-enter fixed inset-0 z-[110] flex h-dvh flex-col overflow-hidden bg-canvas text-ink"
      role="dialog"
      aria-modal="true"
      aria-label={orderSelections ? '받쳐 입는 옷 선택' : `${slot.label} 옷 선택`}
    >
      <header className="shrink-0 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-3xl items-center gap-2 px-3 py-2 sm:min-h-18 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-surface"
            aria-label="코디 설정으로 돌아가기"
            autoFocus
          >
            <ChevronLeft size={25} strokeWidth={2.2} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-[-0.03em]">
              {slot.label} 고르기
            </h1>
            <p className="mt-0.5 text-xs text-muted">
              {selectionLimit === 0
                ? '코디에 8개가 들어있어요. 다른 아이템을 빼고 골라주세요.'
                : slot.id === 'bag'
                ? '코디에 함께 들 가방을 하나 골라주세요.'
                : selectionLimit > 1
                ? `최대 ${selectionLimit}개까지 선택할 수 있어요.`
                : '한 개를 선택할 수 있어요.'}
            </p>
          </div>
          <button
            ref={searchButtonRef}
            type="button"
            onClick={() => {
              if (isSearchOpen) setQuery('')
              setIsSearchOpen(!isSearchOpen)
            }}
            className={`flex size-10 shrink-0 items-center justify-center rounded-full border ${
              isSearchOpen ? 'border-accent bg-sage text-accent' : 'border-line bg-surface text-muted'
            }`}
            aria-label={isSearchOpen ? '검색 닫기' : `${slot.label} 검색`}
            aria-expanded={isSearchOpen}
          >
            {isSearchOpen ? <X size={18} /> : <Search size={18} />}
          </button>
          <button
            ref={filterButtonRef}
            type="button"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`relative flex size-10 shrink-0 items-center justify-center rounded-full border ${
              isFilterOpen || activeFilterCount > 0
                ? 'border-ink bg-ink text-white'
                : 'border-line bg-surface text-muted'
            }`}
            aria-label={`${slot.label} 필터`}
            aria-expanded={isFilterOpen}
            aria-controls={filterPanelId}
          >
            <SlidersHorizontal size={18} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white" aria-hidden="true">
                {activeFilterCount}
              </span>
            )}
          </button>
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="shrink-0 rounded-full border border-line bg-surface px-3 py-2 text-xs font-bold text-muted hover:border-ink hover:text-ink"
            >
              선택 해제
            </button>
          )}
        </div>
        <div className={`mx-auto max-w-3xl px-4 sm:px-6 max-sm:[&_input]:text-base! ${isFilterOpen ? 'pb-3' : ''}`}>
          <CatalogSearchField
            isOpen={isSearchOpen}
            value={query}
            label={`${slot.label} 검색어`}
            placeholder="이름, 브랜드, 색상 검색"
            onChange={(value) => {
              setQuery(value)
              scrollContainerRef.current?.scrollTo({ top: 0 })
            }}
          />
          <OutfitWardrobeFilters
            id={filterPanelId}
            isOpen={isFilterOpen}
            options={filterOptions}
            season={season}
            color={color}
            recentWearDays={recentWearDays}
            hideRecentlyWorn={hideRecentlyWorn}
            onSeasonChange={(value) => {
              setSeason(value)
              scrollContainerRef.current?.scrollTo({ top: 0 })
            }}
            onColorChange={(value) => {
              setColor(value?.name ?? null)
              scrollContainerRef.current?.scrollTo({ top: 0 })
            }}
            onHideRecentlyWornChange={(value) => {
              setHideRecentlyWorn(value)
              scrollContainerRef.current?.scrollTo({ top: 0 })
            }}
            onClear={() => {
              setSeason(null)
              setColor(null)
              setHideRecentlyWorn(false)
              scrollContainerRef.current?.scrollTo({ top: 0 })
            }}
          />
        </div>
      </header>

      <OutfitSubcategoryChips
        label={slot.label}
        options={subcategories}
        value={activeSubcategory}
        onChange={setActiveSubcategory}
        className="shrink-0 border-b border-line bg-canvas px-4 py-3 sm:px-6"
      />

      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6"
      >
        <div className="mx-auto max-w-3xl">
          {visibleItems.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {visibleItems.map((item) => {
                const isSelected = selectedIds.includes(item.id)
                const wearLabel = item.lastWornAt
                  ? formatRecentWearLabel(item.lastWornAt, today)
                  : null
                return (
                  <button
                    ref={(button) => {
                      if (button) itemButtonRefs.current.set(item.id, button)
                      else itemButtonRefs.current.delete(item.id)
                    }}
                    type="button"
                    disabled={!isSelected && selectionLimit === 0}
                    onClick={() => toggleItem(item.id)}
                    className={`relative overflow-hidden rounded-3xl bg-surface p-2 text-left transition disabled:opacity-50 ${
                      isSelected
                        ? 'ring-2 ring-accent ring-offset-2 ring-offset-canvas'
                        : 'shadow-[inset_0_0_0_1px_#dedad1] hover:shadow-sm'
                    }`}
                    aria-pressed={isSelected}
                    key={item.id}
                  >
                    <span className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[1.25rem] bg-canvas">
                      <ClosetItemVisual item={item} />
                      {wearLabel && (
                        <span className="pointer-events-none absolute bottom-2 left-2 flex max-w-[calc(100%_-_1rem)] items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[10px] font-bold text-white shadow-sm backdrop-blur">
                          <CalendarDays className="shrink-0" size={11} />
                          <span className="truncate">{wearLabel}</span>
                        </span>
                      )}
                    </span>
                    <span className="block px-2 pt-3 pb-2">
                      <strong className="block truncate text-sm">
                        {item.name}
                      </strong>
                      <span className="mt-1 block truncate text-xs text-muted">
                        {slot.id === 'bag'
                          ? '소품'
                          : item.category
                            ? closetCategoryLabels[item.category]
                            : '미분류'}
                        {item.subcategory ? ` · ${item.subcategory}` : ''}
                        {item.colorName ? ` · ${item.colorName}` : ''}
                      </span>
                    </span>
                    {isSelected && (
                      <span className="absolute top-4 right-4 flex size-7 items-center justify-center rounded-full bg-accent text-white shadow-sm">
                        <Check size={16} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-line bg-surface px-6 py-14 text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-sage">
                <ClothingCategoryIcon
                  category={slot.iconCategory}
                  size={26}
                />
              </span>
              <h2 className="mt-5 text-lg font-semibold">
                {hasSearchQuery
                  ? '검색 결과가 없어요'
                  : activeFilterCount > 0
                    ? '필터에 맞는 옷이 없어요'
                    : `고를 수 있는 ${slot.label}가 없어요`}
              </h2>
              <p className="mt-2 text-sm text-muted">
                {hideRecentlyWorn
                  ? '최근 착용 숨기기를 끄거나 다른 조건을 골라보세요.'
                  : hasSearchQuery || activeFilterCount > 0
                    ? '검색어나 필터를 바꿔보세요.'
                    : `옷장에 ${slot.label}를 먼저 추가해주세요.`}
              </p>
            </div>
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(27,27,24,0.06)]">
        {orderSelections && selectedIds.length > 0 && (
          <section aria-label="받쳐 입는 순서" className="mx-auto mb-2 max-w-3xl">
            <p className="text-xs font-semibold">몸에 가까운 순서</p>
            <ol className="max-h-36 overflow-y-auto">
              {selectedIds.map((id, index) => {
                const name = items.find((item) => item.id === id)?.name ?? selectedItems.find((item) => item.id === id)?.name
                return (
                  <li key={id} className="flex items-center border-b border-line text-xs">
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                    <button type="button" aria-label={`${name} 안쪽으로 이동`} disabled={index === 0} onClick={() => moveSelectedItem(index, -1)} className="grid size-11 shrink-0 place-items-center text-accent disabled:opacity-30">
                      <ArrowUp size={15} aria-hidden="true" />
                    </button>
                    <button type="button" aria-label={`${name} 바깥쪽으로 이동`} disabled={index === selectedIds.length - 1} onClick={() => moveSelectedItem(index, 1)} className="grid size-11 shrink-0 place-items-center text-accent disabled:opacity-30">
                      <ArrowDown size={15} aria-hidden="true" />
                    </button>
                    <button type="button" aria-label={`${name} 선택 해제`} onClick={() => toggleItem(id)} className="grid size-11 shrink-0 place-items-center text-muted">
                      <X size={15} aria-hidden="true" />
                    </button>
                  </li>
                )
              })}
            </ol>
          </section>
        )}
        <button
          type="button"
          onClick={() => onConfirm(selectedIds)}
          className="mx-auto flex w-full max-w-3xl items-center justify-center rounded-xl bg-accent px-4 py-3.5 text-sm font-bold text-white"
        >
          {selectedIds.length > 0
            ? `${selectedIds.length}개 선택 완료`
            : '선택 없이 완료'}
        </button>
      </footer>
    </section>,
    document.body,
  )
}
