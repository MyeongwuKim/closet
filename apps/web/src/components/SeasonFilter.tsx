import type { Season } from '@closet/types'
import type { CSSProperties } from 'react'
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
    <div className={`season-filter-rail ${className}`} style={{ '--season-index': value ? seasonOptions.findIndex((option) => option.value === value) + 1 : 0 } as CSSProperties}>
    <SegmentedControl<SeasonFilterValue>
      ariaLabel="계절 필터"
      className="archive-season-tabs"
      value={value ?? 'all'}
      options={[{ label: '전체', value: 'all' }, ...seasonOptions]}
      onChange={(nextValue) =>
        onChange(nextValue === 'all' ? null : nextValue)
      }
    />
    </div>
  )
}
