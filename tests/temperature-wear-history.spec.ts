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
      const entries = api.plannerEntries.filter(entry => entry.wornAt && entry.outfit && ids.includes(entry.outfit.id))
      const records = entries.map(entry => ({ date: entry.date, temperatureC: entry.wearTemperatureC ?? null, feeling: entry.wearFeeling ?? null }))
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

for (const width of [390, 1440]) {
  test(`${width}px: 두 입구가 같은 기록을 열고 기온·체감 필터와 날짜별 기록에서 독립 복사한다`, async ({ page, mockApi }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    seed(mockApi)
    const original = structuredClone(mockApi.plannerEntries)
    const { requests } = await installHistory(page, mockApi)
    await page.goto('/lookbook')
    await page.getByRole('link', { name: '온도별 착용 기록', exact: true }).click()
    const card = page.getByRole('button', { name: '셔츠와 데님 착용 기록 보기', exact: true })
    await expect(card).toBeVisible()
    await expect(card.getByText('평균 16.2℃')).toBeVisible()
    await expect(card.getByText('적당했어요 · 총 2회 착용')).toBeVisible()
    await expect(card.getByText('2026년 11월 11일', { exact: true })).toBeVisible()
    await page.screenshot({ path: `${artifactDir}/${width}-list.png`, animations: 'disabled' })
    await page.getByRole('radiogroup', { name: '착용 기온' }).getByRole('radio', { name: '15~20℃ 미만', exact: true }).click()
    await expect(page.getByRole('button', { name: '여름 원피스 코디 착용 기록 보기' })).toHaveCount(0)
    await page.getByRole('radiogroup', { name: '착용 체감' }).getByRole('radio', { name: '추웠어요', exact: true }).click()
    await expect(page.getByText('조건에 맞는 착용 기록이 없어요')).toBeVisible()
    await page.getByRole('radiogroup', { name: '착용 기온' }).getByRole('radio', { name: '전체', exact: true }).click()
    await expect(card.getByText('평균 12℃')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('radio', { name: '추웠어요', exact: true })).toHaveAttribute('aria-checked', 'true')
    await card.click()
    const detail = page.getByRole('dialog', { name: '셔츠와 데님', exact: true })
    await expect(detail.getByText('평균 12℃', { exact: true })).toBeVisible()
    await expect(detail.getByText('평균 16.2℃', { exact: true })).toBeVisible()
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
    await page.goto('/wear-history?date=2026-11-14&from=%2Flookbook')
    await page.getByRole('button', { name: '셔츠와 데님 착용 기록 보기' }).click()
    const detail = page.getByRole('dialog', { name: '셔츠와 데님', exact: true })
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

test('기온 미기록을 따로 찾고 플래너에서 선택한 날짜로 돌아간다', async ({ page, mockApi }) => {
  seed(mockApi)
  await installHistory(page, mockApi)
  await page.goto('/plan?view=today&date=2026-11-15')
  await page.getByRole('link', { name: /온도별 착용 기록/ }).click()
  await page.getByRole('radio', { name: '기온 미기록', exact: true }).click()
  await expect(page.getByRole('button', { name: '셔츠와 데님 착용 기록 보기' })).toHaveCount(0)
  await page.getByRole('button', { name: '기온 없는 기록 착용 기록 보기' }).click()
  const detail = page.getByRole('dialog', { name: '기온 없는 기록', exact: true })
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
  await page.goto('/wear-history?date=2026-11-14')
  await page.getByRole('button', { name: '셔츠와 데님 착용 기록 보기' }).click()
  const detail = page.getByRole('dialog', { name: '셔츠와 데님', exact: true })
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
  await page.goto('/wear-history?date=2026-11-14')
  await page.getByRole('button', { name: '셔츠와 데님 착용 기록 보기' }).click()
  const detail = page.getByRole('dialog', { name: '셔츠와 데님', exact: true })
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

test('오늘의 순간 기온 대신 선택한 날짜의 예보 평균으로 비슷한 기록을 연다', async ({ page, mockApi }) => {
  seed(mockApi)
  const { requests } = await installHistory(page, mockApi)
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
      date: variables.input.date, expiresAt: '2026-11-13T02:10:00Z', temperatureC: 99, meanTemperatureC: 0,
      minTemperatureC: -3, maxTemperatureC: 3, apparentTemperatureC: 98, precipitationProbability: 0, weatherCode: 0,
      summary: '맑음', recommendedSeason: 'winter', source: 'open-meteo', attribution: 'Open-Meteo', attributionUrl: 'https://open-meteo.com/',
    } } } })
  })
  await page.goto('/#/plan?view=today&date=2026-11-14')
  const entry = page.getByRole('link', { name: /비슷한 기온에 입었던 코디/ })
  await expect(entry).toContainText('예보 평균 0℃ 기준')
  await entry.click()
  await expect(page.getByRole('radio', { name: '비슷한 기온', exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByText('선택한 날짜의 예보 평균 0℃와 가까운 기록이에요.')).toBeVisible()
  await expect.poll(() => requests.filter(request => request.query.includes('query TemperatureWearHistory')).at(-1)?.variables.input).toMatchObject({ minTemperatureC: -3, maxTemperatureC: 3 })
})
