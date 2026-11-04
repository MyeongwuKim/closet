import { createOutfit, expect, test } from './support/fixture'

test.use({ timezoneId: 'Asia/Seoul' })
const outfitId = '000000000000000000000101'
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())
const dateAgo = (days: number) => new Date(Date.parse(`${today}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10)

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px: 실제 착용을 확인한 일정만 횟수·온도에 포함하고 삭제하면 집계에서 빠진다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize(viewport)
    mockApi.outfits = [createOutfit({ id: outfitId })]
    const outfit = { id: outfitId, name: '기본 코디', style: 'casual', plannerOnly: false, items: [{ wardrobeItemId: 'item-1' }, { wardrobeItemId: 'item-2' }], generations: [] }
    mockApi.plannerEntries = [
      { date: dateAgo(2), wornAt: new Date().toISOString(), title: '기본 코디', occasion: null, weatherSummary: null, temperatureC: 99, wearTemperatureC: 16.2, outfit },
      { date: dateAgo(1), wornAt: new Date().toISOString(), title: '기본 코디', occasion: null, weatherSummary: null, temperatureC: 99, wearTemperatureC: 20.8, outfit },
      { date: today, title: '기본 코디', occasion: null, weatherSummary: null, temperatureC: 99, wearTemperatureC: 99, outfit },
      { date: dateAgo(-1), title: '기본 코디', occasion: null, weatherSummary: null, temperatureC: -99, wearTemperatureC: -99, outfit },
    ]
    await page.goto('/lookbook')
    const card = page.getByRole('button', { name: '기본 코디 코디 상세 보기' })
    await expect(card.getByText('봄', { exact: true })).toBeVisible()
    await expect(card.getByText('어제 착용 · 2회')).toBeVisible()
    await expect(card.getByText('16~21℃에 입었어요')).toBeVisible()
    const geometry = await card.evaluate((element) => ({ width: element.clientWidth, scroll: element.scrollWidth }))
    expect(geometry.scroll).toBeLessThanOrEqual(geometry.width + 1)
    await testInfo.attach(`wear-temperature-${viewport.width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })
    await card.click()
    const detail = page.getByRole('dialog', { name: '기본 코디 코디 상세' })
    await expect(detail.getByText('16~21℃에 입었어요')).toBeVisible()
    await expect(detail.getByText('봄 · 캐주얼 · 옷 2개')).toBeVisible()
    await testInfo.attach(`wear-temperature-detail-${viewport.width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })
    mockApi.plannerEntries = mockApi.plannerEntries.filter((entry) => entry.date !== dateAgo(2))
    await page.reload()
    await expect(card.getByText('21℃에 입었어요')).toBeVisible()
    await expect(card.getByText('어제 착용', { exact: true })).toBeVisible()
    mockApi.plannerEntries = mockApi.plannerEntries.filter((entry) => entry.date >= today)
    await page.reload()
    const dateLabel = `${Number(today.slice(5, 7))}월 ${Number(today.slice(8))}일`
    await expect(card.getByText(`착용 예정 · ${dateLabel}`, { exact: true })).toBeVisible()
    await expect(card.getByText(/℃에 입었어요/)).toHaveCount(0)
    mockApi.plannerEntries = []
    await page.reload()
    await expect(card.getByText('착용 0회', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test.describe('착용 기온과 같은 한국 날짜 기준', () => {
  test.use({ timezoneId: 'America/Los_Angeles' })
  test('한국 자정이 지나도 확인하지 않은 배정은 착용 기록으로 바뀌지 않는다', async ({ page, mockApi }) => {
    await page.clock.install({ time: new Date(`${today}T23:59:50+09:00`) })
    mockApi.outfits = [createOutfit({ id: outfitId })]
    mockApi.plannerEntries = [{ date: today, title: '기본 코디', occasion: null, weatherSummary: null, temperatureC: null, outfit: { id: outfitId, name: '기본 코디', style: 'casual', plannerOnly: false, items: [{ wardrobeItemId: 'item-1' }, { wardrobeItemId: 'item-2' }], generations: [] } }]
    await page.goto('/lookbook')
    const card = page.getByRole('button', { name: '기본 코디 코디 상세 보기' })
    await expect(card.getByText(/착용 예정/)).toBeVisible()
    await expect(card.getByText('어제 착용', { exact: true })).toHaveCount(0)
    await page.clock.fastForward(61_000)
    await expect(card.getByText('착용 0회', { exact: true })).toBeVisible()
    await expect(card.getByText('어제 착용', { exact: true })).toHaveCount(0)
    await expect(card.getByText(/착용 예정/)).toHaveCount(0)
  })
})

test('온도가 없는 기존 기록·미래 일정은 기온을 추정해 보여주지 않는다', async ({ page, mockApi }) => {
  mockApi.outfits = [createOutfit({ id: outfitId })]
  mockApi.plannerEntries = [{ date: dateAgo(1), wornAt: new Date().toISOString(), title: '기본 코디', occasion: null, weatherSummary: null, temperatureC: 18, outfit: { id: outfitId, name: '기본 코디', style: 'casual', plannerOnly: false, items: [{ wardrobeItemId: 'item-1' }, { wardrobeItemId: 'item-2' }], generations: [] } }]
  await page.goto('/lookbook')
  const card = page.getByRole('button', { name: '기본 코디 코디 상세 보기' })
  await expect(card.getByText('어제 착용', { exact: true })).toBeVisible()
  await expect(card.getByText(/℃에 입었어요/)).toHaveCount(0)
})

test('이미 허용된 위치는 자동 연결하고, 권한 요청이나 백그라운드 위치 수집은 요구하지 않는다', async ({ page, mockApi }) => {
  await page.addInitScript(() => {
    window.ClosetRuntimeConfig = { isNativeWebView: true }
    window.ClosetNative = {
      getAppInfo: async () => ({ permissions: { location: 'granted' }, capabilities: [] }),
      getCurrentLocation: async () => ({ status: 'available', latitude: 37.5665, longitude: 126.978, accuracy: 100 }),
    } as unknown as NonNullable<Window['ClosetNative']>
  })
  const locations: unknown[] = []
  await page.route('**/graphql', async (route) => {
    const { query, variables } = route.request().postDataJSON()
    if (!query.includes('mutation SyncWearWeatherLocation')) { await route.fallback(); return }
    locations.push(variables.input)
    await route.fulfill({ json: { data: { syncWearWeatherLocation: true } } })
  })
  await page.goto('/#/lookbook')
  await expect(page.getByRole('button', { name: `${mockApi.outfits[0].name} 코디 상세 보기` })).toBeVisible()
  await expect.poll(() => locations).toEqual([{ latitude: 37.5665, longitude: 126.978 }])
  await page.evaluate(() => {
    window.dispatchEvent(new Event('closet:native-app-active'))
    window.dispatchEvent(new Event('focus'))
  })
  await page.clock.setFixedTime(new Date(Date.now() + 31 * 60_000))
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('closet:native-app-state', { detail: { isActive: false } }))
    window.dispatchEvent(new Event('focus'))
  })
  expect(locations).toHaveLength(1)
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('closet:native-app-state', { detail: { isActive: true } }))
    window.dispatchEvent(new Event('closet:native-app-active'))
  })
  await expect.poll(() => locations.length).toBe(2)
  await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '옷장', exact: true }).click()
  await expect(page.getByRole('button', { name: '테스트 셔츠 옷 상세 보기' })).toBeVisible()
  expect(locations).toHaveLength(2)
})

test('위치 날씨를 끄면 새 위치를 읽지 않고 서버의 예정 지역 연결을 해제한다', async ({ page, mockApi }) => {
  await page.addInitScript(() => {
    localStorage.setItem('closet:notification-weather-preferences:v1', JSON.stringify({ locationWeather: false, locationWeatherDisabled: true }))
    window.ClosetRuntimeConfig = { isNativeWebView: true }
    window.ClosetNative = {
      getAppInfo: async () => ({ permissions: { location: 'granted' }, capabilities: [] }),
      getCurrentLocation: async () => { throw new Error('위치 사용 해제 후 조회하면 안 됩니다.') },
    } as unknown as NonNullable<Window['ClosetNative']>
  })
  const locations: unknown[] = []
  await page.route('**/graphql', async (route) => {
    const { query, variables } = route.request().postDataJSON()
    if (!query.includes('mutation SyncWearWeatherLocation')) { await route.fallback(); return }
    locations.push(variables.input)
    await route.fulfill({ json: { data: { syncWearWeatherLocation: true } } })
  })
  await page.goto('/#/lookbook')
  await expect(page.getByRole('button', { name: `${mockApi.outfits[0].name} 코디 상세 보기` })).toBeVisible()
  await expect.poll(() => locations).toEqual([null])
})
