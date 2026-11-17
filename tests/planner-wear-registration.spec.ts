import { createOutfit, createWardrobeItem, expect, test, type MockApi } from './support/fixture'
import type { Page } from '@playwright/test'

test.use({ timezoneId: 'Asia/Seoul' })
const today = '2026-11-16'
const tomorrow = '2026-11-17'
const yesterday = '2026-11-15'
const outfitId = '000000000000000000000901'
const oldOutfitId = '000000000000000000000902'

async function prepare(page: Page, api: MockApi) {
  await page.clock.setFixedTime(new Date(`${today}T10:00:00+09:00`))
  api.outfits = [createOutfit({ id: outfitId, name: '오늘의 셔츠와 데님' })]
}

function planned(api: MockApi, date = yesterday, id = outfitId) {
  return { date, title: api.outfits[0].name, occasion: null, weatherSummary: null, temperatureC: null, wornAt: null,
    outfit: { ...structuredClone(api.outfits[0]), id, plannerOnly: true } }
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px: 코디북에서 실제 입은 코디로 등록하면 한 번의 저장으로 착용까지 완료한다`, async ({ page, mockApi }, testInfo) => {
    await prepare(page, mockApi)
    await page.setViewportSize(viewport)
    const inputs: Array<Record<string, unknown>> = []
    page.on('request', request => {
      if (request.postData()?.includes('mutation SetPlannerEntry(')) inputs.push(request.postDataJSON().variables.input)
    })
    await page.goto('/plan')
    await page.getByRole('button', { name: '코디북에서 고르기', exact: true }).click()
    const picker = page.getByRole('dialog', { name: '하루 코디 선택', exact: true })
    await picker.getByRole('radio', { name: '입은 코디 기록', exact: true }).click()
    await page.screenshot({ path: testInfo.outputPath(`register-worn-${viewport.width}.png`), animations: 'disabled' })
    await picker.getByRole('button', { name: /오늘의 셔츠와 데님/ }).click()
    const action = page.getByRole('group', { name: '실제 착용 확인', exact: true })
    await expect(action.getByText('착용 완료', { exact: true })).toBeVisible()
    expect(inputs).toHaveLength(1)
    expect(inputs[0]).toMatchObject({ date: today, confirmWorn: true })
    expect(mockApi.plannerEntries[0].wornAt).toBeTruthy()
    expect(mockApi.operations).not.toContain('SetPlannerEntryWorn')
    expect(mockApi.operations).not.toContain('TodayOutfitRecommendation')
    await page.screenshot({ path: testInfo.outputPath(`worn-complete-${viewport.width}.png`), animations: 'disabled' })
    await page.reload()
    await expect(action.getByText('착용 완료', { exact: true })).toBeVisible()
    await page.goto('/lookbook')
    await expect(page.getByRole('button', { name: '오늘의 셔츠와 데님 코디 상세 보기', exact: true }).getByText('오늘 착용', { exact: true })).toBeVisible()
  })

  test(`${viewport.width}px: 직접 바꾼 옷도 저장과 동시에 실제 착용 기록으로 남긴다`, async ({ page, mockApi }, testInfo) => {
    await prepare(page, mockApi)
    await page.setViewportSize(viewport)
    mockApi.plannerEntries = [planned(mockApi, today)]
    mockApi.wardrobeItems.push(createWardrobeItem({ id: 'worn-shirt', name: '오늘 입은 셔츠' }))
    const inputs: Array<Record<string, unknown>> = []
    page.on('request', request => { if (request.postData()?.includes('mutation SetDirectPlannerEntry(')) inputs.push(request.postDataJSON().variables.input) })
    await page.goto(`/plan/${today}`)
    await page.getByRole('button', { name: '상의 교체하기', exact: true }).click()
    const picker = page.getByRole('dialog', { name: '상의 옷 선택', exact: true })
    await picker.getByRole('button', { name: /오늘 입은 셔츠/ }).click()
    await picker.getByRole('button', { name: '1개 선택 완료', exact: true }).click()
    await page.getByRole('radio', { name: '입은 코디 기록', exact: true }).click()
    await page.getByRole('button', { name: '입은 코디로 기록', exact: true }).click()
    await expect(page.getByRole('group', { name: '실제 착용 확인', exact: true }).getByText('착용 완료', { exact: true })).toBeVisible()
    expect(inputs).toHaveLength(1)
    expect(inputs[0]).toMatchObject({ date: today, confirmWorn: true, itemIds: expect.arrayContaining(['worn-shirt']) })
    expect(mockApi.operations).not.toContain('SetPlannerEntryWorn')
    await page.screenshot({ path: testInfo.outputPath(`direct-worn-${viewport.width}.png`), animations: 'disabled' })
  })

  test(`${viewport.width}px: 최근 미확인 예정을 제안하고 확인하면 지난 날짜에 기록한다`, async ({ page, mockApi }, testInfo) => {
    await prepare(page, mockApi)
    await page.setViewportSize(viewport)
    mockApi.plannerEntries = [planned(mockApi), planned(mockApi, '2026-11-14', oldOutfitId)]
    await page.goto('/plan')
    const review = page.getByRole('region', { name: '미확인 착용 기록', exact: true })
    await expect(review.getByText('어제 이 코디를 입었나요?', { exact: true })).toBeVisible()
    expect(mockApi.plannerEntries.every(entry => !entry.wornAt)).toBe(true)
    await page.reload()
    await expect(review).toBeVisible()
    expect(mockApi.operations).not.toContain('SetPlannerEntryWorn')
    await page.screenshot({ path: testInfo.outputPath(`wear-review-${viewport.width}.png`), animations: 'disabled' })
    await review.getByRole('button', { name: '입었어요', exact: true }).click()
    await expect(review).toHaveCount(0)
    expect(mockApi.plannerEntries.find(entry => entry.date === yesterday)?.wornAt).toBeTruthy()
    expect(mockApi.plannerEntries.find(entry => entry.date === '2026-11-14')?.wornAt).toBeNull()
    await page.reload()
    await expect(review).toHaveCount(0)
    expect(mockApi.operations).not.toContain('TodayOutfitRecommendation')
  })
}

test('미래에는 실제 착용 등록을 숨기고 날짜가 지나도 예정 코디를 자동 확정하지 않는다', async ({ page, mockApi }) => {
  await prepare(page, mockApi)
  await page.goto(`/plan?view=today&date=${tomorrow}`)
  await page.getByRole('button', { name: '코디북에서 고르기', exact: true }).click()
  const picker = page.getByRole('dialog', { name: '하루 코디 선택', exact: true })
  await expect(picker.getByRole('radiogroup', { name: '코디 등록 방식', exact: true })).toHaveCount(0)
  await picker.getByRole('button', { name: /오늘의 셔츠와 데님/ }).click()
  await expect(page.getByRole('button', { name: '코디 바꾸기', exact: true })).toBeVisible()
  expect(mockApi.plannerEntries[0].wornAt).toBeNull()
  await page.clock.setFixedTime(new Date('2026-11-18T10:00:00+09:00'))
  await page.reload()
  await expect(page.getByRole('group', { name: '실제 착용 확인', exact: true })).toBeVisible()
  expect(mockApi.plannerEntries[0].wornAt).toBeNull()
  expect(mockApi.operations).not.toContain('SetPlannerEntryWorn')
})

test('확인 카드를 넘기면 기록을 바꾸지 않고 같은 날 다시 제안하지 않는다', async ({ page, mockApi }) => {
  await prepare(page, mockApi)
  mockApi.plannerEntries = [planned(mockApi)]
  await page.goto('/plan')
  const review = page.getByRole('region', { name: '미확인 착용 기록', exact: true })
  await review.getByRole('button', { name: '넘기기', exact: true }).click()
  await expect(review).toHaveCount(0)
  expect(mockApi.plannerEntries[0].wornAt).toBeNull()
  await page.reload()
  await expect(review).toHaveCount(0)
  expect(mockApi.operations).not.toContain('SetPlannerEntryWorn')
})

test('착용 확인이 실패하면 미확인을 유지하고 다시 확인할 수 있다', async ({ page, mockApi }) => {
  await prepare(page, mockApi)
  mockApi.plannerEntries = [planned(mockApi)]
  let fail = true
  await page.route('**/graphql', async route => {
    if (fail && route.request().postDataJSON().query.includes('mutation SetPlannerEntryWorn(')) {
      await route.fulfill({ json: { errors: [{ message: '착용 확인을 저장하지 못했어요.', extensions: { code: 'PLANNER_WEAR_UPDATE_FAILED' } }] } })
    } else await route.fallback()
  })
  await page.goto('/plan')
  const review = page.getByRole('region', { name: '미확인 착용 기록', exact: true })
  await review.getByRole('button', { name: '입었어요', exact: true }).click()
  await expect(page.getByText('착용 확인을 저장하지 못했어요.', { exact: true })).toBeVisible()
  expect(mockApi.plannerEntries[0].wornAt).toBeNull()
  await expect(review).toBeVisible()
  fail = false
  await review.getByRole('button', { name: '입었어요', exact: true }).click()
  await expect(review).toHaveCount(0)
  expect(mockApi.plannerEntries[0].wornAt).toBeTruthy()
})

test('모바일 200% 글자에서도 확인 카드와 등록 방식이 가로로 넘치지 않는다', async ({ page, mockApi }, testInfo) => {
  await prepare(page, mockApi)
  await page.setViewportSize({ width: 390, height: 844 })
  mockApi.plannerEntries = [planned(mockApi)]
  await page.goto('/plan')
  await page.addStyleTag({ content: ':root { font-size: 200%; }' })
  const review = page.getByRole('region', { name: '미확인 착용 기록', exact: true })
  await expect(review).toBeVisible()
  await expect(review.getByRole('button', { name: '입었어요', exact: true })).toBeVisible()
  expect(await review.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  expect(await review.evaluate(element => {
    const copy = element.querySelector('.planner-wear-review-copy')!.getBoundingClientRect()
    const actions = element.querySelector('.planner-wear-review-actions')!.getBoundingClientRect()
    return copy.right <= actions.left || copy.bottom <= actions.top
  })).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await review.screenshot({ path: testInfo.outputPath('wear-review-200-percent.png'), animations: 'disabled' })
  await review.getByRole('button', { name: '넘기기', exact: true }).click()
  await page.getByRole('button', { name: '코디북에서 고르기', exact: true }).click()
  const picker = page.getByRole('dialog', { name: '하루 코디 선택', exact: true })
  const intent = picker.getByRole('radiogroup', { name: '코디 등록 방식', exact: true })
  await intent.getByRole('radio', { name: '입은 코디 기록', exact: true }).click()
  expect(await intent.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await intent.screenshot({ path: testInfo.outputPath('registration-200-percent.png'), animations: 'disabled' })
  expect(mockApi.plannerEntries[0].wornAt).toBeNull()
})
