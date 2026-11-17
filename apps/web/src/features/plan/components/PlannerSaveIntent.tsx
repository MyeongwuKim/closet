import { SegmentedControl } from '../../../components/SegmentedControl'
import './PlannerSaveIntent.css'

interface Props {
  date: string
  today: string
  confirmWorn: boolean
  onChange: (confirmWorn: boolean) => void
  disabled?: boolean
}

/** 오늘·지난 날짜에서는 예정과 실제 착용 등록의 의미를 저장 전에 고른다. 미래에는 예정만 허용하며 서버에서도 다시 검증한다. */
export function PlannerSaveIntent({ date, today, confirmWorn, onChange, disabled = false }: Props) {
  if (date > today) return null
  return (
    <div className="planner-save-intent" inert={disabled} aria-disabled={disabled || undefined}>
      <SegmentedControl ariaLabel="코디 등록 방식" value={confirmWorn ? 'worn' : 'planned'}
        options={[{ value: 'planned', label: '입을 예정' }, { value: 'worn', label: '입은 코디 기록' }]}
        onChange={(value) => onChange(value === 'worn')} />
    </div>
  )
}
