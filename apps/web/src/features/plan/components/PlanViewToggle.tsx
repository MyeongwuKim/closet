import { SegmentedControl } from '../../../components/SegmentedControl'

interface PlanViewToggleProps {
  value: 'week' | 'month'
  onChange: (value: 'week' | 'month') => void
}

const planViewOptions = [
  { value: 'week', label: '주간' },
  { value: 'month', label: '월간' },
] as const

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
