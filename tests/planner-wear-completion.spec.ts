import { mkdirSync } from 'node:fs'
import { createOutfit, expect, test } from './support/fixture'

test.use({ timezoneId: 'Asia/Seoul' })
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())
const dateOffset = (days: number) => new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
const outfitId = '000000000000000000000101'

for (const viewport of [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 900 }]) {
  test(`${viewport.name}: 배정은 착용이 아니며 실제 착용 확인·취소가 저장되고 룩북에도 반영된다`, async ({ page, mockApi }) => {
    await page.setViewportSize(viewport)
    mockApi.outfits = [createOutfit({ id: outfitId, name: '실제 착용 테스트 코디' })]
    const outfit = { ...mockApi.outfits[0], plannerOnly: false }
    mockApi.plannerEntries = [{ date: today, title: outfit.name, occasion: null, weatherSummary: null, temperatureC: null, outfit }]
    await page.goto('/plan')
    const action = page.getByRole('group', { name: '실제 착용 확인' })
    await expect(action.getByRole('button', { name: '입었어요', exact: true })).toBeVisible()
    expect(mockApi.plannerEntries[0].wornAt).toBeUndefined()
    await action.getByRole('button', { name: '입었어요', exact: true }).click()
    await expect(action.getByText('착용 완료', { exact: true })).toBeVisible()
    expect(mockApi.plannerEntries[0].wornAt).toBeTruthy()
    expect(mockApi.operations).toContain('SetPlannerEntryWorn')
    await page.reload()
    await expect(action.getByRole('button', { name: '착용 취소', exact: true })).toBeVisible()
    mkdirSync('.playwright-mcp/wear-completion', { recursive: true })
    await page.screenshot({ path: `.playwright-mcp/wear-completion/${viewport.name}-day.png`, animations: 'disabled' })
    await page.goto('/lookbook')
    await expect(page.getByRole('button', { name: `${outfit.name} 코디 상세 보기` }).getByText('오늘 착용', { exact: true })).toBeVisible()
    await page.goto(`/plan/${today}`)
    await expect(action.getByText('착용 완료', { exact: true })).toBeVisible()
    await page.screenshot({ path: `.playwright-mcp/wear-completion/${viewport.name}-detail.png`, animations: 'disabled' })
    await action.getByRole('button', { name: '착용 취소', exact: true }).click()
    await expect(action.getByRole('button', { name: '입었어요', exact: true })).toBeVisible()
    expect(mockApi.plannerEntries[0].wornAt).toBeNull()
    await page.goto('/lookbook')
    await expect(page.getByRole('button', { name: `${outfit.name} 코디 상세 보기` }).getByText(/착용 예정/)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('과거의 미확인 배정도 착용으로 집계하지 않고 미래에는 완료 버튼을 숨긴다', async ({ page, mockApi }) => {
  mockApi.outfits = [createOutfit({ id: outfitId, name: '미확인 코디' })]
  const outfit = { ...mockApi.outfits[0], plannerOnly: false }
  mockApi.plannerEntries = [{ date: dateOffset(-3), title: outfit.name, occasion: null, weatherSummary: null, temperatureC: null, outfit }]
  await page.goto('/lookbook')
  await expect(page.getByRole('button', { name: `${outfit.name} 코디 상세 보기` }).getByText('착용 0회', { exact: true })).toBeVisible()
  await page.goto(`/plan?view=today&date=${dateOffset(-3)}`)
  await expect(page.getByRole('button', { name: '입었어요', exact: true })).toBeVisible()
  mockApi.plannerEntries = [{ ...mockApi.plannerEntries[0], date: dateOffset(1) }]
  await page.goto(`/plan?view=today&date=${dateOffset(1)}`)
  await expect(page.getByRole('button', { name: '입었어요', exact: true })).toHaveCount(0)
  expect(mockApi.operations).not.toContain('SetPlannerEntryWorn')
})
