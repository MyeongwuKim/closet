import { createWardrobeItem, expect, test } from './support/fixture'

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px: 코디의 옷 선택에서 검색·세부 카테고리·계절·색상을 함께 적용한다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize(viewport)
    mockApi.wardrobeItems = [
      createWardrobeItem({ id: 'tan-coat', name: '베이지 코트', category: 'outer', subcategory: '코트', colorName: '베이지', colorHex: '#cbb596', seasons: ['spring'] }),
      createWardrobeItem({ id: 'black-coat', name: '울 코트', category: 'outer', subcategory: '코트', brandName: '노스', colorName: '블랙', colorHex: '#242424', seasons: ['winter'] }),
      createWardrobeItem({ id: 'black-jacket', name: '트러커 재킷', category: 'outer', subcategory: '재킷', brandName: '노스', colorName: '블랙', colorHex: '#242424', seasons: ['spring'] }),
    ]
    await page.goto('/plan/2026-11-04')
    await page.getByRole('button', { name: '아우터 고르기', exact: true }).click()
    const picker = page.getByRole('dialog', { name: '아우터 옷 선택' })
    await picker.getByRole('button', { name: /베이지 코트/ }).click()
    await picker.getByRole('button', { name: '아우터 검색', exact: true }).click()
    const search = picker.getByRole('searchbox', { name: '아우터 검색어' })
    await expect(search).toBeFocused()
    await search.fill('노스 블랙')
    const woolCoat = picker.getByRole('button', { name: /울 코트/ })
    await expect(woolCoat).toBeVisible()
    await expect(picker.getByRole('button', { name: /트러커 재킷/ })).toBeVisible()
    await expect(picker.getByRole('button', { name: /베이지 코트/ })).toHaveCount(0)
    await expect(picker.getByRole('button', { name: '1개 선택 완료' })).toBeEnabled()

    await picker.getByRole('button', { name: '코트', exact: true }).click()
    await expect(woolCoat).toBeVisible()
    await expect(picker.getByRole('button', { name: /트러커 재킷/ })).toHaveCount(0)
    await search.fill('없는 이름')
    await expect(picker.getByRole('heading', { name: '검색 결과가 없어요' })).toBeVisible()
    await picker.getByRole('button', { name: '검색어 지우기' }).click()
    await expect(search).toHaveValue('')
    await expect(picker.getByRole('button', { name: /베이지 코트/ })).toHaveAttribute('aria-pressed', 'true')

    await page.keyboard.press('Escape')
    await expect(picker.getByRole('button', { name: '아우터 검색', exact: true })).toBeFocused()
    await expect(picker).toBeVisible()

    const filterButton = picker.getByRole('button', { name: '아우터 필터', exact: true })
    await filterButton.click()
    const black = picker.getByRole('button', { name: '블랙', exact: true })
    await black.click()
    await expect(woolCoat).toBeVisible()
    await expect(picker.getByRole('button', { name: /베이지 코트/ })).toHaveCount(0)
    await picker.getByRole('button', { name: '봄', exact: true }).click()
    await expect(picker.getByRole('heading', { name: '필터에 맞는 옷이 없어요' })).toBeVisible()
    await picker.getByRole('button', { name: '필터 초기화' }).click()
    await expect(picker.getByRole('button', { name: /베이지 코트/ })).toHaveAttribute('aria-pressed', 'true')

    await picker.getByRole('button', { name: '겨울', exact: true }).click()
    await black.click()
    await expect(woolCoat).toBeVisible()
    await expect(picker.getByRole('button', { name: /트러커 재킷/ })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath('wardrobe-filters.png'), animations: 'disabled' })
    await filterButton.click()
    await expect(black).toHaveCount(0)
    await expect(picker.getByRole('button', { name: /베이지 코트/ })).toHaveCount(0)
    await picker.getByRole('button', { name: '아우터 검색', exact: true }).click()
    await search.fill('베이지')
    await expect(picker.getByRole('heading', { name: '검색 결과가 없어요' })).toBeVisible()
    await picker.getByRole('button', { name: '검색어 지우기' }).click()
    await woolCoat.click()
    await picker.getByRole('button', { name: '1개 선택 완료' }).click()
    await expect(picker).toHaveCount(0)
    await expect(page.getByTitle('울 코트', { exact: true })).toBeVisible()
  })
}
