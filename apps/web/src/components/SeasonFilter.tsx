import type { Season } from '@closet/types'
import { seasonOptions } from '../constants/seasons'
import { SegmentedControl } from './SegmentedControl'

type SeasonFilterValue = Season | 'all'

interface SeasonFilterProps {
  className?: string
  value: Season | null
  onChange: (value: Season | null) => void
}

export function SeasonFilter({
  className = '',
  value,
  onChange,
}: SeasonFilterProps) {
  return (
    <SegmentedControl<SeasonFilterValue>
      ariaLabel="계절 필터"
      className={className}
      value={value ?? 'all'}
      options={[{ label: '전체', value: 'all' }, ...seasonOptions]}
      onChange={(nextValue) =>
        onChange(nextValue === 'all' ? null : nextValue)
      }
    />
  )
}
