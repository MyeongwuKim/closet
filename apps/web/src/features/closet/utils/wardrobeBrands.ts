/** 브랜드 입력의 유니코드와 연속 공백을 정리한다. */
export function normalizeWardrobeBrand(value: string) {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim()
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
    const key = brand.toLocaleLowerCase('ko-KR')
    if (!brandByKey.has(key)) brandByKey.set(key, brand)
  })

  return [...brandByKey.values()].sort((left, right) =>
    left.localeCompare(right, 'ko'),
  )
}
