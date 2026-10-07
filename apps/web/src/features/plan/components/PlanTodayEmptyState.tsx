import { Plus } from 'lucide-react'

interface PlanTodayEmptyStateProps {
  isToday: boolean
}

/** 하루 카드 안에서 저장된 코디가 없음을 알리고 옷 선택을 안내한다. 옷 고르기는 별도 버튼이 아닌 카드 링크의 표시이므로 선택 동작은 한 번만 제공한다. */
export function PlanTodayEmptyState({ isToday }: PlanTodayEmptyStateProps) {
  return (
    <span className="plan-today-empty flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-6 text-center">
      <strong className="text-base font-medium tracking-[-.04em]">{isToday ? '오늘 입을 옷을 골라보세요' : '이날 입을 옷을 골라보세요'}</strong>
      <span className="plan-today-empty-description mt-2 text-xs leading-5 text-muted">아직 저장된 코디가 없어요.</span>
      <span className="plan-today-empty-action mt-5 inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-surface">
        <Plus size={16} aria-hidden="true" />옷 고르기
      </span>
    </span>
  )
}
