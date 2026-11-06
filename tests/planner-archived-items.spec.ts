import { createOutfit, createWardrobeItem, expect, test } from './support/fixture'

const monday = '2026-11-02'
const cutout = (color: string) => `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="140"%3E%3Cpath d="M20 0H80L100 35L82 50L73 35V140H27V35L18 50L0 35Z" fill="${color}"/%3E%3C/svg%3E`
const coatImage = cutout('seagreen')
const savedImage = cutout('navy')

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px: 옷장 삭제 후에도 날짜의 옷·사진·착용 기록을 유지한다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.clock.setFixedTime(new Date('2026-11-05T03:00:00Z'))
    mockApi.wardrobeItems = [
      createWardrobeItem({ id: 'a', name: 'A 셔츠', displayImageAsset: { deliveryUrl: cutout('tan') } }),
      createWardrobeItem({ id: 'b', name: 'B 코트', category: 'outer', displayImageAsset: { deliveryUrl: coatImage } }),
      createWardrobeItem({ id: 'c', name: 'C 바지', category: 'bottom', displayImageAsset: { deliveryUrl: cutout('slategray') } }),
      createWardrobeItem({ id: 'd', name: 'D 재킷', category: 'outer' }),
    ]
    mockApi.previewImages = { 'date-image': savedImage }
    mockApi.outfits = [createOutfit({
      id: '000000000000000000000101', name: 'ABC 코디',
      items: ['b', 'a', 'c'].map((wardrobeItemId, layerOrder) => ({ wardrobeItemId, layerOrder })),
      generations: [{ status: 'completed', imageAsset: { id: 'date-image', deliveryUrl: savedImage } }],
    })]

    await page.goto('/plan?view=week&date=2026-11-02')
    await page.getByRole('button', { name: '일주일 코디 설정' }).click()
    const editor = page.getByRole('dialog', { name: '주간 코디 편집' })
    await editor.getByLabel('설정할 요일').getByRole('button').nth(0).click()
    await editor.getByRole('button').filter({ has: page.getByText('ABC 코디', { exact: true }) }).click()
    await expect.poll(() => mockApi.plannerEntries[0]?.outfit?.plannerOnly).toBe(true)
    await editor.getByRole('button', { name: '주간 옷 설정 닫기' }).click()
    await page.goto(`/plan/${monday}`)
    await page.getByRole('button', { name: '입었어요', exact: true }).click()
    await page.getByRole('radio', { name: '추웠어요', exact: true }).click()
    await expect.poll(() => mockApi.plannerEntries[0]?.wearFeeling).toBe('cold')
    const originalRecord = structuredClone(mockApi.plannerEntries[0])

    await page.goto('/closet')
    await page.getByRole('button', { name: 'B 코트 옷 상세 보기' }).click()
    await page.getByRole('button', { name: '옷장에서 삭제', exact: true }).click()
    await page.getByRole('alertdialog', { name: '옷장에서 삭제할까요?' }).getByRole('button', { name: '옷장에서 삭제', exact: true }).click()
    await expect(page).toHaveURL('/closet')
    await expect(page.getByRole('button', { name: 'B 코트 옷 상세 보기' })).toHaveCount(0)
    expect(mockApi.wardrobeItems.find((item) => item.id === 'b')?.archivedAt).toBeTruthy()
    expect(mockApi.plannerEntries[0]).toEqual(originalRecord)

    await page.goto(`/plan/${monday}`)
    for (const reload of [false, true]) {
      if (reload) await page.reload()
      await expect(page.getByRole('img', { name: 'B 코트', exact: true })).toHaveAttribute('src', coatImage)
      await expect(page.getByText('삭제된 옷', { exact: true })).toBeVisible()
      await expect(page.getByText('3개 아이템', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: '착용 취소', exact: true })).toBeVisible()
      await expect(page.getByRole('radio', { name: '추웠어요', exact: true })).toHaveAttribute('aria-checked', 'true')
      await expect(page.getByRole('button', { name: '이 날짜에 저장됨', exact: true })).toBeDisabled()
    }
    await page.screenshot({ path: testInfo.outputPath(`planner-archived-detail-${viewport.width}.png`), animations: 'disabled' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.getByRole('button', { name: '삭제된 옷 교체 후 코디북에 추가', exact: true })).toBeDisabled()
    await page.getByRole('radio', { name: '적당했어요', exact: true }).click()
    await expect(page.getByRole('radio', { name: '적당했어요', exact: true })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('img', { name: 'B 코트', exact: true })).toBeVisible()
    await page.getByRole('radio', { name: '추웠어요', exact: true }).click()
    await expect(page.getByRole('radio', { name: '추웠어요', exact: true })).toHaveAttribute('aria-checked', 'true')
    await expect.poll(() => mockApi.plannerEntries[0]?.wearFeeling).toBe('cold')

    await expect(page.getByRole('button', { name: '아우터 교체하기', exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: 'AI 룩북 보기', exact: true }).click()
    const imageDialog = page.getByRole('dialog', { name: 'AI 룩북', exact: true })
    await expect(imageDialog.getByRole('img')).toHaveAttribute('src', savedImage)
    await expect(imageDialog.getByRole('button', { name: /다시|재생성/ })).toHaveCount(0)
    await page.getByRole('button', { name: '저장된 AI 룩북 닫기', exact: true }).click()

    await page.goto(`/plan?view=today&date=${monday}`)
    await expect(page.getByRole('img', { name: 'B 코트', exact: true })).toBeVisible()
    await expect(page.getByText('삭제된 옷', { exact: true })).toBeVisible()
    await page.goto(`/plan?view=week&date=${monday}`)
    const mondayRow = page.locator(`[data-plan-date="${monday}"]`)
    await expect(mondayRow.getByRole('img', { name: 'B 코트', exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`planner-archived-week-${viewport.width}.png`), animations: 'disabled' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.goto('/plan?view=month&month=2026-11')
    const monthDay = page.getByRole('link', { name: /2026-11-02, ABC 코디/ })
    await expect(monthDay.getByRole('img', { name: 'B 코트', exact: true })).toBeVisible()

    expect(mockApi.plannerEntries[0]).toEqual(originalRecord)
    expect(mockApi.operations).not.toContain('SetDirectPlannerEntry')
    expect(mockApi.operations).not.toContain('GenerateOutfitPreview')
    await page.goto('/closet')
    await page.reload()
    await expect(page.getByRole('button', { name: 'B 코트 옷 상세 보기' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'A 셔츠 옷 상세 보기' })).toBeVisible()

    await page.goto(`/plan/${monday}`)
    await page.getByRole('button', { name: '착용 취소', exact: true }).click()
    await page.getByRole('button', { name: '아우터 교체하기', exact: true }).click()
    const replacementPicker = page.getByRole('dialog', { name: '아우터 옷 선택' })
    await expect(replacementPicker.getByRole('button', { name: /B 코트/ })).toHaveCount(0)
    await expect(replacementPicker.getByRole('button', { name: /D 재킷/ })).toBeVisible()
    await replacementPicker.getByRole('button', { name: '코디 설정으로 돌아가기', exact: true }).click()
    await expect(page.getByRole('img', { name: 'B 코트', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '아우터 교체하기', exact: true }).click()
    await replacementPicker.getByRole('button', { name: /D 재킷/ }).click()
    await replacementPicker.getByRole('button', { name: '1개 선택 완료', exact: true }).click()
    await expect(page.getByText('삭제된 옷', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '변경사항 저장', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: '변경사항 저장', exact: true }).click()
    await expect.poll(() => mockApi.plannerEntries[0]?.outfit?.items.map((item) => item.wardrobeItemId).sort()).toEqual(['a', 'c', 'd'])
    expect(mockApi.plannerEntries[0].wornAt).toBeNull()
    expect(mockApi.plannerEntries[0].wearFeeling).toBeNull()
    expect(mockApi.plannerEntries[0].outfit?.generations).toEqual([])
    await expect(page.getByRole('button', { name: '이 날짜에 저장됨', exact: true })).toBeDisabled()
    await page.reload()
    await expect(page.getByText('삭제된 옷', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('img', { name: 'B 코트', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '입었어요', exact: true })).toBeVisible()
    await expect(page.getByRole('radio', { name: '추웠어요', exact: true })).toHaveCount(0)
    expect(mockApi.operations.filter((operation) => operation === 'SetDirectPlannerEntry')).toHaveLength(1)
    expect(mockApi.operations).not.toContain('GenerateOutfitPreview')
  })
}
