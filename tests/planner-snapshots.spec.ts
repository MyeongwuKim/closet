import { createOutfit, createWardrobeItem, expect, test } from './support/fixture'

const monday = '2026-11-02'
const wednesday = '2026-11-04'
const bookId = '000000000000000000000101'
const oldImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="150"%3E%3Crect width="100" height="150" fill="navy"/%3E%3C/svg%3E'
const newImage = oldImage.replace('navy', 'tan')

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px: 날짜별 코디는 코디북 수정·사진 교체·삭제와 독립적이다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.clock.setFixedTime(new Date('2026-11-05T03:00:00Z'))
    mockApi.wardrobeItems = [
      createWardrobeItem({ id: 'a', name: 'A 셔츠' }),
      createWardrobeItem({ id: 'b', name: 'B 바지', category: 'bottom' }),
      createWardrobeItem({ id: 'c', name: 'C 코트', category: 'outer' }),
      createWardrobeItem({ id: 'd', name: 'D 재킷', category: 'outer' }),
    ]
    mockApi.previewImages = { 'abc-image': oldImage, 'abd-image': newImage }
    mockApi.outfits = [createOutfit({ id: bookId, name: 'ABC 코디', items: ['a', 'b', 'c'].map((wardrobeItemId, layerOrder) => ({ wardrobeItemId, layerOrder })),
      generations: [{ status: 'completed', imageAsset: { id: 'abc-image', deliveryUrl: oldImage } }] })]
    await page.route('**/graphql', async (route) => {
      const { query, variables } = route.request().postDataJSON()
      if (query.includes('query OutfitPreviewForItems') && variables.selectedItemIds.includes('d')) {
        await route.fulfill({ json: { data: { outfitPreviewForItems: { assetId: 'abd-image', imageUrl: newImage, mimeType: 'image/png', model: 'fixture-model', jobId: null, createdAt: new Date().toISOString() } } } })
      } else await route.fallback()
    })

    await page.goto('/plan?view=week&date=2026-11-02')
    await page.getByRole('button', { name: '일주일 코디 설정' }).click()
    const editor = page.getByRole('dialog', { name: '주간 코디 편집' })
    const days = editor.getByLabel('설정할 요일').getByRole('button')
    const savedOutfit = editor.getByRole('button').filter({ has: page.getByText('ABC 코디', { exact: true }) })
    await days.nth(0).click()
    await savedOutfit.click()
    await expect.poll(() => mockApi.plannerEntries.find((entry) => entry.date === monday)?.outfit?.plannerOnly).toBe(true)
    await days.nth(2).click()
    await savedOutfit.click()
    await expect.poll(() => mockApi.plannerEntries.find((entry) => entry.date === wednesday)?.outfit?.plannerOnly).toBe(true)
    expect(mockApi.plannerEntries[0].outfit?.id).not.toBe(bookId)
    expect(mockApi.plannerEntries[1].outfit?.id).not.toBe(mockApi.plannerEntries[0].outfit?.id)
    await editor.getByRole('button', { name: '주간 옷 설정 닫기' }).click()

    await page.goto(`/plan/${monday}`)
    await page.getByRole('button', { name: '입었어요', exact: true }).click()
    await page.getByRole('radio', { name: '추웠어요', exact: true }).click()
    const wornAt = mockApi.plannerEntries.find((entry) => entry.date === monday)!.wornAt

    await page.goto('/lookbook')
    await page.getByRole('button', { name: 'ABC 코디 코디 상세 보기' }).click()
    await page.getByRole('button', { name: '아우터 교체하기' }).click()
    const picker = page.getByRole('dialog', { name: '아우터 옷 선택' })
    await picker.getByRole('button', { name: /D 재킷/ }).click()
    await picker.getByRole('button', { name: '1개 선택 완료' }).click()
    await page.getByRole('button', { name: 'AI 룩북 보기', exact: true }).click()
    const result = page.getByRole('dialog', { name: 'AI 룩 미리보기' })
    await expect(result.getByRole('img')).toHaveAttribute('src', newImage)
    await result.getByRole('button', { name: '수정한 코디에 저장', exact: true }).click()
    await expect(result).toHaveCount(0)
    expect(mockApi.outfits[0].items.map((item) => item.wardrobeItemId).sort()).toEqual(['a', 'b', 'd'])

    await page.goto(`/plan/${monday}`)
    await expect(page.getByRole('button', { name: '착용 취소', exact: true })).toBeVisible()
    await expect(page.getByRole('radio', { name: '추웠어요', exact: true })).toHaveAttribute('aria-checked', 'true')
    await page.screenshot({ path: testInfo.outputPath(`planner-snapshot-detail-${viewport.width}.png`), animations: 'disabled' })
    await page.getByRole('button', { name: 'AI 룩북 보기', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'AI 룩북', exact: true }).getByRole('img')).toHaveAttribute('src', oldImage)
    await page.screenshot({ path: testInfo.outputPath(`planner-snapshot-${viewport.width}.png`), animations: 'disabled' })
    await page.getByRole('button', { name: '저장된 AI 룩북 닫기' }).click()
    const mondayRecord = mockApi.plannerEntries.find((entry) => entry.date === monday)!
    expect(mondayRecord.outfit?.items.map((item) => item.wardrobeItemId).sort()).toEqual(['a', 'b', 'c'])
    expect(mondayRecord.wornAt).toBe(wornAt)

    await expect(page.getByRole('button', { name: '아우터 교체하기' })).toHaveCount(0)
    await page.getByRole('button', { name: '착용 취소', exact: true }).click()
    await page.getByRole('button', { name: '아우터 교체하기' }).click()
    await picker.getByRole('button', { name: /D 재킷/ }).click()
    await picker.getByRole('button', { name: '1개 선택 완료' }).click()
    await page.getByRole('button', { name: '변경사항 저장', exact: true }).click()
    await expect.poll(() => mockApi.plannerEntries.find((entry) => entry.date === monday)?.outfit?.items.map((item) => item.wardrobeItemId).sort()).toEqual(['a', 'b', 'd'])
    expect(mockApi.plannerEntries.find((entry) => entry.date === wednesday)?.outfit?.items.map((item) => item.wardrobeItemId).sort()).toEqual(['a', 'b', 'c'])
    await page.getByRole('button', { name: '이 날짜에서 코디 빼기', exact: true }).click()
    await page.getByRole('alertdialog', { name: '이 날짜에서 코디를 뺄까요?' }).getByRole('button', { name: '플래너에서 빼기', exact: true }).click()
    await expect.poll(() => mockApi.plannerEntries.some((entry) => entry.date === monday)).toBe(false)
    expect(mockApi.outfits[0].items.map((item) => item.wardrobeItemId).sort()).toEqual(['a', 'b', 'd'])
    expect(mockApi.plannerEntries.find((entry) => entry.date === wednesday)?.outfit?.items.map((item) => item.wardrobeItemId).sort()).toEqual(['a', 'b', 'c'])

    await page.goto('/lookbook')
    await page.getByRole('button', { name: 'ABC 코디 코디 상세 보기' }).click()
    await page.getByRole('button', { name: '코디북에서 삭제', exact: true }).click()
    await page.getByRole('alertdialog', { name: '코디북에서 삭제할까요?' }).getByRole('button', { name: '코디 삭제' }).click()
    await page.goto(`/plan/${wednesday}`)
    await page.getByRole('button', { name: 'AI 룩북 보기', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'AI 룩북', exact: true }).getByRole('img')).toHaveAttribute('src', oldImage)
    expect(mockApi.outfits).toHaveLength(0)
    expect(mockApi.plannerEntries).toHaveLength(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('다른 화면의 완료 결과와 무관하게 날짜 사진을 유지하고 코디북에 별도로 복사한다', async ({ page, mockApi }) => {
  const outfit = createOutfit({ id: bookId, name: '저장 사진 코디', generations: [{ status: 'completed', imageAsset: { id: 'saved-image', deliveryUrl: oldImage } }] })
  mockApi.previewImages = { 'saved-image': oldImage, 'other-screen-image': newImage }
  mockApi.outfits = []
  mockApi.plannerEntries = [{ date: monday, title: outfit.name, occasion: null, weatherSummary: null, temperatureC: null,
    outfit: { ...structuredClone(outfit), id: '000000000000000000000201', plannerOnly: true } }]
  await page.route('**/graphql', async (route) => {
    if (route.request().postDataJSON().query.includes('query OutfitPreviewForItems')) {
      await route.fulfill({ json: { data: { outfitPreviewForItems: { assetId: 'other-screen-image', imageUrl: newImage, mimeType: 'image/png', model: 'fixture-model', jobId: null, createdAt: new Date().toISOString() } } } })
    } else await route.fallback()
  })
  await page.goto(`/plan/${monday}`)
  await page.getByRole('button', { name: 'AI 룩북 보기', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'AI 룩북', exact: true }).getByRole('img')).toHaveAttribute('src', oldImage)
  await page.getByRole('button', { name: '저장된 AI 룩북 닫기' }).click()
  await page.getByRole('button', { name: '코디북에 추가', exact: true }).click()
  await expect.poll(() => mockApi.outfits.length).toBe(1)
  expect(mockApi.outfits[0].id).not.toBe(mockApi.plannerEntries[0].outfit!.id)
  expect(mockApi.plannerEntries[0].outfit!.plannerOnly).toBe(true)
  expect(mockApi.outfits[0].generations[0].imageAsset?.deliveryUrl).toBe(oldImage)
  await page.goto('/lookbook')
  await page.getByRole('button', { name: '저장 사진 코디 코디 상세 보기' }).click()
  await page.getByRole('button', { name: 'AI 룩북 보기', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'AI 룩북', exact: true }).getByRole('img')).toHaveAttribute('src', oldImage)
  expect(mockApi.operations).not.toContain('SetDirectPlannerEntry')
})
