import type { WardrobeItem } from '@closet/types'
import { Link } from 'react-router-dom'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'
import { closetCategoryLabels } from '../../closet/constants'

interface PlanMatchedItemsRailProps {
  date: string
  items: WardrobeItem[]
}

export function PlanMatchedItemsRail({
  date,
  items,
}: PlanMatchedItemsRailProps) {
  return (
    <section className="mt-5" aria-labelledby="plan-matched-items-title">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="plan-matched-items-title" className="text-sm font-black">
            매칭한 아이템
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            옆으로 넘겨 코디에 사용한 옷을 확인해보세요.
          </p>
        </div>
        <span className="shrink-0 text-xs font-bold text-accent">
          {items.length}개
        </span>
      </div>

      {items.length > 0 ? (
        <div className="scrollbar-hidden mt-3 flex snap-x gap-2.5 overflow-x-auto pb-2">
          {items.map((item) => (
            <Link
              to={`/plan/${date}/item/${item.id}`}
              className="w-26 shrink-0 snap-start rounded-2xl border border-line bg-surface p-1.5 transition hover:-translate-y-0.5 hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-30"
              aria-label={`${item.name} 상세 보기`}
              key={item.id}
            >
              <span className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-canvas">
                <ClosetItemVisual item={item} compact />
              </span>
              <strong className="mt-1.5 block truncate px-1 text-[11px]">
                {item.name}
              </strong>
              <span className="mt-0.5 block truncate px-1 pb-0.5 text-[10px] text-muted">
                {item.category
                  ? closetCategoryLabels[item.category]
                  : '미분류'}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-2xl border border-dashed border-line px-4 py-5 text-center text-xs text-muted">
          아직 매칭한 아이템이 없어요.
        </p>
      )}
    </section>
  )
}
