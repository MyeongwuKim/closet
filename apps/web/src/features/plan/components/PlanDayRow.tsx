import type { WardrobeItem } from '@closet/types'
import { ChevronRight, GripVertical } from 'lucide-react'
import { useCallback, useRef } from 'react'
import { useDrag, useDrop } from 'react-dnd'
import { Link } from 'react-router-dom'
import { shouldMovePlanRow, type PlanEntry } from '../data/weeklyPlan'
import { PlanOutfitThumbnails } from './PlanOutfitThumbnails'

const WEEKLY_PLAN_OUTFIT = 'weekly-plan-outfit'

export interface WeeklyPlanDragItem {
  type: typeof WEEKLY_PLAN_OUTFIT
  dragKey: string
  date: string
  originalIndex: number
  index: number
  entry: PlanEntry
  items: WardrobeItem[]
  isToday: boolean
  rowWidth: number
  rowHeight: number
  handleOffsetX: number
  handleOffsetY: number
}

interface WeeklyPlanDropResult {
  index: number
}

interface PlanDayRowProps {
  dragKey: string
  entry: PlanEntry
  index: number
  items: WardrobeItem[]
  isToday: boolean
  disabled?: boolean
  onDragStart: () => void
  onMovePreview: (fromIndex: number, toIndex: number) => void
  onDragEnd: (
    sourceIndex: number,
    targetIndex: number,
    didDrop: boolean,
  ) => void
}

interface PlanDayRowContentProps {
  entry: PlanEntry
  items: WardrobeItem[]
  isToday: boolean
}

export function PlanDayRowContent({
  entry,
  items,
  isToday,
}: PlanDayRowContentProps) {
  return (
    <>
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
    </>
  )
}

export function PlanDayRow({
  dragKey,
  entry,
  index,
  items,
  isToday,
  disabled = false,
  onDragStart,
  onMovePreview,
  onDragEnd,
}: PlanDayRowProps) {
  const rowRef = useRef<HTMLDivElement | null>(null)
  const handleRef = useRef<HTMLButtonElement | null>(null)
  const canDrag = Boolean(entry.outfitId) && !disabled
  const [{ isDragging }, drag] = useDrag<
    WeeklyPlanDragItem,
    WeeklyPlanDropResult,
    { isDragging: boolean }
  >(
    () => ({
      type: WEEKLY_PLAN_OUTFIT,
      item: () => {
        const rowRect = rowRef.current?.getBoundingClientRect()
        const handleRect = handleRef.current?.getBoundingClientRect()
        onDragStart()
        return {
          type: WEEKLY_PLAN_OUTFIT,
          dragKey,
          date: entry.date,
          originalIndex: index,
          index,
          entry,
          items,
          isToday,
          rowWidth: rowRect?.width ?? 0,
          rowHeight: rowRect?.height ?? 0,
          handleOffsetX:
            rowRect && handleRect ? handleRect.left - rowRect.left : 0,
          handleOffsetY:
            rowRect && handleRect ? handleRect.top - rowRect.top : 0,
        }
      },
      canDrag,
      isDragging: (monitor) => monitor.getItem().dragKey === dragKey,
      end: (dragged, monitor) =>
        onDragEnd(dragged.originalIndex, dragged.index, monitor.didDrop()),
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [canDrag, dragKey, entry, index, isToday, items, onDragEnd, onDragStart],
  )
  const [{ isOver }, drop] = useDrop<
    WeeklyPlanDragItem,
    WeeklyPlanDropResult,
    { isOver: boolean }
  >(
    () => ({
      accept: WEEKLY_PLAN_OUTFIT,
      canDrop: () => !disabled,
      hover: (dragged, monitor) => {
        const rowElement = rowRef.current
        if (!rowElement || disabled || dragged.index === index) return

        const clientOffset = monitor.getClientOffset()
        if (!clientOffset) return

        const rowRect = rowElement.getBoundingClientRect()
        const pointerY = clientOffset.y - rowRect.top
        if (
          !shouldMovePlanRow(
            dragged.index,
            index,
            pointerY,
            rowRect.height,
          )
        ) {
          return
        }

        onMovePreview(dragged.index, index)
        dragged.index = index
      },
      drop: () => ({ index }),
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }),
      }),
    }),
    [disabled, index, onMovePreview],
  )

  const connectRow = useCallback(
    (node: HTMLDivElement | null) => {
      rowRef.current = node
      drop(node)
    },
    [drop],
  )
  const connectDragHandle = useCallback(
    (node: HTMLButtonElement | null) => {
      handleRef.current = node
      drag(node)
    },
    [drag],
  )

  return (
    <div
      ref={connectRow}
      className={`relative h-full min-h-11 rounded-xl border bg-surface sm:rounded-2xl ${
        isDragging ? 'opacity-0 transition-none' : 'opacity-100 transition'
      } ${
        isOver && !isDragging
          ? 'border-ink bg-sage/45'
          : isToday
            ? 'border-accent shadow-[inset_3px_0_0_#f05a3c]'
            : 'border-line'
      }`}
      data-plan-date={entry.date}
    >
      <Link
        to={`/plan/${entry.date}`}
        className="grid h-full min-h-11 grid-cols-[38px_minmax(0,1fr)_16px] items-center gap-2 rounded-[inherit] py-1.5 pr-10 pl-2 transition hover:bg-canvas/35 sm:grid-cols-[58px_minmax(220px,0.85fr)_minmax(180px,1fr)_auto] sm:gap-3 sm:p-4 sm:pr-12 sm:hover:-translate-y-0.5"
        aria-current={isToday ? 'date' : undefined}
      >
        <PlanDayRowContent entry={entry} items={items} isToday={isToday} />
      </Link>

      <button
        ref={connectDragHandle}
        type="button"
        disabled={!canDrag}
        className={`absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 touch-none items-center justify-center rounded-lg text-muted transition hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-20 sm:right-2 ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        aria-label={
          canDrag
            ? `${entry.dayLabel}요일 코디 위치 옮기기`
            : `${entry.dayLabel}요일에는 옮길 코디가 없습니다`
        }
      >
        <GripVertical className="size-4" />
      </button>
    </div>
  )
}
