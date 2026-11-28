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
              ? 'border-accent shadow-[inset_3px_0_0_var(--color-accent),0_16px_36px_rgba(27,27,24,0.22)]'
              : 'border-ink'
          }`}
        >
          <div className="plan-week-row-body rounded-[inherit]">
            <PlanDayRowContent
              entry={item.entry}
              items={item.items}
              isToday={item.isToday}
            />
          </div>
          <span className="plan-week-row-handle rounded-lg text-ink">
            <GripVertical className="size-4" />
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
