import type { WardrobeItem } from '@closet/types'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'
import type { MonthCalendarDay, PlanEntry } from '../data/weeklyPlan'
import { getPlanEntryItems } from '../utils/plannerItems'

interface PlanMonthCalendarProps {
  days: MonthCalendarDay[]
  entries: PlanEntry[]
  items: WardrobeItem[]
  monthKey: string
  today: string
}

const weekdayLabels = ['월', '화', '수', '목', '금', '토', '일']

/** 날짜마다 대표 옷·코디명·전체 개수를 표시한다. 작은 화면에서도 식별 정보를 유지하고 달력 안을 스크롤하며, 날짜 선택은 하루 상세로 이동한다. */
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
            className={`py-2.5 text-center text-xs font-semibold ${
              index === 6 ? 'text-accent' : 'text-muted'
            }`}
            key={label}
          >
            {label}
          </span>
        ))}
      </div>

      <div className="plan-month-calendar-days grid grid-cols-7" style={{ gridTemplateRows: `repeat(${Math.ceil(days.length / 7)}, minmax(4.5rem, 1fr))` }}>
        {days.map((day, index) => {
          const entry = entryByDate.get(day.date)
          const outfitItems = entry ? getPlanEntryItems(entry, items) : []
          const firstItem = outfitItems[0]
          const hasArchivedItems = outfitItems.some((item) => item.archivedAt)
          const isToday = day.date === today

          return (
            <Link
              to={`/plan/${day.date}?from=${encodeURIComponent(backPath)}`}
              className={`plan-month-calendar-day group relative flex min-h-18 min-w-0 flex-col p-1 transition hover:bg-canvas sm:min-h-40 sm:p-2.5 ${
                index % 7 !== 6 ? 'border-r border-line' : ''
              } ${index >= 7 ? 'border-t border-line' : ''} ${
                day.isCurrentMonth ? 'bg-surface' : 'bg-canvas/45 text-muted'
              }`}
              aria-label={`${day.date}${entry?.title ? `, ${entry.title}` : ', 저장된 코디 없음'}${entry?.wornAt ? ', 착용 완료' : ''}${hasArchivedItems ? ', 삭제된 옷 포함' : ''}`}
              title={entry?.title ?? undefined}
              key={day.date}
            >
              <span
                className={`plan-month-calendar-date flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold sm:size-7 ${
                  isToday ? 'bg-accent text-white' : ''
                }`}
              >
                {day.dayNumber}
              </span>
              {entry?.wornAt && <span className="absolute top-2 right-1.5 inline-flex size-4 items-center justify-center rounded-full bg-sage text-accent sm:right-2.5" role="img" aria-label="착용 완료"><Check size={11} aria-hidden="true" /></span>}

              {firstItem ? (
                <>
                  <span className="plan-month-calendar-preview relative mt-1 flex min-h-6 flex-1 items-center justify-center overflow-hidden rounded-lg bg-canvas sm:min-h-16 sm:rounded-xl">
                    <ClosetItemVisual item={firstItem} compact />
                    {firstItem.archivedAt ? <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-ink/85 px-0.5 text-xs leading-4 text-white"><span>삭제</span><span aria-label={`${entry?.itemIds.length ?? 0}개 아이템`}>{entry?.itemIds.length ?? 0}</span></span>
                      : <span className="absolute top-0 right-0 rounded-bl-md bg-ink px-1 text-xs leading-4 font-semibold text-white" aria-label={`${entry?.itemIds.length ?? 0}개 아이템`}>{entry?.itemIds.length ?? 0}개</span>}
                  </span>
                  <strong className="plan-month-calendar-caption mt-1 block h-4 shrink-0 truncate text-xs leading-4 font-medium sm:h-8 sm:whitespace-normal sm:break-all" title={entry?.title ?? undefined}>
                    {entry?.title}
                  </strong>
                </>
              ) : (
                <span className="mt-3 hidden text-xs text-muted sm:block">
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
