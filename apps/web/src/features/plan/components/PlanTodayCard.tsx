import type { WardrobeItem } from '@closet/types'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { PlanEntry } from '../data/weeklyPlan'
import { PlanOutfitStage } from './PlanOutfitStage'
import { PlanTodayEmptyState } from './PlanTodayEmptyState'
import { PlannerWearAction } from './PlannerWearAction'
import { getPlanEntryItems } from '../utils/plannerItems'

interface PlanTodayCardProps {
  entry: PlanEntry
  items: WardrobeItem[]
  isToday: boolean
  onChooseOutfit: () => void
}

/** 하루 코디의 상세와 착용 확인을 제공한다. 코디북으로 빠르게 교체하는 버튼은 착용 확인 전까지만 표시한다. */
export function PlanTodayCard({ entry, items, isToday, onChooseOutfit }: PlanTodayCardProps) {
  const date = new Date(`${entry.date}T00:00:00`)
  const formattedDate = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }).format(date)
  const backPath = isToday ? '/plan?view=today' : `/plan?view=today&date=${entry.date}`
  const editPath = `/plan/${entry.date}?from=${encodeURIComponent(backPath)}`
  const hasOutfit = Boolean(entry.outfitId || entry.itemIds.length || entry.previewImageUrl)
  const outfitItems = getPlanEntryItems(entry, items)
  const outfitDescription = entry.wornAt
    ? isToday ? '오늘 입은 코디' : '이날 입은 코디'
    : isToday ? '오늘 계획한 코디' : '이날 계획한 코디'
  return (
    <div className="plan-today-card flex min-h-0 flex-1 flex-col bg-surface">
      {hasOutfit ? (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <PlanOutfitStage items={outfitItems} />
          <div className="plan-today-caption flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
            <div className="min-w-0 flex-1 basis-24">
              <strong className="block truncate text-base font-medium tracking-[-.04em]">{entry.title || '저장한 코디'}</strong>
              <span className="mt-1 block truncate text-xs text-muted">{outfitDescription}</span>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Link
                to={editPath}
                className="inline-flex min-h-10 items-center gap-1 rounded-full bg-sage px-3 text-xs font-medium text-accent after:absolute after:inset-0 after:z-10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                aria-label={`${formattedDate}, ${entry.title || '저장한 코디'}, 옷 설정하기`}
              >
                코디 보기<ArrowUpRight size={14} strokeWidth={1.5} aria-hidden="true" />
              </Link>
              {!entry.wornAt && (
                <button
                  type="button"
                  onClick={onChooseOutfit}
                  className="relative z-20 inline-flex min-h-10 items-center rounded-full border border-line px-3 text-xs font-medium text-accent transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                >
                  코디 바꾸기
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <PlanTodayEmptyState isToday={isToday} editPath={editPath} onChooseOutfit={onChooseOutfit} />
      )}
      <PlannerWearAction entry={entry} />
    </div>
  )
}
