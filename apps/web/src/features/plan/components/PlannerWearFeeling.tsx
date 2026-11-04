import type { WearFeeling } from '@closet/types'
import { SegmentedControl } from '../../../components/SegmentedControl'

const feelingOptions: Array<{ value: WearFeeling; label: string }> = [
  { value: 'cold', label: '추웠어요' },
  { value: 'comfortable', label: '적당했어요' },
  { value: 'hot', label: '더웠어요' },
]

interface PlannerWearFeelingProps {
  value: WearFeeling | null
  disabled: boolean
  onChange: (feeling: WearFeeling | null) => void
}

/** 착용을 확인한 코디의 온도 체감을 세 가지 중 하나로 표시한다. 선택·지우기는 부모의 저장 동작에 맡기고 저장 중에는 모든 조작을 막는다. */
export function PlannerWearFeeling({ value, disabled, onChange }: PlannerWearFeelingProps) {
  return (
    <div className="mt-2 border-t border-line/70 pt-2">
      <div className="mb-2 flex min-h-5 items-center justify-between gap-2">
        <p className="text-[11px] font-bold">입었을 때 어땠나요?</p>
        {value && (
          <button type="button" disabled={disabled} onClick={() => onChange(null)} className="text-[10px] text-muted underline underline-offset-2 transition hover:text-ink disabled:cursor-wait disabled:opacity-50">
            체감 기록 지우기
          </button>
        )}
      </div>
      <fieldset disabled={disabled} className="min-w-0 disabled:opacity-60">
        <SegmentedControl<WearFeeling>
          ariaLabel="착용 체감"
          value={value}
          options={feelingOptions}
          onChange={onChange}
          className="[&>button]:min-h-8 [&>button]:px-2 [&>button]:py-2 [&>button]:text-[11px] [&>button:disabled]:cursor-wait"
        />
      </fieldset>
    </div>
  )
}
