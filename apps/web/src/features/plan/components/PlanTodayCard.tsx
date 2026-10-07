import type { WardrobeItem } from '@closet/types'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { PlanEntry } from '../data/weeklyPlan'
import { PlanOutfitStage } from './PlanOutfitStage'
import { PlanTodayEmptyState } from './PlanTodayEmptyState'

interface PlanTodayCardProps {
  entry: PlanEntry
  items: WardrobeItem[]
  isToday: boolean
}

/** 플래너 → 오늘 보기. 실제 코디 또는 빈 상태 안내와 선택 동작을 한 카드에 표시한다. 카드 전체가 하나의 링크이며 해당 날짜의 코디 편집 화면으로 이동한다. */
export function PlanTodayCard({ entry, items, isToday }: PlanTodayCardProps) {
  const date = new Date(`${entry.date}T00:00:00`)
  const formattedDate = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }).format(date)
  const backPath = isToday ? '/plan?view=today' : `/plan?view=today&date=${entry.date}`
  const hasOutfit = Boolean(entry.outfitId || entry.itemIds.length || entry.previewImageUrl)
  const outfitDescription = isToday ? '오늘 입을 코디' : '이날 입을 코디'
  return (
    <Link
      to={`/plan/${entry.date}?from=${encodeURIComponent(backPath)}`}
      className="plan-today-card group flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-line bg-surface transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      aria-label={`${formattedDate}, ${hasOutfit ? entry.title || '저장한 코디' : '저장된 코디 없음'}, 옷 설정하기`}
    >
      {hasOutfit ? (
        <>
          <PlanOutfitStage items={items} />
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
  )
}
