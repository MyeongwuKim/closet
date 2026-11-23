import { useEffect, useId, useState } from 'react'
import type { WardrobeItem } from '@closet/types'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { useUiStore } from '../../../stores/useUiStore'
import type { SavedOutfit } from '../../lookbook/types'
import { usePlannerEntriesQuery } from '../api/plannerQueries'
import { createMonthCalendar, formatMonthKey } from '../data/weeklyPlan'
import { useKoreaPlannerToday } from '../hooks/useKoreaPlannerToday'
import { usePlannerOutfitAssignment } from '../hooks/usePlannerOutfitAssignment'
import { PlanMonthCalendar } from './PlanMonthCalendar'

const monthLabel = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' })
const dateLabel = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' })

/** 코디북에서 선택한 코디의 배정일을 고르고 플래너의 기존 교체·착용 보호를 적용한다. */
export function PlannerOutfitAssignmentDialog({ outfit, items, onClose }: { outfit: SavedOutfit; items: WardrobeItem[]; onClose: () => void }) {
  const today = useKoreaPlannerToday()
  const [date, setDate] = useState(today)
  const [month, setMonth] = useState(today.slice(0, 7))
  const titleId = useId()
  const monthDays = createMonthCalendar(month)
  const monthQuery = usePlannerEntriesQuery(monthDays[0]?.date ?? '', monthDays.at(-1)?.date ?? '')
  const assignment = usePlannerOutfitAssignment(outfit, date, items)
  const { isBusy, replacement, cancelReplacement } = assignment
  const monthEntry = monthQuery.data?.find((entry) => entry.date === date)
  const selectedEntry = assignment.target.data?.find((entry) => entry.date === date) ?? monthEntry
  const isProtected = Boolean(monthEntry?.wornAt || selectedEntry?.wornAt)
  const isLocked = isBusy || Boolean(replacement)
  const hasMonthSchedule = monthQuery.isSuccess

  const moveMonth = (offset: number) => {
    const nextMonth = new Date(`${month}-01T00:00:00`)
    nextMonth.setMonth(nextMonth.getMonth() + offset)
    setMonth(formatMonthKey(nextMonth))
    setDate('')
  }

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || isBusy || useUiStore.getState().recentWearConfirmation) return
      event.preventDefault()
      if (replacement) cancelReplacement()
      else onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [cancelReplacement, isBusy, onClose, replacement])

  return <>
    <div className="option-picker-backdrop fixed inset-0 z-[115] flex items-center justify-center bg-ink/40 px-4 py-6"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !isLocked) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} inert={Boolean(replacement)}
        className="option-picker-enter max-h-[calc(100dvh-3rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl border border-line bg-surface p-4 shadow-2xl sm:p-5">
        <h2 id={titleId} className="text-lg font-semibold">플래너에 담기</h2>
        <p className="mt-1 break-words text-sm text-muted">{outfit.name}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" aria-label="이전 달" disabled={isLocked} onClick={() => moveMonth(-1)}
            className="grid size-11 place-items-center rounded-full border border-line hover:bg-canvas disabled:opacity-40">
            <ChevronLeft size={19} aria-hidden="true" />
          </button>
          <h3 className="text-base font-semibold" aria-live="polite">{monthLabel.format(new Date(`${month}-01T00:00:00`))}</h3>
          <button type="button" aria-label="다음 달" disabled={isLocked} onClick={() => moveMonth(1)}
            className="grid size-11 place-items-center rounded-full border border-line hover:bg-canvas disabled:opacity-40">
            <ChevronRight size={19} aria-hidden="true" />
          </button>
        </div>
        <PlanMonthCalendar days={monthDays} entries={monthQuery.data ?? []} items={[]} monthKey={month} today={today}
          selection={{ date, onSelect: setDate, isLoading: !hasMonthSchedule, disabled: isLocked || !hasMonthSchedule }} />
        {monthQuery.isError ? <p className="mt-3 text-sm text-muted" role="alert">
          이 달의 코디를 불러오지 못했어요. <button type="button" onClick={() => void monthQuery.refetch()} className="font-semibold text-accent underline">다시 시도</button>
        </p> : <p className="mt-3 min-h-5 break-words text-sm text-muted" role="status">
          {!hasMonthSchedule ? '이 달의 코디를 확인하고 있어요.' : isProtected ? '이 날짜에는 담을 수 없어요. 다른 날짜를 골라주세요.'
            : date ? `${dateLabel.format(new Date(`${date}T00:00:00`))} · ${selectedEntry?.outfitId ? selectedEntry.title || '코디 있음' : '비어 있음'}`
              : '담을 날짜를 골라주세요.'}
        </p>}
        {date && assignment.target.isError && <p className="mt-3 text-sm text-muted" role="alert">
          이 날짜의 코디를 불러오지 못했어요. <button type="button" onClick={() => void assignment.target.refetch()} className="font-semibold text-accent underline">다시 시도</button>
        </p>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" autoFocus disabled={isLocked} onClick={onClose} className="min-h-11 rounded-xl border border-line text-sm font-semibold disabled:opacity-40">취소</button>
          <button type="button" disabled={!date || !hasMonthSchedule || isLocked || isProtected || assignment.target.isPending || assignment.target.isError}
            onClick={() => void assignment.assign()} className="min-h-11 rounded-xl bg-accent text-sm font-semibold text-white disabled:opacity-40">
            {isBusy ? '담는 중…' : '이 날짜에 담기'}
          </button>
        </div>
      </section>
    </div>
    {replacement && <ConfirmDialog title="이날 코디를 바꿀까요?" description={`${replacement.title || '저장된 코디'} 대신 선택한 코디를 담아요.`}
      confirmLabel="코디 바꾸기" pendingLabel="날짜에 담는 중…" isPending={isBusy}
      onCancel={cancelReplacement} onConfirm={() => void assignment.assign(replacement.outfitId)} />}
  </>
}
