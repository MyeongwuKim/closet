/**
 * 사용 위치: 플래너 → 오늘 보기
 *
 * 선택한 날짜에 저장된 코디 정보와 최대 네 개의 옷을 큰 카드 한 장에 표시한다.
 * 카드를 누르면 해당 날짜의 기존 플래너 상세 화면으로 이동해 옷을 추가하거나 변경할 수 있다.
 */
import type { WardrobeItem } from '@closet/types'
import { ChevronRight, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'
import type { PlanEntry } from '../data/weeklyPlan'

interface PlanTodayCardProps {
  entry: PlanEntry
  items: WardrobeItem[]
  isToday: boolean
}

export function PlanTodayCard({ entry, items, isToday }: PlanTodayCardProps) {
  const date = new Date(`${entry.date}T00:00:00`)
  const formattedDate = new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date)
  const slots = Array.from({ length: 4 }, (_, index) => items[index] ?? null)
  const hasOutfit = items.length > 0
  const backPath = isToday
    ? '/plan?view=today'
    : `/plan?view=today&date=${entry.date}`

  return (
    <Link
      to={`/plan/${entry.date}?from=${encodeURIComponent(backPath)}`}
      className="mt-2 flex min-h-0 flex-1 flex-col rounded-3xl border border-line bg-surface p-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(27,27,24,0.08)] sm:mt-4 sm:min-h-[520px] sm:p-6"
      aria-label={`${formattedDate}, ${entry.title || '저장된 코디 없음'}`}
    >
      <span className="flex items-start justify-between gap-4">
        <span className="min-w-0">
          <span className="block text-xs font-black text-accent">
            {isToday ? '오늘' : '선택한 날짜'}
          </span>
          <strong className="mt-1 block text-xl font-black tracking-[-0.04em] sm:text-2xl">
            {formattedDate}
          </strong>
          <span className="mt-1 block text-xs text-muted sm:text-sm">
            {entry.weather || '오늘 날씨 정보가 아직 없어요'}
          </span>
        </span>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-canvas text-muted sm:size-10">
          <ChevronRight size={20} />
        </span>
      </span>

      <span className="mt-4 grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-3 sm:mt-6 sm:gap-4">
        {slots.map((item, index) => (
          <span
            className={`flex min-h-0 flex-col overflow-hidden rounded-2xl ${
              item
                ? 'bg-canvas'
                : 'items-center justify-center border border-dashed border-line bg-canvas/35 text-muted'
            }`}
            key={item?.id ?? `empty-${index}`}
          >
            {item ? (
              <>
                <span className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
                  <ClosetItemVisual item={item} />
                </span>
                <strong className="block w-full truncate border-t border-line/70 px-3 py-2 text-center text-[11px] sm:text-xs">
                  {item.name}
                </strong>
              </>
            ) : (
              <>
                <Plus size={20} />
                <span className="mt-1 text-[10px] font-bold sm:text-xs">
                  옷 추가
                </span>
              </>
            )}
          </span>
        ))}
      </span>

      <span className="mt-4 block min-w-0 sm:mt-6">
        <strong className="block truncate text-base font-black sm:text-lg">
          {entry.title || '오늘 입을 옷을 설정해주세요'}
        </strong>
        <span className="mt-1 block text-xs text-muted sm:text-sm">
          {hasOutfit
            ? `${items.length}개의 옷이 설정되어 있어요`
            : '카드를 눌러 오늘 입을 옷을 골라보세요'}
        </span>
      </span>
    </Link>
  )
}
