import type { WardrobeItem } from '@closet/types'
import { CalendarDays, Check, ChevronLeft, Shirt } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { formatRecentWearLabel } from '../../../utils/wearDate'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'
import { closetCategoryLabels } from '../../closet/constants'
import { getCenteredScrollTop } from '../utils/outfitPickerScroll'
import type { OutfitSlot } from './outfitSlots'

interface OutfitWardrobePickerProps {
  slot: OutfitSlot
  items: WardrobeItem[]
  selectedItems: WardrobeItem[]
  onClose: () => void
  onConfirm: (itemIds: string[]) => void
}

export function OutfitWardrobePicker({
  slot,
  items,
  selectedItems,
  onClose,
  onConfirm,
}: OutfitWardrobePickerProps) {
  const selectableItems = items.filter(
    (item) => item.classificationStatus === 'classified' && slot.matches(item),
  )
  const subcategories = [
    ...new Set(
      selectableItems
        .map((item) => item.subcategory?.trim())
        .filter((subcategory): subcategory is string => Boolean(subcategory)),
    ),
  ]
  const selectionLimit = slot.limit ?? 1
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const itemButtonRefs = useRef(new Map<string, HTMLButtonElement>())
  const initialSelectedItemIdRef = useRef(
    selectedItems.find((item) => slot.matches(item))?.id ?? null,
  )
  const [activeSubcategory, setActiveSubcategory] = useState('all')
  const [selectedIds, setSelectedIds] = useState(() =>
    selectedItems
      .filter((item) => slot.matches(item))
      .slice(0, selectionLimit)
      .map((item) => item.id),
  )
  const visibleItems =
    activeSubcategory === 'all'
      ? selectableItems
      : selectableItems.filter(
          (item) => item.subcategory === activeSubcategory,
        )

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

  return (
    <section
      className="classification-page-enter fixed inset-0 z-[110] flex h-dvh flex-col overflow-hidden bg-canvas text-ink"
      role="dialog"
      aria-modal="true"
      aria-label={`${slot.label} 옷 선택`}
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
            <h1 className="truncate text-lg font-black tracking-[-0.03em]">
              {slot.label} 고르기
            </h1>
            <p className="mt-0.5 text-xs text-muted">
              {selectionLimit > 1
                ? `최대 ${selectionLimit}개까지 선택할 수 있어요.`
                : '한 개를 선택할 수 있어요.'}
            </p>
          </div>
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
      </header>

      {subcategories.length > 0 && (
        <nav
          className="shrink-0 border-b border-line bg-canvas px-4 py-3 sm:px-6"
          aria-label={`${slot.label} 세부 카테고리`}
        >
          <div className="scrollbar-hidden mx-auto flex max-w-3xl gap-2 overflow-x-auto">
            {[
              { value: 'all', label: '전체' },
              ...subcategories.map((subcategory) => ({
                value: subcategory,
                label: subcategory,
              })),
            ].map((filter) => (
              <button
                type="button"
                onClick={() => setActiveSubcategory(filter.value)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition ${
                  activeSubcategory === filter.value
                    ? 'bg-ink text-white'
                    : 'border border-line bg-surface text-muted hover:border-ink hover:text-ink'
                }`}
                aria-pressed={activeSubcategory === filter.value}
                key={filter.value}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </nav>
      )}

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
                  ? formatRecentWearLabel(item.lastWornAt)
                  : null
                return (
                  <button
                    ref={(button) => {
                      if (button) itemButtonRefs.current.set(item.id, button)
                      else itemButtonRefs.current.delete(item.id)
                    }}
                    type="button"
                    onClick={() => toggleItem(item.id)}
                    className={`relative overflow-hidden rounded-3xl bg-surface p-2 text-left transition ${
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
                        {item.category
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
                <Shirt size={24} />
              </span>
              <h2 className="mt-5 text-lg font-black">
                고를 수 있는 {slot.label}가 없어요
              </h2>
              <p className="mt-2 text-sm text-muted">
                옷장에 {slot.label}를 먼저 추가해주세요.
              </p>
            </div>
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(27,27,24,0.06)]">
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
    </section>
  )
}
