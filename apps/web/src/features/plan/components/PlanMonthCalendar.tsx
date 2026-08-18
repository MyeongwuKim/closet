import type { WardrobeItem } from '@closet/types'
import { Link } from 'react-router-dom'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'
import type { MonthCalendarDay, PlanEntry } from '../data/weeklyPlan'

interface PlanMonthCalendarProps {
  days: MonthCalendarDay[]
  entries: PlanEntry[]
  items: WardrobeItem[]
  monthKey: string
  today: string
}

const weekdayLabels = ['월', '화', '수', '목', '금', '토', '일']

export function PlanMonthCalendar({
  days,
  entries,
  items,
  monthKey,
  today,
}: PlanMonthCalendarProps) {
  const entryByDate = new Map(entries.map((entry) => [entry.date, entry]))
  const itemById = new Map(items.map((item) => [item.id, item]))
  const backPath = `/plan?view=month&month=${monthKey}`

  return (
    <section className="mt-4 overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="grid grid-cols-7 border-b border-line bg-canvas/70">
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

      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const entry = entryByDate.get(day.date)
          const firstItem = entry?.itemIds[0]
            ? itemById.get(entry.itemIds[0])
            : undefined
          const isToday = day.date === today

          return (
            <Link
              to={`/plan/${day.date}?from=${encodeURIComponent(backPath)}`}
              className={`group relative min-h-20 min-w-0 p-1.5 transition hover:bg-canvas sm:min-h-32 sm:p-2.5 ${
                index % 7 !== 6 ? 'border-r border-line' : ''
              } ${index >= 7 ? 'border-t border-line' : ''} ${
                day.isCurrentMonth ? 'bg-surface' : 'bg-canvas/45 text-muted'
              }`}
              aria-label={`${day.date}${entry?.title ? `, ${entry.title}` : ', 저장된 코디 없음'}`}
              key={day.date}
            >
              <span
                className={`flex size-6 items-center justify-center rounded-full text-[11px] font-black sm:size-7 sm:text-xs ${
                  isToday ? 'bg-accent text-white' : ''
                }`}
              >
                {day.dayNumber}
              </span>

              {firstItem ? (
                <>
                  <span className="mt-1 flex h-10 items-center justify-center overflow-hidden rounded-lg bg-canvas sm:h-16 sm:rounded-xl">
                    <ClosetItemVisual item={firstItem} compact />
                  </span>
                  <strong className="mt-1.5 hidden truncate text-[10px] sm:block">
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
