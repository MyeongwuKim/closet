import type { WardrobeItem } from '@closet/types'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'
import { outfitSelectionLabels, type OutfitSelectionCategory } from '../utils/outfitSelection'

interface OutfitReplacementPickerProps {
  category: OutfitSelectionCategory
  items: WardrobeItem[]
  onChoose: (item: WardrobeItem) => void
}

/** 여러 옷이 들어간 칸이 가득 찼을 때 어떤 옷을 바꿀지 먼저 고르게 한다. */
export function OutfitReplacementPicker({ category, items, onChoose }: OutfitReplacementPickerProps) {
  return (
    <section className="scrollbar-hidden h-full overflow-y-auto px-5 py-4" aria-label={`${outfitSelectionLabels[category]} 교체 대상 선택`}>
      <span className="text-[10px] font-black tracking-[0.08em] text-accent">내 옷장</span>
      <h2 className="mt-1 text-base font-black">어떤 아이템을 바꿀까요?</h2>
      <p className="mt-1 text-xs leading-5 text-muted">현재 Look에서 바꿀 옷을 고르면 같은 종류의 옷장이 열려요.</p>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => onChoose(item)}
            className="flex min-h-20 items-center gap-3 rounded-xl border border-line bg-surface p-2 text-left hover:border-accent"
            aria-label={`${item.name} 바꾸기`}
          >
            <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-canvas">
              <ClosetItemVisual item={item} compact />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-bold">{item.name}</span>
            <span className="shrink-0 pr-2 text-xs font-bold text-accent">바꾸기</span>
          </button>
        ))}
      </div>
    </section>
  )
}
