import type { FashionMaterial, FashionWarmth } from '@closet/types'
import { OptionPickerField } from '../../../components/OptionPickerField'
import {
  fashionMaterialLabels,
  fashionWarmthLabels,
  type EditableFashionAttributes,
} from '../utils/fashionAttributes'

const warmthOptions: Array<{ value: FashionWarmth; label: string }> = [
  { value: 'light', label: fashionWarmthLabels.light },
  { value: 'medium', label: fashionWarmthLabels.medium },
  { value: 'heavy', label: fashionWarmthLabels.heavy },
  { value: 'unknown', label: fashionWarmthLabels.unknown },
]

const materialOptions: Array<{ value: FashionMaterial; label: string }> = [
  { value: 'cotton', label: fashionMaterialLabels.cotton },
  { value: 'denim', label: fashionMaterialLabels.denim },
  { value: 'knit', label: fashionMaterialLabels.knit },
  { value: 'wool', label: fashionMaterialLabels.wool },
  { value: 'leather', label: fashionMaterialLabels.leather },
  { value: 'linen', label: fashionMaterialLabels.linen },
  { value: 'synthetic', label: fashionMaterialLabels.synthetic },
  { value: 'other', label: fashionMaterialLabels.other },
  { value: 'unknown', label: fashionMaterialLabels.unknown },
]

interface FashionAttributeFieldsProps {
  value: EditableFashionAttributes
  onChange: (value: EditableFashionAttributes) => void
}

/**
 * 옷 추가·수정 폼에서 날씨 추천에 사용하는 보온감과 소재를 확인하고 고친다.
 * AI가 선택한 값을 초기 상태로 보여주며 변경 결과는 부모 폼의 저장 동작에 맡긴다.
 */
export function FashionAttributeFields({
  value,
  onChange,
}: FashionAttributeFieldsProps) {
  return (
    <section className="grid gap-4 rounded-2xl border border-line bg-surface p-4">
      <div>
        <h3 className="text-sm font-black">소재 및 보온 정보</h3>
        <p className="mt-1 text-xs leading-5 text-muted">
          AI가 사진으로 고른 값이에요. 실제 옷과 다르면 바꿔주세요.
        </p>
      </div>

      <fieldset>
        <legend className="text-sm font-bold">따뜻한 정도</legend>
        <p className="mt-1 text-xs leading-5 text-muted">
          계절과 별개로 실제 입었을 때 느껴지는 보온감을 골라주세요.
        </p>
        <div
          className="mt-2 grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-canvas"
          role="group"
          aria-label="따뜻한 정도"
        >
          {warmthOptions.map((option, index) => {
            const isSelected = value.warmth === option.value

            return (
              <button
                type="button"
                onClick={() => onChange({ ...value, warmth: option.value })}
                className={`min-h-12 px-3 py-2 text-sm font-bold transition-colors ${
                  index % 2 === 1 ? 'border-l border-line' : ''
                } ${index >= 2 ? 'border-t border-line' : ''} ${
                  isSelected
                    ? 'bg-ink text-white'
                    : 'text-muted hover:bg-white hover:text-ink'
                }`}
                aria-pressed={isSelected}
                key={option.value}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div>
        <OptionPickerField
          label="소재·원단"
          value={value.material}
          options={materialOptions}
          placeholder="소재를 선택해주세요"
          onChange={(material) =>
            onChange({ ...value, material: material as FashionMaterial })
          }
        />
        <p className="mt-2 text-xs leading-5 text-muted">
          소재는 보온감과 함께 날씨별 옷차림 추천을 보정하는 데 사용해요.
        </p>
      </div>
    </section>
  )
}
