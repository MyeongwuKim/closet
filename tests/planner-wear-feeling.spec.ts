import { mkdirSync } from 'node:fs'
import { createOutfit, expect, test } from './support/fixture'

test.use({ timezoneId: 'Asia/Seoul' })
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())
const outfitId = '000000000000000000000101'

for (const viewport of [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 900 }]) {
  test(`${viewport.name}: 착용 완료 후 체감 기록을 남기고 수정·삭제·취소할 수 있다`, async ({ page, mockApi }) => {
    await page.setViewportSize(viewport)
    mockApi.outfits = [createOutfit({ id: outfitId, name: '체감 기록 코디' })]
    const outfit = { ...mockApi.outfits[0], plannerOnly: false }
    mockApi.plannerEntries = [{ date: today, title: outfit.name, occasion: null, weatherSummary: null, temperatureC: null, outfit }]
    await page.goto('/plan')
    const feelings = page.getByRole('radiogroup', { name: '착용 체감', exact: true })
    await expect(feelings).toHaveCount(0)
    expect(mockApi.operations).not.toContain('SetPlannerEntryWearFeeling')
    await page.getByRole('button', { name: '입었어요', exact: true }).click()
    await expect(feelings).toBeVisible()
    const wornAt = mockApi.plannerEntries[0].wornAt
    await feelings.getByRole('radio', { name: '추웠어요', exact: true }).click()
    await expect(feelings.getByRole('radio', { name: '추웠어요', exact: true })).toHaveAttribute('aria-checked', 'true')
    expect(mockApi.plannerEntries[0].wearFeeling).toBe('cold')
    expect(mockApi.plannerEntries[0].wornAt).toBe(wornAt)
    await page.reload()
    await expect(feelings.getByRole('radio', { name: '추웠어요', exact: true })).toHaveAttribute('aria-checked', 'true')
    await feelings.getByRole('radio', { name: '적당했어요', exact: true }).click()
    await expect(feelings.getByRole('radio', { name: '적당했어요', exact: true })).toHaveAttribute('aria-checked', 'true')
    expect(mockApi.plannerEntries[0].wearFeeling).toBe('comfortable')
    for (const label of ['추웠어요', '적당했어요', '더웠어요']) {
      await expect(feelings.getByRole('radio', { name: label, exact: true })).toBeInViewport({ ratio: 1 })
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    mkdirSync('.playwright-mcp/wear-feeling', { recursive: true })
    await page.screenshot({ path: `.playwright-mcp/wear-feeling/${viewport.name}-day.png`, animations: 'disabled' })
    await page.goto(`/plan/${today}`)
    await expect(feelings.getByRole('radio', { name: '적당했어요', exact: true })).toHaveAttribute('aria-checked', 'true')
    await feelings.getByRole('radio', { name: '더웠어요', exact: true }).click()
    await expect(feelings.getByRole('radio', { name: '더웠어요', exact: true })).toHaveAttribute('aria-checked', 'true')
    await page.screenshot({ path: `.playwright-mcp/wear-feeling/${viewport.name}-detail.png`, animations: 'disabled' })
    await page.getByRole('button', { name: '체감 기록 지우기', exact: true }).click()
    await expect(feelings.getByRole('radio', { checked: true })).toHaveCount(0)
    expect(mockApi.plannerEntries[0].wearFeeling).toBeNull()
    await feelings.getByRole('radio', { name: '추웠어요', exact: true }).click()
    await expect(feelings.getByRole('radio', { name: '추웠어요', exact: true })).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('button', { name: '착용 취소', exact: true }).click()
    await expect(feelings).toHaveCount(0)
    expect(mockApi.plannerEntries[0].wearFeeling).toBeNull()
    await page.getByRole('button', { name: '입었어요', exact: true }).click()
    await expect(feelings.getByRole('radio', { checked: true })).toHaveCount(0)
    expect(mockApi.plannerEntries[0].wearFeeling).toBeNull()
  })
}

test('체감 저장 실패 시 기존 선택을 유지하고 사용자가 다시 선택할 수 있다', async ({ page, mockApi }) => {
  const outfit = { ...createOutfit({ id: outfitId, name: '기록 오류 확인 코디' }), plannerOnly: false }
  mockApi.outfits = [outfit]
  mockApi.plannerEntries = [{ date: today, wornAt: new Date().toISOString(), wearFeeling: 'comfortable', title: outfit.name, occasion: null, weatherSummary: null, temperatureC: null, outfit }]
  let failNext = true
  await page.route('**/graphql', async (route) => {
    if (route.request().postDataJSON().query.includes('mutation SetPlannerEntryWearFeeling') && failNext) {
      failNext = false
      await route.fulfill({ json: { errors: [{ message: '체감 기록 저장을 다시 시도해주세요.' }] } })
    } else await route.fallback()
  })
  await page.goto('/plan')
  const feelings = page.getByRole('radiogroup', { name: '착용 체감', exact: true })
  await expect(feelings.getByRole('radio', { name: '적당했어요', exact: true })).toHaveAttribute('aria-checked', 'true')
  await feelings.getByRole('radio', { name: '더웠어요', exact: true }).click()
  await expect(page.getByText('체감 기록 저장을 다시 시도해주세요.', { exact: true })).toBeVisible()
  await expect(feelings.getByRole('radio', { name: '적당했어요', exact: true })).toHaveAttribute('aria-checked', 'true')
  expect(mockApi.plannerEntries[0].wearFeeling).toBe('comfortable')
  await feelings.getByRole('radio', { name: '더웠어요', exact: true }).click()
  await expect(feelings.getByRole('radio', { name: '더웠어요', exact: true })).toHaveAttribute('aria-checked', 'true')
})

test('같은 코디라도 날짜별로 남긴 체감을 구분해서 보여준다', async ({ page, mockApi }) => {
  const outfit = { ...createOutfit({ id: outfitId, name: '날짜별 체감 코디' }), plannerOnly: false }
  mockApi.outfits = [outfit]
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
  const entry = { title: outfit.name, occasion: null, weatherSummary: null, temperatureC: null, wornAt: new Date().toISOString(), outfit }
  mockApi.plannerEntries = [
    { ...entry, date: today, wearFeeling: 'comfortable' },
    { ...entry, date: yesterday, wearFeeling: 'cold' },
  ]
  await page.goto(`/plan?view=today&date=${yesterday}`)
  await expect(page.getByRole('radio', { name: '추웠어요', exact: true })).toHaveAttribute('aria-checked', 'true')
  await page.goto('/plan')
  await expect(page.getByRole('radio', { name: '적당했어요', exact: true })).toHaveAttribute('aria-checked', 'true')
  expect(mockApi.operations).not.toContain('SetPlannerEntryWearFeeling')
})

test('체감을 저장하는 동안 다른 선택과 착용 취소를 막아 중복 요청을 보내지 않는다', async ({ page, mockApi }) => {
  const outfit = { ...createOutfit({ id: outfitId, name: '체감 저장 중 코디' }), plannerOnly: false }
  mockApi.outfits = [outfit]
  mockApi.plannerEntries = [{ date: today, wornAt: new Date().toISOString(), wearFeeling: 'comfortable', title: outfit.name, occasion: null, weatherSummary: null, temperatureC: null, outfit }]
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  let requests = 0
  await page.route('**/graphql', async (route) => {
    if (route.request().postDataJSON().query.includes('mutation SetPlannerEntryWearFeeling')) {
      requests += 1
      await gate
    }
    await route.fallback()
  })
  try {
    await page.goto('/plan')
    const feelings = page.getByRole('radiogroup', { name: '착용 체감', exact: true })
    await feelings.getByRole('radio', { name: '더웠어요', exact: true }).click()
    await expect.poll(() => requests).toBe(1)
    for (const label of ['추웠어요', '적당했어요', '더웠어요']) {
      await expect(feelings.getByRole('radio', { name: label, exact: true })).toBeDisabled()
    }
    await expect(page.getByRole('button', { name: '체감 기록 지우기', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: '착용 취소', exact: true })).toBeDisabled()
    release()
    await expect(feelings.getByRole('radio', { name: '더웠어요', exact: true })).toHaveAttribute('aria-checked', 'true')
    expect(requests).toBe(1)
  } finally { release() }
})
