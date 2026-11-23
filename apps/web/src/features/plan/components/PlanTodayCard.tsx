import type { WardrobeItem } from '@closet/types'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { PlanEntry } from '../data/weeklyPlan'
import { PlanOutfitStage } from './PlanOutfitStage'
import { PlanTodayEmptyState } from './PlanTodayEmptyState'
import { PlannerWearAction } from './PlannerWearAction'
import { createPlannerComposerPath } from '../../lookbook/utils/outfitComposerNavigation'
import { getPlanEntryItems } from '../utils/plannerItems'

interface PlanTodayCardProps {
  entry: PlanEntry
  items: WardrobeItem[]
  isToday: boolean
  onChooseOutfit: () => void
}

/** 코디 사진과 이름을 누르면 날짜 상세가 열린다. 착용 확인은 카드 아래에서 바로 할 수 있다. */
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
        <Link
          to={editPath}
          className="group flex min-h-0 flex-1 flex-col overflow-hidden focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2"
          aria-label={`${formattedDate}, ${entry.title || '저장한 코디'}, 옷 설정하기`}
        >
          <PlanOutfitStage items={outfitItems} />
          <span className="plan-today-caption flex shrink-0 items-center gap-3 px-4 py-3 transition-colors group-hover:bg-canvas">
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-base font-medium tracking-[-.04em]">{entry.title || '저장한 코디'}</strong>
              <span className="mt-1 block truncate text-xs text-muted">{outfitDescription}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-accent" aria-hidden="true" />
          </span>
        </Link>
      ) : (
        <PlanTodayEmptyState isToday={isToday} editPath={createPlannerComposerPath(entry.date, backPath)} onChooseOutfit={onChooseOutfit} />
      )}
      <PlannerWearAction entry={entry} />
    </div>
  )
}
