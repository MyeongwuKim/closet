import { mkdirSync, readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { createOutfit, createWardrobeItem, expect, test, type MockApi } from './support/fixture'

test.use({ timezoneId: 'Asia/Seoul' })
const artifactDir = '.playwright-mcp/temperature-history'
mkdirSync(artifactDir, { recursive: true })
const shirt = `data:image/png;base64,${readFileSync('tests/support/mock-shirt.png').toString('base64')}`
const sourceId = '000000000000000000000101'
const olderId = '000000000000000000000102'
const dressId = '000000000000000000000103'
const unknownId = '000000000000000000000104'

/** 기록은 날짜 코디에만 있고 코디북에는 없는 상태도 지원하는 모의 데이터다. */
function seed(api: MockApi) {
  api.outfits = []
  api.wardrobeItems[0].displayImageAsset = { deliveryUrl: shirt }
  api.wardrobeItems.push(createWardrobeItem({ id: 'dress', name: '여름 원피스', category: 'dress', subcategory: '원피스' }))
  const source = { id: sourceId, name: '셔츠와 데님', style: 'casual', plannerOnly: true, items: [{ wardrobeItemId: 'item-1' }, { wardrobeItemId: 'item-2' }], generations: [] }
  api.plannerEntries = [
    { date: '2026-11-11', title: source.name, wornAt: '2026-11-11T09:00:00Z', wearFeeling: 'comfortable', temperatureC: 99, wearTemperatureC: 16.2, weatherSummary: null, occasion: null, outfit: source },
    { date: '2026-11-10', title: source.name, wornAt: '2026-11-10T09:00:00Z', wearFeeling: 'cold', temperatureC: 99, wearTemperatureC: 12, weatherSummary: null, occasion: null, outfit: { ...structuredClone(source), id: olderId } },
    { date: '2026-11-09', title: '여름 원피스 코디', wornAt: '2026-11-09T09:00:00Z', wearFeeling: 'hot', temperatureC: 99, wearTemperatureC: 25, weatherSummary: null, occasion: null, outfit: { ...structuredClone(source), id: dressId, name: '여름 원피스 코디', items: [{ wardrobeItemId: 'dress' }] } },
    { date: '2026-11-08', title: '기온 없는 기록', wornAt: '2026-11-08T09:00:00Z', temperatureC: 99, weatherSummary: null, occasion: null, outfit: { ...structuredClone(source), id: unknownId, name: '기온 없는 기록', items: [{ wardrobeItemId: 'dress' }, { wardrobeItemId: 'item-1' }] } },
  ]
}

/** 화면 요청과 표시를 검사하는 응답 fixture이며, 실제 인증·그룹화·기온 경계는 API 테스트에서 검사한다. */
async function installHistory(page: Page, api: MockApi, pageSize = 12) {
  await page.clock.setFixedTime(new Date('2026-11-13T02:00:00Z'))
  const requests: Array<Record<string, any>> = []
  const state = { failed: false }
  page.on('request', request => {
    if (request.url().endsWith('/graphql')) requests.push(request.postDataJSON())
  })
  await page.route('**/graphql', async route => {
    const { query, variables = {} } = route.request().postDataJSON()
    if (!query.includes('query TemperatureWearHistory')) { await route.fallback(); return }
    if (state.failed) {
      await route.fulfill({ json: { data: null, errors: [{ message: '기록을 읽지 못했어요.', extensions: { code: 'TEMPERATURE_HISTORY_LOAD_FAILED' } }] } })
      return
    }
    const input = variables.input ?? {}
    const groups = [[sourceId, olderId], [dressId], [unknownId]].flatMap(ids => {
      const entries = api.plannerEntries.filter(entry => entry.wornAt && entry.outfit && ids.includes(entry.outfit.id) &&
        (!input.compositionItemIds || (entry.outfit.items.length === input.compositionItemIds.length &&
          entry.outfit.items.every((item) => input.compositionItemIds.includes(item.wardrobeItemId)))))
      const records = entries.map(entry => ({
        date: entry.date, outfitId: entry.outfit!.id, wornAt: entry.wornAt!,
        automaticTemperatureC: entry.wearTemperatureC ?? null, manualTemperatureC: entry.manualWearTemperatureC ?? null,
        temperatureC: entry.manualWearTemperatureC ?? entry.wearTemperatureC ?? null, feeling: entry.wearFeeling ?? null,
      }))
      const matched = records.find(record => (!input.feeling || input.feeling === record.feeling)
        && (input.unrecordedOnly ? record.temperatureC === null : input.minTemperatureC == null && input.maxTemperatureC == null
          || record.temperatureC !== null && (input.minTemperatureC == null || record.temperatureC >= input.minTemperatureC) && (input.maxTemperatureC == null || record.temperatureC < input.maxTemperatureC)))
      if (!matched || !entries[0]?.outfit) return []
      const source = entries[0].outfit
      return [{ id: source.id, matchingDate: matched.date, records,
        outfit: createOutfit({ ...source, items: source.items.map((item, layerOrder) => ({ ...item, layerOrder, wardrobeItem: api.wardrobeItems.find(wardrobe => wardrobe.id === item.wardrobeItemId) })) }) }]
    })
    const offset = Number(input.cursor ?? 0)
    const hasNextPage = offset + pageSize < groups.length
    await route.fulfill({ json: { data: { temperatureWearHistory: { items: groups.slice(offset, offset + pageSize), totalCount: groups.length, hasNextPage, nextCursor: hasNextPage ? String(offset + pageSize) : null } } } })
  })
  return { requests, state }
}

const feelingFilter = (page: Page) => page.getByRole('button', { name: /^착용 체감 / })

async function chooseFeeling(page: Page, label: string) {
  await feelingFilter(page).click()
  const picker = page.getByRole('dialog', { name: '착용 체감 선택', exact: true })
  await picker.getByRole('button', { name: label, exact: true }).click()
  await expect(picker).toHaveCount(0)
  await expect(feelingFilter(page)).toBeFocused()
}

for (const edit of [false, true]) {
  test(`착용 기록에서 ${edit ? '옷을 바꿔' : '그대로'} 오늘 입은 코디로 저장해도 과거 기록은 유지한다`, async ({ page, mockApi }, testInfo) => {
    seed(mockApi)
    mockApi.wardrobeItems.push(createWardrobeItem({ id: 'new-worn-shirt', name: '오늘 입은 새 셔츠' }))
    const original = structuredClone(mockApi.plannerEntries)
    const { requests } = await installHistory(page, mockApi)
    await page.goto('/wear-history?date=2026-11-13&from=%2Fplan')
    await page.getByRole('button', { name: '셔츠와 데님 착용 기록 보기', exact: true }).click()
    const detail = page.getByRole('dialog', { name: '셔츠와 데님 코디 상세', exact: true })
    if (edit) {
      await detail.getByRole('button', { name: '옷 바꿔서 담기', exact: true }).click()
      await detail.getByRole('button', { name: '상의 교체하기', exact: true }).click()
      const picker = page.getByRole('dialog', { name: '상의 옷 선택', exact: true })
      await picker.getByRole('button', { name: /오늘 입은 새 셔츠/ }).click()
      await picker.getByRole('button', { name: '1개 선택 완료', exact: true }).click()
    }
    await detail.getByRole('radio', { name: '입은 코디 기록', exact: true }).click()
    await detail.screenshot({ path: testInfo.outputPath(`history-register-worn-${edit ? 'edited' : 'original'}.png`), animations: 'disabled' })
    await detail.getByRole('button', { name: '입은 코디로 기록', exact: true }).click()
    await expect(page).toHaveURL(/\/plan\?view=today&date=2026-11-13$/)
    await expect(page.getByRole('group', { name: '실제 착용 확인', exact: true }).getByText('착용 완료', { exact: true })).toBeVisible()
    const operation = edit ? 'mutation SetDirectPlannerEntry(' : 'mutation SetPlannerEntry('
    const saves = requests.filter(request => request.query.includes(operation))
    expect(saves).toHaveLength(1)
    expect(saves[0].variables.input.confirmWorn).toBe(true)
    expect(mockApi.operations).not.toContain('SetPlannerEntryWorn')
    expect(mockApi.plannerEntries.find(entry => entry.date === '2026-11-13')?.wornAt).toBeTruthy()
    expect(mockApi.plannerEntries.filter(entry => entry.date < '2026-11-13')).toEqual(original)
  })
}

for (const width of [390, 1440]) {
  test(`${width}px: 두 입구가 같은 기록을 열고 기온·체감 필터와 날짜별 기록에서 독립 복사한다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    seed(mockApi)
    const original = structuredClone(mockApi.plannerEntries)
    const { requests } = await installHistory(page, mockApi)
    await page.goto('/wear-history?date=2026-11-14&from=%2Fplan')
    const card = page.getByRole('button', { name: '셔츠와 데님 착용 기록 보기', exact: true })
    await expect(card).toBeVisible()
    await expect(card.getByText('16.2℃')).toBeVisible()
    await expect(card.getByText('적당했어요 · 총 2회 착용')).toBeVisible()
    await page.screenshot({ path: `${artifactDir}/${width}-list.png`, animations: 'disabled' })
    await expect(page.locator('.wear-history-filters select')).toHaveCount(0)
    await feelingFilter(page).click()
    const feelingPicker = page.getByRole('dialog', { name: '착용 체감 선택', exact: true })
    await expect(feelingPicker.getByRole('button', { name: '모든 체감', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.screenshot({ path: testInfo.outputPath(`feeling-picker-${width}.png`), animations: 'disabled' })
    await page.keyboard.press('Escape')
    await expect(feelingPicker).toHaveCount(0)
    await expect(feelingFilter(page)).toBeFocused()
    await page.getByRole('radiogroup', { name: '착용 기온' }).getByRole('radio', { name: '15~20℃ 미만', exact: true }).click()
    await expect(page.getByRole('button', { name: '여름 원피스 코디 착용 기록 보기' })).toHaveCount(0)
    await chooseFeeling(page, '추웠어요')
    await expect(page.getByText('조건에 맞는 착용 기록이 없어요')).toBeVisible()
    await page.getByRole('radiogroup', { name: '착용 기온' }).getByRole('radio', { name: '전체', exact: true }).click()
    await expect(card.getByText('12℃')).toBeVisible()
    await page.reload()
    await expect(feelingFilter(page)).toContainText('추웠어요')
    await card.click()
    const detail = page.getByRole('dialog', { name: '셔츠와 데님 코디 상세', exact: true })
    await expect(detail.getByText('2026년 11월 11일', { exact: true })).toBeVisible()
    await expect(detail.getByText('12℃', { exact: true })).toBeVisible()
    await expect(detail.getByText('16.2℃', { exact: true })).toBeVisible()
    await detail.getByLabel('담을 날짜', { exact: true }).fill('2026-11-14')
    await page.screenshot({ path: `${artifactDir}/${width}-detail.png`, animations: 'disabled' })
    await expect(detail.getByRole('button', { name: '이 날짜에 담기', exact: true })).toBeEnabled()
    await detail.getByRole('button', { name: '이 날짜에 담기', exact: true }).click()
    await expect(page).toHaveURL(/\/plan\?view=today&date=2026-11-14$/)
    await expect(page.getByText('셔츠와 데님', { exact: true })).toBeVisible()
    expect(mockApi.plannerEntries.filter(entry => entry.date < '2026-11-13')).toEqual(original)
    const copy = mockApi.plannerEntries.find(entry => entry.date === '2026-11-14')!
    expect(copy.outfit?.id).not.toBe(sourceId)
    expect(copy.wornAt).toBeNull()
    expect(copy.wearTemperatureC).toBeNull()
    expect(requests.find(request => request.query.includes('mutation SetPlannerEntry('))?.variables.input.activeItemsOnly).toBe(true)
    await page.screenshot({ path: `${artifactDir}/${width}-planner.png`, animations: 'disabled' })
    await page.getByRole('button', { name: '내일 예보 · 코디 보기', exact: true }).click()
    await page.getByRole('link', { name: /온도별 착용 기록|비슷한 기온에 입었던 코디/ }).click()
    await expect(page).toHaveURL(/\/wear-history\?.*date=2026-11-14/)
    await page.getByRole('button', { name: '착용 기록에서 돌아가기' }).click()
    await expect(page).toHaveURL(/\/plan\?view=today&date=2026-11-14$/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })

  test(`${width}px: 삭제된 옷을 과거에 유지하고 교체한 새 구성만 플래너에 담는다`, async ({ page, mockApi }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    seed(mockApi)
    mockApi.wardrobeItems[0].archivedAt = '2026-11-12T00:00:00Z'
    mockApi.wardrobeItems.push(createWardrobeItem({ id: 'replacement', name: '새 셔츠', displayImageAsset: { deliveryUrl: shirt } }))
    const original = structuredClone(mockApi.plannerEntries)
    const { requests } = await installHistory(page, mockApi)
    await page.goto('/wear-history?date=2026-11-14&from=%2Fplan')
    await page.getByRole('button', { name: '셔츠와 데님 착용 기록 보기' }).click()
    const detail = page.getByRole('dialog', { name: '셔츠와 데님 코디 상세', exact: true })
    await expect(detail.getByText('삭제된 옷은 교체한 뒤 담을 수 있어요.')).toBeVisible()
    await expect(detail.getByRole('button', { name: '이 날짜에 담기' })).toBeDisabled()
    await detail.getByRole('button', { name: '옷 바꿔서 담기', exact: true }).click()
    await detail.getByRole('button', { name: '상의 교체하기', exact: true }).click()
    const picker = page.getByRole('dialog', { name: '상의 옷 선택', exact: true })
    await picker.getByRole('button', { name: /새 셔츠/ }).click()
    await picker.getByRole('button', { name: '1개 선택 완료', exact: true }).click()
    await expect(detail.getByRole('button', { name: '이 날짜에 담기' })).toBeEnabled()
    await detail.getByRole('button', { name: '이 날짜에 담기' }).click()
    await expect(page).toHaveURL(/\/plan\?view=today&date=2026-11-14$/)
    const input = requests.find(request => request.query.includes('mutation SetDirectPlannerEntry('))?.variables.input
    expect(input.itemIds.sort()).toEqual(['item-2', 'replacement'])
    expect(input.name).toBe('셔츠와 데님')
    expect(input.style).toBe('casual')
    expect(mockApi.plannerEntries.filter(entry => entry.date < '2026-11-13')).toEqual(original)
  })
}

test('코디북 착용 기록에서 선택한 날짜의 기온만 수정하고 자동 기온으로 되돌린다', async ({ page, mockApi }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  seed(mockApi)
  mockApi.outfits = [createOutfit({ name: '저장한 셔츠와 데님' })]
  mockApi.plannerEntries[0].outfit!.generations = [{ status: 'completed', imageAsset: { id: 'wear-history-image', deliveryUrl: shirt } }]
  await installHistory(page, mockApi)
  await page.goto('/lookbook')
  await page.getByRole('button', { name: '저장한 셔츠와 데님 코디 상세 보기' }).click()
  const saved = page.getByRole('dialog', { name: '저장한 셔츠와 데님 코디 상세', exact: true })
  await expect(saved.getByRole('region', { name: '날짜별 착용 기록' }).locator('li')).toHaveCount(2)
  await saved.getByRole('button', { name: '코디북으로 돌아가기' }).click()
  await expect(page.getByRole('link', { name: '온도별 착용 기록', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '코디북 필터' }).click()
  const filter = page.getByRole('dialog', { name: '코디북 필터' })
  const temperatureFilter = filter.getByRole('button', { name: /^착용 기온 / })
  await temperatureFilter.click()
  const temperaturePicker = page.getByRole('dialog', { name: '착용 기온 선택', exact: true })
  await expect(temperaturePicker).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(temperaturePicker).toHaveCount(0)
  await expect(temperatureFilter).toBeFocused()
  await temperatureFilter.click()
  await temperaturePicker.getByRole('button', { name: '15~20℃ 미만', exact: true }).click()
  await expect(temperatureFilter).toContainText('15~20℃ 미만')
  await page.screenshot({ path: testInfo.outputPath('lookbook-temperature-filter.png'), animations: 'disabled' })
  await filter.getByRole('button', { name: '코디 보기', exact: true }).click()
  await expect(page).toHaveURL(/wearTemperature=15to20/)
  await expect(page.getByRole('button', { name: '여름 원피스 코디 착용 기록 보기' })).toHaveCount(0)
  await page.getByRole('button', { name: '셔츠와 데님 착용 기록 보기' }).click()
  const detail = page.getByRole('dialog', { name: '셔츠와 데님 코디 상세', exact: true })
  await expect(detail.getByRole('region', { name: '이 코디에 담은 옷' })).toBeVisible()
  await expect(detail.getByRole('button', { name: '이 날짜에 담기' })).toHaveCount(0)
  const records = detail.getByRole('region', { name: '날짜별 착용 기록' })
  await expect(records.locator('li')).toHaveCount(2)
  await records.getByRole('heading').scrollIntoViewIfNeeded()
  await expect(records.getByRole('heading')).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath('lookbook-wear-records.png'), animations: 'disabled' })
  await detail.getByRole('button', { name: 'AI 룩북 보기', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'AI 룩북', exact: true }).getByRole('img')).toHaveAttribute('src', shirt)
  await page.getByRole('button', { name: '저장된 AI 룩북 닫기', exact: true }).click()
  const original = detail.locator('li').filter({ has: page.locator('time[datetime="2026-11-11"]') })
  const edit = original.getByRole('button', { name: /착용 기록 수정/ })
  const feeling = page.getByRole('dialog', { name: '입었을 때 어땠나요?' })
  const temperature = page.getByRole('dialog', { name: '몇 도에 입었나요?' })
  await edit.click()
  await feeling.getByRole('button', { name: '기온만 수정' }).click()
  const input = temperature.getByLabel('착용 기온 (선택)')
  await expect(input).toHaveAttribute('placeholder', '16.2')
  await input.fill('9.5')
  await temperature.getByRole('button', { name: '저장', exact: true }).click()
  await expect(original.getByText('9.5℃', { exact: true })).toBeVisible()
  expect(mockApi.plannerEntries.find(entry => entry.date === '2026-11-10')?.manualWearTemperatureC).toBeUndefined()
  await edit.click()
  await feeling.getByRole('button', { name: '기온만 수정' }).click()
  await expect(input).toHaveValue('9.5')
  await input.clear()
  await temperature.getByRole('button', { name: '저장', exact: true }).click()
  await expect(original.getByText('16.2℃', { exact: true })).toBeVisible()
})

test('기온 미기록을 따로 찾고 플래너에서 선택한 날짜로 돌아간다', async ({ page, mockApi }) => {
  seed(mockApi)
  await installHistory(page, mockApi)
  await page.goto('/plan?view=today&date=2026-11-15')
  await page.getByRole('button', { name: '이날 예보 · 코디 보기', exact: true }).click()
  await page.getByRole('region', { name: '이날 예보', exact: true })
    .getByRole('link', { name: '온도별 착용 기록', exact: true }).click()
  await page.getByRole('radio', { name: '기온 미기록', exact: true }).click()
  await expect(page.getByRole('button', { name: '셔츠와 데님 착용 기록 보기' })).toHaveCount(0)
  await page.getByRole('button', { name: '기온 없는 기록 착용 기록 보기' }).click()
  const detail = page.getByRole('dialog', { name: '기온 없는 기록 코디 상세', exact: true })
  await expect(detail.getByLabel('담을 날짜', { exact: true })).toHaveValue('2026-11-15')
  await expect(detail.getByText('기온 미기록', { exact: true })).toBeVisible()
  await expect(detail.getByText(/평균 99|평균 0/)).toHaveCount(0)
  await detail.getByRole('button', { name: '착용 기록 상세 닫기' }).click()
  await page.getByRole('button', { name: '착용 기록에서 돌아가기' }).click()
  await expect(page).toHaveURL(/date=2026-11-15$/)
})

test('이미 계획한 날짜는 교체 확인을 거치며 취소하면 저장하지 않는다', async ({ page, mockApi }) => {
  seed(mockApi)
  mockApi.plannerEntries.push({ ...structuredClone(mockApi.plannerEntries[2]), date: '2026-11-14', wornAt: null, wearFeeling: null })
  await installHistory(page, mockApi)
  await page.goto('/wear-history?date=2026-11-14&from=%2Fplan')
  await page.getByRole('button', { name: '셔츠와 데님 착용 기록 보기' }).click()
  const detail = page.getByRole('dialog', { name: '셔츠와 데님 코디 상세', exact: true })
  await detail.getByRole('button', { name: '이 날짜에 담기' }).click()
  const confirm = page.getByRole('alertdialog', { name: '이날 코디를 바꿀까요?' })
  await confirm.getByRole('button', { name: '취소', exact: true }).click()
  expect(mockApi.operations).not.toContain('SetPlannerEntry')
  await detail.getByRole('button', { name: '이 날짜에 담기' }).click()
  await confirm.getByRole('button', { name: '코디 바꾸기', exact: true }).click()
  await expect(page).toHaveURL(/\/plan\?view=today&date=2026-11-14$/)
  expect(mockApi.plannerEntries.find(entry => entry.date === '2026-11-14')?.outfit?.name).toBe('셔츠와 데님')
})

test('다른 화면에서 착용 완료된 날짜는 저장 직전에 다시 확인하여 덮어쓰지 않는다', async ({ page, mockApi }) => {
  seed(mockApi)
  await installHistory(page, mockApi)
  await page.goto('/wear-history?date=2026-11-14&from=%2Fplan')
  await page.getByRole('button', { name: '셔츠와 데님 착용 기록 보기' }).click()
  const detail = page.getByRole('dialog', { name: '셔츠와 데님 코디 상세', exact: true })
  await expect(detail.getByRole('button', { name: '이 날짜에 담기' })).toBeEnabled()
  mockApi.plannerEntries.push({ ...structuredClone(mockApi.plannerEntries[2]), date: '2026-11-14', wornAt: '2026-11-14T09:00:00Z' })
  await detail.getByRole('button', { name: '이 날짜에 담기' }).click()
  await expect(detail.getByText('착용 완료한 날짜예요. 다른 날짜를 골라주세요.')).toBeVisible()
  expect(mockApi.operations).not.toContain('SetPlannerEntry')
})

test('조회 실패를 빈 기록과 구분하고 복구한 뒤 여러 페이지를 이어서 볼 수 있다', async ({ page, mockApi }) => {
  seed(mockApi)
  const { state, requests } = await installHistory(page, mockApi, 1)
  state.failed = true
  await page.goto('/wear-history')
  await expect(page.getByRole('alert')).toContainText('착용 기록을 불러오지 못했어요.')
  await expect(page.getByText('아직 착용 기록이 없어요')).toHaveCount(0)
  state.failed = false
  await page.getByRole('button', { name: '다시 불러오기', exact: true }).click()
  await expect(page.getByRole('button', { name: '셔츠와 데님 착용 기록 보기' })).toBeVisible()
  await expect(page.getByRole('button', { name: '기온 없는 기록 착용 기록 보기' })).toBeVisible()
  expect(requests.filter(request => request.query.includes('query TemperatureWearHistory')).some(request => request.variables.input.cursor !== null)).toBe(true)
})

/** 날씨 위치와 예보를 대체하며 순간 기온과 하루 평균을 다르게 둬 조회 기준을 구분한다. */
async function mockWeatherForHistory(page: Page, meanTemperatureC: number | null = 0) {
  await page.addInitScript(() => {
    window.ClosetRuntimeConfig = { isNativeWebView: true }
    window.ClosetNative = {
      getAppInfo: async () => ({ permissions: { location: 'granted' }, capabilities: [] }),
      getCurrentLocation: async () => ({ status: 'available', latitude: 37.57, longitude: 126.98, accuracy: 100 }),
    } as unknown as NonNullable<Window['ClosetNative']>
  })
  await page.route('**/graphql', async route => {
    const { query, variables } = route.request().postDataJSON()
    if (!query.includes('query WeatherForecast')) { await route.fallback(); return }
    await route.fulfill({ json: { data: { weatherForecast: {
      date: variables.input.date, expiresAt: '2026-11-13T02:10:00Z', temperatureC: 3, meanTemperatureC,
      minTemperatureC: -3, maxTemperatureC: 3, apparentTemperatureC: 2, precipitationProbability: 0, weatherCode: 0,
      summary: '맑음', recommendedSeason: 'winter', source: 'open-meteo', attribution: 'Open-Meteo', attributionUrl: 'https://open-meteo.com/',
    } } } })
  })
}

for (const width of [390, 1440]) {
  test(`${width}px: 오늘 날씨 팝업과 내일 예보에서 하루 평균에 맞는 착용 기록을 연다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    seed(mockApi)
    const { requests } = await installHistory(page, mockApi)
    await mockWeatherForHistory(page)
    await page.goto('/#/plan?view=today&date=2026-11-13')
    const badge = page.getByRole('button', { name: /오늘 3도, 맑음/ })
    await expect(badge).toBeVisible()
    await page.locator('.room-page-enter').evaluate(async (element) => { await Promise.all(element.getAnimations().map(animation => animation.finished)) })
    await expect(page.getByRole('link', { name: /비슷한 기온에 입었던 코디/ })).toHaveCount(0)
    const before = await page.locator('.plan-period-header').boundingBox()
    await badge.click()
    const weather = page.getByRole('dialog', { name: '오늘의 날씨', exact: true })
    const entry = weather.getByRole('link', { name: /비슷한 기온에 입었던 코디/ })
    await expect(entry).toContainText('예보 평균 0℃ 기준')
    await expect(entry).toBeInViewport()
    expect((await page.locator('.plan-period-header').boundingBox())!.y).toBe(before!.y)
    await page.screenshot({ path: testInfo.outputPath(`today-weather-history-${width}.png`), animations: 'disabled' })
    if (width === 390) {
      await page.keyboard.press('Escape')
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
      await badge.click()
      const popup = await weather.boundingBox()
      expect(popup!.x + popup!.width).toBeLessThanOrEqual(width)
      await entry.scrollIntoViewIfNeeded()
      await expect(weather).toBeVisible()
      await expect(entry).toBeInViewport()
      await page.screenshot({ path: testInfo.outputPath('today-weather-large-text.png'), animations: 'disabled' })
      await page.keyboard.press('Escape')
      await page.evaluate(() => { document.documentElement.style.fontSize = '' })
      await badge.click()
    }
    await page.keyboard.press('Escape')
    await expect(weather).toHaveCount(0)
    await expect(badge).toBeFocused()
    await badge.click()
    await entry.click()
    await expect(page.getByRole('radio', { name: '비슷한 기온', exact: true })).toHaveAttribute('aria-checked', 'true')
    await expect.poll(() => requests.filter(request => request.query.includes('query TemperatureWearHistory')).at(-1)?.variables.input).toMatchObject({ minTemperatureC: -3, maxTemperatureC: 3 })
    await page.getByRole('button', { name: '착용 기록에서 돌아가기' }).click()
    await expect(page).toHaveURL(/date=2026-11-13$/)
    await page.getByRole('button', { name: '다음 날짜', exact: true }).click()
    await page.getByRole('button', { name: '내일 예보 · 코디 보기', exact: true }).click()
    const tomorrow = page.getByRole('region', { name: '내일 예보', exact: true })
    const tomorrowEntry = tomorrow.getByRole('link', { name: /비슷한 기온에 입었던 코디/ })
    await expect(tomorrowEntry).toContainText('예보 평균 0℃ 기준')
    await tomorrow.evaluate(async (element) => { await Promise.all(element.parentElement!.getAnimations().map(animation => animation.finished)) })
    await page.screenshot({ path: testInfo.outputPath(`tomorrow-weather-history-${width}.png`), animations: 'disabled' })
    await tomorrowEntry.click()
    await expect(page.getByRole('radio', { name: '비슷한 기온', exact: true })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByText('예보 평균 0℃ 기준', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '착용 기록에서 돌아가기' }).click()
    await expect(page).toHaveURL(/date=2026-11-14$/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

for (const width of [390, 1440]) {
  test(`${width}px: 옷장과 같은 목록 폭·열 수를 쓰고 목록만 스크롤하며 필터 변경 때 맨 위로 돌아간다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    seed(mockApi)
    await installHistory(page, mockApi)
    const layoutItems = Array.from({ length: 12 }, (_, index) => createWardrobeItem({
      id: `history-shirt-${index}`, name: `기록용 셔츠 ${index + 1}`, displayImageAsset: { deliveryUrl: shirt },
    }))
    mockApi.wardrobeItems.push(...layoutItems)
    await page.goto('/closet')
    const closet = page.getByRole('region', { name: '옷장 목록', exact: true })
    const closetWidth = (await closet.boundingBox())!.width
    const closetColumns = await closet.locator('.wardrobe-item-grid').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)
    const groups = layoutItems.map((item, index) => {
      const id = (1000 + index).toString(16).padStart(24, '0')
      return {
        id, matchingDate: '2026-11-11', records: [{ date: '2026-11-11', temperatureC: 16.2, feeling: 'comfortable' }],
        outfit: createOutfit({ id, name: `기록 코디 ${index + 1}`, items: [
          { wardrobeItemId: item.id, layerOrder: 0, wardrobeItem: item },
          { wardrobeItemId: 'item-2', layerOrder: 1, wardrobeItem: mockApi.wardrobeItems[1] },
        ] }),
      }
    })
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    let pending = true
    await page.route('**/graphql', async route => {
      if (!route.request().postDataJSON().query.includes('query TemperatureWearHistory')) { await route.fallback(); return }
      if (pending) await gate
      await route.fulfill({ json: { data: { temperatureWearHistory: { items: groups, totalCount: groups.length, hasNextPage: false, nextCursor: null } } } })
    })
    try {
      await page.goto('/wear-history')
      await expect(page.getByRole('status', { name: '착용 기록 로딩 중', exact: true })).toBeVisible()
      const loadingTop = (await page.locator('[data-history-skeleton]').first().boundingBox())!.y
      pending = false
      release()
      const list = page.getByRole('region', { name: '착용 기록 목록', exact: true })
      const first = list.getByRole('button', { name: '기록 코디 1 착용 기록 보기', exact: true })
      await expect(first).toBeVisible()
      expect((await first.boundingBox())!.y).toBeCloseTo(loadingTop, 0)
      expect((await list.boundingBox())!.width).toBeCloseTo(closetWidth, 0)
      expect(await list.locator('.wear-history-grid').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(closetColumns)
      const heading = page.getByRole('heading', { name: '착용 기록', exact: true })
      const headingTop = (await heading.boundingBox())!.y
      const filterTop = (await feelingFilter(page).boundingBox())!.y
      await page.screenshot({ path: testInfo.outputPath(`history-catalog-${width}.png`), animations: 'disabled' })
      const lower = list.getByRole('button', { name: '기록 코디 11 착용 기록 보기', exact: true })
      await lower.scrollIntoViewIfNeeded()
      const scrollTop = await list.evaluate(element => element.scrollTop)
      expect(scrollTop).toBeGreaterThan(100)
      expect((await heading.boundingBox())!.y).toBe(headingTop)
      expect((await feelingFilter(page).boundingBox())!.y).toBe(filterTop)
      expect(await page.evaluate(() => scrollY)).toBe(0)
      await lower.click()
      await expect(page.getByRole('dialog', { name: '기록 코디 11 코디 상세', exact: true })).toBeVisible()
      await page.getByRole('button', { name: '착용 기록 상세 닫기', exact: true }).click()
      expect(await list.evaluate(element => element.scrollTop)).toBe(scrollTop)
      await chooseFeeling(page, '적당했어요')
      await expect.poll(() => list.evaluate(element => element.scrollTop)).toBe(0)
      if (width === 390) {
        await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
        await expect(first).toBeVisible()
        expect((await list.boundingBox())!.height).toBeGreaterThan(100)
        await page.screenshot({ path: testInfo.outputPath('history-large-text.png'), animations: 'disabled' })
        await feelingFilter(page).click()
        const picker = page.getByRole('dialog', { name: '착용 체감 선택', exact: true })
        await expect(picker).toBeVisible()
        for (const label of ['모든 체감', '추웠어요', '적당했어요', '더웠어요']) {
          const dimensions = await picker.getByRole('button', { name: label, exact: true }).locator('span').evaluate(element => ({
            height: element.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(element).lineHeight),
          }))
          expect(dimensions.height).toBeLessThanOrEqual(dimensions.lineHeight + 1)
        }
        await picker.getByRole('button', { name: '더웠어요', exact: true }).scrollIntoViewIfNeeded()
        await expect(picker.getByRole('button', { name: '더웠어요', exact: true })).toBeInViewport()
        await picker.getByRole('button', { name: '모든 체감', exact: true }).scrollIntoViewIfNeeded()
        await page.screenshot({ path: testInfo.outputPath('feeling-picker-large-text.png'), animations: 'disabled' })
        await page.keyboard.press('Escape')
        await expect(feelingFilter(page)).toBeFocused()
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    } finally { release() }
  })
}

for (const scenario of [{ date: '2026-11-13', mean: null }, { date: '2026-11-12', mean: 0 }]) {
  test(`${scenario.mean === null ? '예보 평균이 없으면' : '과거 날짜에서는'} 오늘 기온을 적용하지 않고 전체 기록으로 연다`, async ({ page, mockApi }) => {
    seed(mockApi)
    await installHistory(page, mockApi)
    await mockWeatherForHistory(page, scenario.mean)
    await page.goto(`/#/plan?view=today&date=${scenario.date}`)
    await page.getByRole('button', { name: /오늘 3도, 맑음/ }).click()
    const weather = page.getByRole('dialog', { name: '오늘의 날씨', exact: true })
    await expect(weather.getByText(/비슷한 기온에 입었던 코디/)).toHaveCount(0)
    await weather.getByRole('link', { name: '온도별 착용 기록', exact: true }).click()
    await expect(page.getByRole('radio', { name: '전체', exact: true }).first()).toHaveAttribute('aria-checked', 'true')
    await expect(page).toHaveURL(new RegExp(`date=${scenario.date}$`))
  })
}
