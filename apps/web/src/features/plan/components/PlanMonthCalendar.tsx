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
  /** 배정 팝업에서는 같은 날짜 그리드에서 빈 날과 코디가 있는 날을 표시하고 선택만 받는다. */
  selection?: {
    date: string
    onSelect: (date: string) => void
    isLoading: boolean
    disabled: boolean
  }
}

const weekdayLabels = ['월', '화', '수', '목', '금', '토', '일']

function CalendarStatusMark({ occupied }: { occupied?: boolean }) {
  return <span aria-hidden="true" className={`size-2 shrink-0 rounded-full border ${occupied ? 'border-accent bg-accent' : 'border-muted'}`} />
}

/** 같은 월간 날짜 그리드에서 월간 플래너는 코디를 열고 배정 팝업은 날짜를 고른다. */
export function PlanMonthCalendar({
  days,
  entries,
  items,
  monthKey,
  today,
  selection,
}: PlanMonthCalendarProps) {
  const entryByDate = new Map(entries.map((entry) => [entry.date, entry]))
  const backPath = `/plan?view=month&month=${monthKey}`

  return (
    <section aria-label={selection ? '담을 날짜' : undefined}
      className={selection ? 'mt-3 overflow-hidden rounded-xl border border-line bg-surface' : 'plan-month-calendar mt-4 overflow-hidden rounded-3xl border border-line bg-surface'}>
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

      <div className={selection ? 'grid grid-cols-7' : 'plan-month-calendar-days grid grid-cols-7'}
        style={selection ? undefined : { gridTemplateRows: `repeat(${Math.ceil(days.length / 7)}, minmax(4.5rem, 1fr))` }}>
        {days.map((day, index) => {
          const entry = entryByDate.get(day.date)
          const isToday = day.date === today
          if (selection) {
            const occupied = Boolean(entry?.outfitId)
            const stateLabel = occupied ? '코디 있음' : '비어 있음'
            const isSelected = selection.date === day.date
            return <button key={day.date} type="button" onClick={() => selection.onSelect(day.date)}
              aria-pressed={isSelected} aria-current={isToday ? 'date' : undefined}
              aria-label={`${day.date}${!day.isCurrentMonth || selection.isLoading ? '' : `, ${stateLabel}`}`}
              title={entry?.title || undefined} disabled={selection.disabled || !day.isCurrentMonth || Boolean(entry?.wornAt)}
              className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 border-t border-line text-sm font-semibold transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent disabled:cursor-default ${
                index % 7 === 6 ? '' : 'border-r'
              } ${isSelected ? 'bg-sage text-ink ring-1 ring-inset ring-accent' : 'enabled:hover:bg-canvas'} ${
                !day.isCurrentMonth ? 'text-muted' : isToday ? 'text-accent' : ''
              }`}>
              <span>{day.dayNumber}</span>
              <span className="grid size-3 place-items-center">
                {day.isCurrentMonth && !selection.isLoading && <CalendarStatusMark occupied={occupied} />}
              </span>
            </button>
          }
          const outfitItems = entry ? getPlanEntryItems(entry, items) : []
          const firstItem = outfitItems[0]
          const hasArchivedItems = outfitItems.some((item) => item.archivedAt)

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
      {selection && <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 border-t border-line px-2 py-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><CalendarStatusMark />빈 날짜</span>
        <span className="inline-flex items-center gap-1.5"><CalendarStatusMark occupied />코디 있음</span>
      </div>}
    </section>
  )
}
