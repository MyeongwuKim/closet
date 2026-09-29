import { SegmentedControl } from '../../../components/SegmentedControl'

export type PlanViewMode = 'today' | 'week' | 'month'

interface PlanViewToggleProps {
  value: PlanViewMode
  onChange: (value: PlanViewMode) => void
}

const planViewOptions = [
  { value: 'today', label: '오늘' },
  { value: 'week', label: '주간' },
  { value: 'month', label: '월간' },
] as const

/** 플래너의 오늘·주간·월간 보기를 같은 너비의 선택 영역으로 전환한다. */
export function PlanViewToggle({ value, onChange }: PlanViewToggleProps) {
  return (
    <SegmentedControl
      ariaLabel="플래너 보기 방식"
      className="mt-2 sm:mt-6"
      value={value}
      options={planViewOptions}
      onChange={onChange}
    />
  )
}
