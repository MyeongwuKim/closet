import type { WardrobeItem } from '@closet/types'
import { Check, Plus, Shirt } from 'lucide-react'
import { OutfitItemsPreview } from '../../lookbook/components/OutfitItemsPreview'
import type { PlanEntry } from '../data/weeklyPlan'

interface WeeklyPlanDayButtonProps {
  entry: PlanEntry
  items: WardrobeItem[]
  isActive: boolean
  onSelect: (date: string) => void
}

/** 주간 편집의 날짜 선택 버튼. 코디가 있으면 구성 옷 사진과 체크를 표시하고, 빈 날짜는 추가 표시를 보여준다. 선택은 부모에 날짜만 전달하며 저장하지 않는다. */
export function WeeklyPlanDayButton({ entry, items, isActive, onSelect }: WeeklyPlanDayButtonProps) {
  const hasOutfit = Boolean(entry.outfitId || entry.itemIds.length || entry.previewImageUrl)
  const layers = entry.itemIds.map((wardrobeItemId, order) => ({ wardrobeItemId, order }))
  const hasItemImages = entry.itemIds.some((itemId) => {
    const item = items.find((candidate) => candidate.id === itemId)
    return Boolean(item?.imageUrl || item?.originalImageUrl)
  })

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.date)}
      className={`w-[76px] shrink-0 rounded-2xl border px-2 py-2 text-ink transition ${
        isActive ? 'border-accent bg-sage ring-1 ring-accent/25' : 'border-line bg-surface hover:border-accent'
      }`}
      aria-pressed={isActive}
      aria-label={`${entry.dayLabel}요일 ${entry.dayNumber}, ${hasOutfit ? `${entry.title || '저장한 코디'}, 설정됨` : '저장된 코디 없음'}`}
    >
      <span className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-medium text-muted">{entry.dayLabel}요일</span>
        <strong className="text-base font-semibold">{entry.dayNumber}</strong>
      </span>
      <div className="relative mt-2 flex h-12 w-full items-center justify-center" aria-hidden="true">
        <div className={`flex size-full items-center justify-center overflow-hidden rounded-lg ${hasOutfit ? 'bg-canvas' : 'border border-dashed border-line bg-canvas/50 text-muted'}`}>
          {hasOutfit ? (
            hasItemImages ? (
              <OutfitItemsPreview items={items} layers={layers} className="size-full" />
            ) : <Shirt size={20} strokeWidth={1.5} className="text-accent" />
          ) : <Plus size={18} strokeWidth={1.5} />}
        </div>
        {hasOutfit && (
          <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border-2 border-surface bg-accent text-white">
            <Check size={11} strokeWidth={2.5} />
          </span>
        )}
      </div>
    </button>
  )
}
