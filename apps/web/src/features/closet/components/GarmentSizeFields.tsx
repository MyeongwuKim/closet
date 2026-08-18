import type { ClothingCategory } from '@closet/types'
import { Ruler } from 'lucide-react'
import {
  getGarmentMeasurementFields,
  supportsGarmentSizing,
  type GarmentSizeFormValue,
} from '../utils/garmentSize'
import { GarmentSizeChartAnalyzer } from './GarmentSizeChartAnalyzer'

interface GarmentSizeFieldsProps {
  category: ClothingCategory | ''
  value: GarmentSizeFormValue
  onChange: (value: GarmentSizeFormValue) => void
}

export function GarmentSizeFields({
  category,
  value,
  onChange,
}: GarmentSizeFieldsProps) {
  if (!supportsGarmentSizing(category)) return null

  const fields = getGarmentMeasurementFields(category)
  const updateField = (key: keyof GarmentSizeFormValue, nextValue: string) =>
    onChange({ ...value, [key]: nextValue })

  return (
    <fieldset className="relative rounded-2xl border border-line bg-canvas/60 p-4">
      <legend className="px-1 text-sm font-black">
        <span className="flex items-center gap-1.5">
          <Ruler size={15} /> 사이즈 정보 <em className="font-normal text-muted not-italic">(선택)</em>
        </span>
      </legend>

      <GarmentSizeChartAnalyzer
        key={category}
        category={category}
        value={value}
        onChange={onChange}
      />

      <label className="mt-4 block text-xs font-bold text-muted">
        표기 사이즈
        <input
          type="text"
          value={value.sizeLabel}
          onChange={(event) => updateField('sizeLabel', event.target.value)}
          placeholder="예: M, 95, 28"
          maxLength={20}
          className="mt-2 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-bold text-ink outline-none focus:border-accent"
        />
      </label>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {fields.map((field) => (
          <label className="block text-xs font-bold text-muted" key={field.key}>
            {field.label}
            <span className="relative mt-2 block">
              <input
                type="number"
                inputMode="decimal"
                min="0.1"
                max="300"
                step="0.1"
                value={value[field.key]}
                onChange={(event) => updateField(field.key, event.target.value)}
                placeholder="선택"
                className="h-11 w-full rounded-xl border border-line bg-white px-3 pr-9 text-sm font-bold text-ink outline-none focus:border-accent"
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[11px] font-normal text-muted">
                cm
              </span>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-3 space-y-0.5 text-[11px] leading-5 text-muted">
        <p>모두 선택 항목이라 비워도 옷장에 저장할 수 있어요.</p>
        <p>
          입력한 수치는 AI 코디 이미지를 만들 때 겉으로 보이는 옷의
          길이·여유·통과 실루엣을 표현하는 참고값으로 사용해요.
        </p>
        <p>단면 항목은 옷을 평평하게 놓고 잰 한쪽 너비예요.</p>
      </div>
    </fieldset>
  )
}
