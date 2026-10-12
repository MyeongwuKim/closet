import type { WardrobeItem } from '@closet/types'

/** 브랜드 입력의 유니코드와 연속 공백을 정리한다. */
export function normalizeWardrobeBrand(value: string) {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim()
}

/** 브랜드의 공백·유니코드·대소문자를 정리해 선택값과 저장값을 비교한다. */
export function getWardrobeBrandKey(value: string) {
  return normalizeWardrobeBrand(value).toLocaleLowerCase('ko-KR')
}

/** 삭제한 브랜드의 로컬 옷 정보만 미지정으로 바꾼다. 다른 브랜드와 옷 분류·이미지는 유지하고 원본 배열을 변경하지 않는다. */
export function clearWardrobeBrandFromItems(items: WardrobeItem[], brandName: string) {
  const key = getWardrobeBrandKey(brandName)
  return items.map((item) => getWardrobeBrandKey(item.brandName ?? '') === key
    ? { ...item, brandName: undefined }
    : item,
  )
}

/** 저장된 브랜드와 현재 선택값을 대소문자 중복 없이 정렬해 선택 목록으로 만든다. */
export function getWardrobeBrandOptions(
  brands: string[],
  selectedBrand = '',
) {
  const brandByKey = new Map<string, string>()
  const candidates = [...brands, selectedBrand]

  candidates.forEach((value) => {
    const brand = normalizeWardrobeBrand(value)
    if (!brand) return
    const key = getWardrobeBrandKey(brand)
    if (!brandByKey.has(key)) brandByKey.set(key, brand)
  })

  return [...brandByKey.values()].sort((left, right) =>
    left.localeCompare(right, 'ko'),
  )
}
