import { GripVertical } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useDragLayer } from 'react-dnd'
import {
  PlanDayRowContent,
  type WeeklyPlanDragItem,
} from './PlanDayRow'

export function PlanDayRowDragLayer() {
  const { isDragging, item, sourceOffset } = useDragLayer<
    {
      isDragging: boolean
      item: WeeklyPlanDragItem | null
      sourceOffset: { x: number; y: number } | null
    },
    WeeklyPlanDragItem
  >((monitor) => ({
    isDragging: monitor.isDragging(),
    item: monitor.getItem(),
    sourceOffset: monitor.getSourceClientOffset(),
  }))

  if (!isDragging || !item || !sourceOffset || typeof document === 'undefined') {
    return null
  }

  const x = sourceOffset.x - item.handleOffsetX
  const y = sourceOffset.y - item.handleOffsetY

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[100]">
      <div
        className="will-change-transform"
        style={{
          width: item.rowWidth,
          height: item.rowHeight,
          transform: `translate3d(${x}px, ${y}px, 0)`,
        }}
      >
        <div
          className={`relative h-full rounded-xl border bg-surface opacity-75 shadow-[0_16px_36px_rgba(27,27,24,0.22)] sm:rounded-2xl ${
            item.isToday
              ? 'border-accent shadow-[inset_3px_0_0_#f05a3c,0_16px_36px_rgba(27,27,24,0.22)]'
              : 'border-ink'
          }`}
        >
          <div className="grid h-full min-h-11 grid-cols-[38px_minmax(0,1fr)_16px] items-center gap-2 rounded-[inherit] py-1.5 pr-10 pl-2 sm:grid-cols-[58px_minmax(220px,0.85fr)_minmax(180px,1fr)_auto] sm:gap-3 sm:p-4 sm:pr-12">
            <PlanDayRowContent
              entry={item.entry}
              items={item.items}
              isToday={item.isToday}
            />
          </div>
          <span className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink sm:right-2">
            <GripVertical className="size-4" />
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
