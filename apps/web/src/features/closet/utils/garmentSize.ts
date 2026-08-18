import type { ClothingCategory, WardrobeItem } from '@closet/types'

export interface GarmentSizeFormValue {
  sizeLabel: string
  shoulderWidthCm: string
  chestWidthCm: string
  sleeveLengthCm: string
  totalLengthCm: string
  waistWidthCm: string
  hipWidthCm: string
  inseamCm: string
  thighWidthCm: string
  riseCm: string
  hemWidthCm: string
}

export interface GarmentSizeInput {
  sizeLabel: string | null
  shoulderWidthCm: number | null
  chestWidthCm: number | null
  sleeveLengthCm: number | null
  totalLengthCm: number | null
  waistWidthCm: number | null
  hipWidthCm: number | null
  inseamCm: number | null
  thighWidthCm: number | null
  riseCm: number | null
  hemWidthCm: number | null
}

export type GarmentMeasurementKey = Exclude<
  keyof GarmentSizeFormValue,
  'sizeLabel'
>

export interface GarmentMeasurementField {
  key: GarmentMeasurementKey
  label: string
}

const measurableCategories: ClothingCategory[] = [
  'top',
  'bottom',
  'outer',
  'midlayer',
  'dress',
]

const upperFields: GarmentMeasurementField[] = [
  { key: 'shoulderWidthCm', label: '어깨너비' },
  { key: 'chestWidthCm', label: '가슴 단면' },
  { key: 'sleeveLengthCm', label: '소매 길이' },
  { key: 'totalLengthCm', label: '총장' },
]

const dressFields: GarmentMeasurementField[] = [
  { key: 'shoulderWidthCm', label: '어깨너비' },
  { key: 'chestWidthCm', label: '가슴 단면' },
  { key: 'waistWidthCm', label: '허리 단면' },
  { key: 'totalLengthCm', label: '총장' },
]

const bottomFields: GarmentMeasurementField[] = [
  { key: 'waistWidthCm', label: '허리 단면' },
  { key: 'hipWidthCm', label: '엉덩이 단면' },
  { key: 'thighWidthCm', label: '허벅지 단면' },
  { key: 'riseCm', label: '밑위' },
  { key: 'inseamCm', label: '인심' },
  { key: 'hemWidthCm', label: '밑단 단면' },
  { key: 'totalLengthCm', label: '총장' },
]

export const emptyGarmentSize: GarmentSizeFormValue = {
  sizeLabel: '',
  shoulderWidthCm: '',
  chestWidthCm: '',
  sleeveLengthCm: '',
  totalLengthCm: '',
  waistWidthCm: '',
  hipWidthCm: '',
  inseamCm: '',
  thighWidthCm: '',
  riseCm: '',
  hemWidthCm: '',
}

export function garmentSizeFromItem(item: WardrobeItem): GarmentSizeFormValue {
  return {
    sizeLabel: item.sizeLabel ?? '',
    shoulderWidthCm: item.shoulderWidthCm?.toString() ?? '',
    chestWidthCm: item.chestWidthCm?.toString() ?? '',
    sleeveLengthCm: item.sleeveLengthCm?.toString() ?? '',
    totalLengthCm: item.totalLengthCm?.toString() ?? '',
    waistWidthCm: item.waistWidthCm?.toString() ?? '',
    hipWidthCm: item.hipWidthCm?.toString() ?? '',
    inseamCm: item.inseamCm?.toString() ?? '',
    thighWidthCm: item.thighWidthCm?.toString() ?? '',
    riseCm: item.riseCm?.toString() ?? '',
    hemWidthCm: item.hemWidthCm?.toString() ?? '',
  }
}

export function supportsGarmentSizing(
  category: ClothingCategory | '',
): category is ClothingCategory {
  return Boolean(category && measurableCategories.includes(category))
}

export function getGarmentMeasurementFields(
  category: ClothingCategory,
): GarmentMeasurementField[] {
  if (category === 'bottom') return bottomFields
  if (category === 'dress') return dressFields
  return upperFields
}

export function toGarmentSizeInput(
  category: ClothingCategory,
  value: GarmentSizeFormValue,
): GarmentSizeInput {
  if (!supportsGarmentSizing(category)) {
    return {
      sizeLabel: null,
      shoulderWidthCm: null,
      chestWidthCm: null,
      sleeveLengthCm: null,
      totalLengthCm: null,
      waistWidthCm: null,
      hipWidthCm: null,
      inseamCm: null,
      thighWidthCm: null,
      riseCm: null,
      hemWidthCm: null,
    }
  }

  const allowedFields = new Set(
    getGarmentMeasurementFields(category).map(({ key }) => key),
  )
  const numberOrNull = (key: GarmentMeasurementKey) =>
    allowedFields.has(key) && value[key].trim()
      ? Number(value[key])
      : null

  return {
    sizeLabel: value.sizeLabel.trim() || null,
    shoulderWidthCm: numberOrNull('shoulderWidthCm'),
    chestWidthCm: numberOrNull('chestWidthCm'),
    sleeveLengthCm: numberOrNull('sleeveLengthCm'),
    totalLengthCm: numberOrNull('totalLengthCm'),
    waistWidthCm: numberOrNull('waistWidthCm'),
    hipWidthCm: numberOrNull('hipWidthCm'),
    inseamCm: numberOrNull('inseamCm'),
    thighWidthCm: numberOrNull('thighWidthCm'),
    riseCm: numberOrNull('riseCm'),
    hemWidthCm: numberOrNull('hemWidthCm'),
  }
}
