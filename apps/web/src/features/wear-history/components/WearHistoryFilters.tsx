import type { WearFeeling } from '@closet/types'
import { Thermometer } from 'lucide-react'
import { OptionPickerField } from '../../../components/OptionPickerField'
import { SegmentedControl } from '../../../components/SegmentedControl'
import { formatWearTemperature, wearFeelingLabels } from '../utils/temperatureHistory'

interface Props {
  ranges: ReadonlyArray<{ value: string; label: string }>
  range: string
  temperature: number | null
  feeling: WearFeeling | null
  onRangeChange: (value: string) => void
  onFeelingChange: (value: string) => void
}

const feelingOptions = [
  { value: 'all', label: '모든 체감' },
  ...Object.entries(wearFeelingLabels).map(([value, label]) => ({ value, label })),
]

/** 기온은 가로 탭으로, 체감은 앱 공통 선택창으로 표시한다. 필터 줄 높이를 유지하고 조회와 URL 저장은 화면에서 처리한다. */
export function WearHistoryFilters({ ranges, range, temperature, feeling, onRangeChange, onFeelingChange }: Props) {
  return (
    <div className="wear-history-filters">
      <div className="scrollbar-hidden overflow-x-auto">
        <SegmentedControl ariaLabel="착용 기온" className="wear-history-temperature-tabs"
          options={ranges} value={range} onChange={onRangeChange} />
      </div>
      <div className="wear-history-filter-row">
        <p className="wear-history-filter-note">
          <Thermometer size={15} strokeWidth={1.5} aria-hidden="true" />
          {range === 'near' ? `예보 ${formatWearTemperature(temperature)} 기준` : '착용 기온'}
        </p>
        <div className="wear-history-feeling">
          <OptionPickerField compact label="착용 체감" value={feeling ?? 'all'} options={feelingOptions}
            placeholder="모든 체감" onChange={onFeelingChange} />
        </div>
      </div>
    </div>
  )
}
