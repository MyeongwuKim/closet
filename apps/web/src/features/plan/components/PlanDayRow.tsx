import type { WardrobeItem } from '@closet/types'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { PlanEntry } from '../data/weeklyPlan'
import { PlanOutfitThumbnails } from './PlanOutfitThumbnails'

interface PlanDayRowProps {
  entry: PlanEntry
  items: WardrobeItem[]
  isToday: boolean
}

export function PlanDayRow({ entry, items, isToday }: PlanDayRowProps) {
  return (
    <Link
      to={`/plan/${entry.date}`}
      className={`grid min-h-11 grid-cols-[38px_minmax(0,1fr)_16px] items-center gap-2 rounded-xl border bg-surface px-2 py-1.5 transition hover:border-ink sm:grid-cols-[58px_minmax(220px,0.85fr)_minmax(180px,1fr)_auto] sm:gap-3 sm:rounded-2xl sm:p-4 sm:hover:-translate-y-0.5 ${
        isToday ? 'border-accent shadow-[inset_3px_0_0_#f05a3c]' : 'border-line'
      }`}
      aria-current={isToday ? 'date' : undefined}
    >
      <span className="text-center">
        <strong className="block text-lg leading-none font-black sm:text-xl sm:leading-normal">
          {entry.dayNumber}
        </strong>
        <span
          className={`mt-1 block text-[11px] leading-none sm:mt-0 sm:text-xs sm:leading-normal ${
            isToday ? 'font-bold text-accent' : 'text-muted'
          }`}
        >
          {entry.dayLabel}
          <span className="hidden sm:inline">{isToday ? ' · 오늘' : ''}</span>
        </span>
      </span>

      <span className="hidden min-w-0 sm:block">
        <strong className="block truncate text-sm">
          {entry.title || '코디를 설정해주세요'}
        </strong>
        <span className="mt-1 block text-xs text-muted">
          {[entry.occasion, entry.weather].filter(Boolean).join(' · ') ||
            '저장된 코디 없음'}
        </span>
      </span>

      <PlanOutfitThumbnails items={items} />
      <ChevronRight className="size-4 text-muted sm:size-[18px]" />
    </Link>
  )
}
