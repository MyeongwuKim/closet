import { SegmentedControl } from '../../../components/SegmentedControl'

/** today는 현재 날짜에 한정되지 않는 하루 보기이며 선택한 날짜를 표시한다. week와 month는 주간·월간 보기다. */
export type PlanViewMode = 'today' | 'week' | 'month'

interface PlanViewToggleProps {
  value: PlanViewMode
  onChange: (value: PlanViewMode) => void
}

const planViewOptions = [
  { value: 'today', label: '하루' },
  { value: 'week', label: '주간' },
  { value: 'month', label: '월간' },
] as const

/** 플래너의 하루·주간·월간 보기를 전환한다. 선택된 보기는 밝은 배경으로 표시한다. */
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
