import { useMemo, useState } from 'react'
import type { WardrobeItem } from '@closet/types'
import { Check } from 'lucide-react'
import {
  closetCategoryFilters,
  type ClosetFilter,
} from '../../closet/constants'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'

type ComposerFilter = Exclude<ClosetFilter, 'pending'>

interface ComposerClosetPanelProps {
  items: WardrobeItem[]
  selectedIds: string[]
  onToggleItem: (item: WardrobeItem) => void
}

export function ComposerClosetPanel({
  items,
  selectedIds,
  onToggleItem,
}: ComposerClosetPanelProps) {
  const [filter, setFilter] = useState<ComposerFilter>('all')
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const visibleFilters = closetCategoryFilters.filter(
    (category): category is { label: string; value: ComposerFilter } =>
      category.value !== 'pending' &&
      (category.value === 'all' ||
        items.some((item) => item.category === category.value)),
  )
  const filteredItems = items.filter(
    (item) => filter === 'all' || item.category === filter,
  )

  return (
    <section className="flex min-h-0 flex-col border-t border-line bg-canvas lg:border-t-0 lg:border-l">
      <div className="shrink-0 px-4 pt-3 sm:px-5 lg:pt-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-black">내 옷장</h2>
            <p className="mt-0.5 text-xs text-muted">
              누르면 코디에 추가하거나 뺄 수 있어요.
            </p>
          </div>
          <span className="shrink-0 text-xs font-bold text-accent">
            {selectedIds.length}개 선택
          </span>
        </div>

        <div className="scrollbar-hidden mt-3 flex gap-2 overflow-x-auto pb-2">
          {visibleFilters.map((item) => (
            <button
              type="button"
              onClick={() => setFilter(item.value)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                filter === item.value
                  ? 'bg-ink text-white'
                  : 'border border-line bg-surface text-muted'
              }`}
              key={item.value}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-5 sm:px-5">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-3 xl:grid-cols-4">
          {filteredItems.map((item) => {
            const isSelected = selectedIdSet.has(item.id)

            return (
              <button
                type="button"
                onClick={() => onToggleItem(item)}
                className={`relative min-w-0 rounded-2xl bg-surface p-1.5 text-left ${
                  isSelected
                    ? 'ring-2 ring-accent'
                    : 'shadow-[inset_0_0_0_1px_#dedad1]'
                }`}
                aria-pressed={isSelected}
                key={item.id}
              >
                {isSelected && (
                  <span className="absolute top-2 right-2 z-10 flex size-5 items-center justify-center rounded-full bg-accent text-white">
                    <Check size={12} />
                  </span>
                )}
                <span className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-canvas">
                  <ClosetItemVisual item={item} compact />
                </span>
                <span className="mt-1.5 block truncate px-1 pb-0.5 text-[11px] font-bold">
                  {item.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
