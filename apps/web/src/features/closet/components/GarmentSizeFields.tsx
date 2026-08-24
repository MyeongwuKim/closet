import type { ClothingCategory } from '@closet/types'
import { ChevronDown, Ruler } from 'lucide-react'
import { useId, useState } from 'react'
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
  const titleId = useId()
  const manualInputId = useId()
  const [isManualInputOpen, setIsManualInputOpen] = useState(() =>
    Object.values(value).some((fieldValue) => fieldValue.trim()),
  )

  if (!supportsGarmentSizing(category)) return null

  const fields = getGarmentMeasurementFields(category)
  const updateField = (key: keyof GarmentSizeFormValue, nextValue: string) =>
    onChange({ ...value, [key]: nextValue })

  return (
    <fieldset
      aria-labelledby={titleId}
      className="rounded-2xl border border-line bg-canvas/60 p-4 sm:p-5"
    >
      <legend className="sr-only">사이즈 정보 선택</legend>
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-muted">
          <Ruler size={18} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p id={titleId} className="text-sm font-black">
              사이즈 정보
            </p>
            <span className="rounded-full bg-surface px-2 py-1 text-[10px] font-bold text-muted">
              선택
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            내 옷의 표기 사이즈와 실측값을 관리해요.
          </p>
        </div>
      </div>

      <GarmentSizeChartAnalyzer
        key={category}
        category={category}
        value={value}
        onChange={onChange}
      />

      <button
        type="button"
        aria-controls={manualInputId}
        aria-expanded={isManualInputOpen}
        onClick={() => setIsManualInputOpen((current) => !current)}
        className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left transition hover:border-ink"
      >
        <span className="min-w-0">
          <span className="block text-xs font-black">직접 입력하기</span>
          <span className="mt-0.5 block text-[11px] text-muted">
            사이즈표가 없다면 아는 항목만 입력해도 돼요.
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-muted transition-transform ${
            isManualInputOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {isManualInputOpen && (
        <div id={manualInputId} className="mt-4 border-t border-line pt-4">
          <label className="block text-xs font-bold text-muted">
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
              <label
                className="block text-xs font-bold text-muted"
                key={field.key}
              >
                {field.label}
                <span className="relative mt-2 block">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0.1"
                    max="300"
                    step="0.1"
                    value={value[field.key]}
                    onChange={(event) =>
                      updateField(field.key, event.target.value)
                    }
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

          <p className="mt-3 text-[11px] leading-5 text-muted">
            AI 분석값은 저장하기 전에 한 번 확인해주세요.
          </p>
        </div>
      )}
    </fieldset>
  )
}
