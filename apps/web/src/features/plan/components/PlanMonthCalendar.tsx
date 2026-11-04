import type { WardrobeItem } from '@closet/types'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'
import type { MonthCalendarDay, PlanEntry } from '../data/weeklyPlan'
import { getPlanEntryItems } from '../utils/plannerItems'
import { ArchivedWardrobeItemBadge } from '../../closet/components/ArchivedWardrobeItemBadge'

interface PlanMonthCalendarProps {
  days: MonthCalendarDay[]
  entries: PlanEntry[]
  items: WardrobeItem[]
  monthKey: string
  today: string
}

const weekdayLabels = ['월', '화', '수', '목', '금', '토', '일']

/** 월간 날짜와 저장한 코디의 대표 옷을 표시한다. 충분한 높이의 모바일 화면에서는 주 수에 따라 칸 높이를 나눠 전체 달력을 보여준다. 날짜 선택은 하루 편집으로 이동한다. */
export function PlanMonthCalendar({
  days,
  entries,
  items,
  monthKey,
  today,
}: PlanMonthCalendarProps) {
  const entryByDate = new Map(entries.map((entry) => [entry.date, entry]))
  const backPath = `/plan?view=month&month=${monthKey}`

  return (
    <section className="plan-month-calendar mt-4 overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="grid shrink-0 grid-cols-7 border-b border-line bg-canvas/70">
        {weekdayLabels.map((label, index) => (
          <span
            className={`py-2.5 text-center text-[10px] font-black sm:text-xs ${
              index === 6 ? 'text-accent' : 'text-muted'
            }`}
            key={label}
          >
            {label}
          </span>
        ))}
      </div>

      <div className="plan-month-calendar-days grid grid-cols-7" style={{ gridTemplateRows: `repeat(${Math.ceil(days.length / 7)}, minmax(0, 1fr))` }}>
        {days.map((day, index) => {
          const entry = entryByDate.get(day.date)
          const outfitItems = entry ? getPlanEntryItems(entry, items) : []
          const firstItem = outfitItems[0]
          const hasArchivedItems = outfitItems.some((item) => item.archivedAt)
          const isToday = day.date === today

          return (
            <Link
              to={`/plan/${day.date}?from=${encodeURIComponent(backPath)}`}
              className={`plan-month-calendar-day group relative min-h-20 min-w-0 p-1.5 transition hover:bg-canvas sm:min-h-32 sm:p-2.5 ${
                index % 7 !== 6 ? 'border-r border-line' : ''
              } ${index >= 7 ? 'border-t border-line' : ''} ${
                day.isCurrentMonth ? 'bg-surface' : 'bg-canvas/45 text-muted'
              }`}
              aria-label={`${day.date}${entry?.title ? `, ${entry.title}` : ', 저장된 코디 없음'}${entry?.wornAt ? ', 착용 완료' : ''}${hasArchivedItems ? ', 삭제된 옷 포함' : ''}`}
              key={day.date}
            >
              <span
                className={`plan-month-calendar-date flex size-6 items-center justify-center rounded-full text-[11px] font-black sm:size-7 sm:text-xs ${
                  isToday ? 'bg-accent text-white' : ''
                }`}
              >
                {day.dayNumber}
              </span>
              {entry?.wornAt && <span className="absolute top-2 right-1.5 inline-flex size-4 items-center justify-center rounded-full bg-sage text-accent sm:right-2.5" role="img" aria-label="착용 완료"><Check size={11} aria-hidden="true" /></span>}

              {firstItem ? (
                <>
                  <span className="plan-month-calendar-preview relative mt-1 flex h-10 items-center justify-center overflow-hidden rounded-lg bg-canvas sm:h-16 sm:rounded-xl">
                    <ClosetItemVisual item={firstItem} compact />
                    {firstItem.archivedAt && <ArchivedWardrobeItemBadge compact className="absolute inset-x-0 bottom-0 rounded-t-none" />}
                  </span>
                  <strong className="plan-month-calendar-caption mt-1.5 hidden truncate text-[10px] sm:block">
                    {entry?.title}
                  </strong>
                  {(entry?.itemIds.length ?? 0) > 1 && (
                    <span className="absolute right-1.5 bottom-1.5 rounded-full bg-ink px-1.5 py-0.5 text-[8px] font-black text-white sm:right-2.5 sm:bottom-2.5">
                      +{(entry?.itemIds.length ?? 1) - 1}
                    </span>
                  )}
                </>
              ) : (
                <span className="mt-3 hidden text-[9px] text-muted/70 sm:block">
                  비어 있음
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
