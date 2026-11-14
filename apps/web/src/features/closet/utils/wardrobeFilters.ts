import { getWardrobeBrandKey, normalizeWardrobeBrand } from './wardrobeBrands'

export type WardrobeFilterKind = 'color' | 'brand' | 'tag' | 'unbranded'
export interface WardrobeFilterSelection { kind: WardrobeFilterKind; value: string }

/** 브랜드의 표기 차이와 같은 조건의 중복을 구분하는 키. URL이나 표시 이름 자체는 바꾸지 않는다. */
export function wardrobeFilterSelectionKey(selection: WardrobeFilterSelection) {
  return `${selection.kind}:${selection.kind === 'brand' ? getWardrobeBrandKey(selection.value) : selection.value}`
}

/** 반복된 URL 파라미터를 선택 순서대로 읽는다. 단일 값 URL도 그대로 읽고 빈 값·중복·알 수 없는 조건은 제외한다. */
export function readWardrobeFilterSelection(params: URLSearchParams): WardrobeFilterSelection[] {
  const selection: WardrobeFilterSelection[] = []
  const keys = new Set<string>()
  for (const [kind, raw] of params) {
    if (kind !== 'color' && kind !== 'brand' && kind !== 'tag' && kind !== 'unbranded') continue
    const value = kind === 'brand' ? normalizeWardrobeBrand(raw) : raw.trim()
    if (!value || (kind === 'unbranded' && value !== '1')) continue
    const item: WardrobeFilterSelection = { kind, value }
    const key = wardrobeFilterSelectionKey(item)
    if (keys.has(key)) continue
    keys.add(key)
    selection.push(item)
  }
  return selection
}

/** 세부 선택만 순서대로 다시 저장한다. 계절·종류·검색어·정렬 등 다른 URL 조건과 원본 객체는 유지한다. */
export function writeWardrobeFilterSelection(params: URLSearchParams, selection: WardrobeFilterSelection[]) {
  const next = new URLSearchParams(params)
  for (const kind of ['color', 'brand', 'tag', 'unbranded']) next.delete(kind)
  for (const item of selection) next.append(item.kind, item.value)
  return next
}

/** 새 선택은 끝에 붙이고 같은 선택을 다시 누르면 그 조건만 제거한다. 값에 쉼표·공백이 있어도 하나의 조건으로 보존한다. */
export function toggleWardrobeFilterSelection(params: URLSearchParams, item: WardrobeFilterSelection) {
  const current = readWardrobeFilterSelection(params)
  const key = wardrobeFilterSelectionKey(item)
  const exists = current.some((value) => wardrobeFilterSelectionKey(value) === key)
  return writeWardrobeFilterSelection(params, exists
    ? current.filter((value) => wardrobeFilterSelectionKey(value) !== key)
    : [...current, item])
}
