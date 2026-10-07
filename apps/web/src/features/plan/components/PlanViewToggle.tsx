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

/** 플래너의 오늘·주간·월간 보기를 전환한다. 선택된 보기는 밝은 배경으로 표시한다. */
export function PlanViewToggle({ value, onChange }: PlanViewToggleProps) {
  return (
    <SegmentedControl
      ariaLabel="플래너 보기 방식"
      className="plan-view-tabs mt-3 sm:mt-6"
      value={value}
      options={planViewOptions}
      onChange={onChange}
    />
  )
}
