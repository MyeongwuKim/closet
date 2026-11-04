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
}

/** 플래너 → 하루 보기. 코디 미리보기는 날짜 편집 링크로 열고, 오늘·지난 날짜의 실제 착용 확인은 링크 밖의 별도 조작으로 제공한다. */
export function PlanTodayCard({ entry, items, isToday }: PlanTodayCardProps) {
  const date = new Date(`${entry.date}T00:00:00`)
  const formattedDate = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }).format(date)
  const backPath = isToday ? '/plan?view=today' : `/plan?view=today&date=${entry.date}`
  const hasOutfit = Boolean(entry.outfitId || entry.itemIds.length || entry.previewImageUrl)
  const outfitItems = getPlanEntryItems(entry, items)
  const outfitDescription = entry.wornAt
    ? isToday ? '오늘 입은 코디' : '이날 입은 코디'
    : isToday ? '오늘 계획한 코디' : '이날 계획한 코디'
  return (
    <div className="plan-today-card flex min-h-0 flex-1 flex-col bg-surface">
    <Link
      to={`/plan/${entry.date}?from=${encodeURIComponent(backPath)}`}
      className="group flex min-h-0 flex-1 flex-col overflow-hidden bg-surface transition-colors focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      aria-label={`${formattedDate}, ${hasOutfit ? entry.title || '저장한 코디' : '저장된 코디 없음'}, 옷 설정하기`}
    >
      {hasOutfit ? (
        <>
          <PlanOutfitStage items={outfitItems} />
          <span className="plan-today-caption block shrink-0 px-4 py-3">
            <strong className="block truncate text-base font-medium tracking-[-.04em]">{entry.title || '저장한 코디'}</strong>
            <span className="mt-1 flex items-center justify-between gap-3">
              <span className="text-xs text-muted">{outfitDescription}</span>
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-sage px-3 py-2 text-xs font-medium text-accent">코디 보기<ArrowUpRight size={14} strokeWidth={1.5} /></span>
            </span>
          </span>
        </>
      ) : <PlanTodayEmptyState isToday={isToday} />}
    </Link>
    <PlannerWearAction entry={entry} />
    </div>
  )
}
