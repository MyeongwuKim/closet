import { createOutfit, expect, test } from './support/fixture'

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px: 하루 보기에서 날짜에 맞는 코디북 코디를 검색해 배정하고 교체한다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.clock.setFixedTime(new Date('2026-11-06T12:00:00+09:00'))
    const date = '2026-10-28'
    const route = `/plan?view=today&date=${date}`
    const work = createOutfit({ name: '출근 코디' })
    const casual = createOutfit({
      id: 'outfit-2',
      name: '주말 코디',
      items: [{ wardrobeItemId: 'item-2', layerOrder: 0 }],
    })
    mockApi.outfits = [work, casual]
    let release = () => {}
    const refetch = new Promise<void>((resolve) => { release = resolve })
    const assignmentDates: string[] = []
    await page.route('**/graphql', async (route) => {
      const { query, variables } = route.request().postDataJSON()
      if (query.includes('mutation SetPlannerEntry')) {
        assignmentDates.push(`${variables.input.weekStartsOn}/${variables.input.date}`)
      }
      if (query.includes('query PlannerEntries') && variables.from === date && assignmentDates.length > 0) {
        await refetch
      }
      await route.fallback()
    })

    try {
      await page.goto(route)
      const choose = page.getByRole('button', { name: '코디북에서 고르기', exact: true })
      await expect(choose).toBeVisible()
      await expect(page.getByRole('button', { name: '일주일 코디 설정' })).toHaveCount(0)
      await page.getByRole('link', { name: '옷 직접 고르기', exact: true }).click()
      await page.getByRole('button', { name: '플래너로 돌아가기' }).click()
      await expect(page).toHaveURL(route)
      await expect(choose).toBeInViewport({ ratio: 1 })
      await page.screenshot({ path: testInfo.outputPath('day-planner.png'), animations: 'disabled' })

      await choose.click()
      const picker = page.getByRole('dialog', { name: '코디 고르기' })
      await expect(picker.getByRole('heading', { name: '10월 28일에 넣을 코디' })).toBeVisible()
      await expect(picker.getByLabel('설정할 요일')).toHaveCount(0)
      await picker.getByRole('button', { name: '코디 검색', exact: true }).click()
      await picker.getByRole('searchbox', { name: '코디 검색어' }).fill('출근')
      await expect(picker.getByRole('button', { name: /주말 코디/ })).toHaveCount(0)
      await page.screenshot({ path: testInfo.outputPath('day-outfit-picker.png'), animations: 'disabled' })
      await picker.getByRole('button', { name: /출근 코디/ }).click()
      await expect(picker).toHaveCount(0)
      await expect(page.getByText('출근 코디', { exact: true })).toBeVisible()
      expect(assignmentDates).toEqual(['2026-10-26/2026-10-28'])
      expect(mockApi.plannerEntries).toHaveLength(1)
      expect(mockApi.plannerEntries[0].outfit?.plannerOnly).toBe(true)
      release()

      await page.getByRole('button', { name: '코디 바꾸기', exact: true }).click()
      await picker.getByRole('button', { name: /주말 코디/ }).click()
      await expect(picker).toHaveCount(0)
      await expect(page.getByText('주말 코디', { exact: true })).toBeVisible()
      expect(mockApi.plannerEntries.map((entry) => entry.date)).toEqual([date])

      await page.getByRole('radio', { name: '월간', exact: true }).click()
      await expect(page.getByRole('link', { name: `${date}, 주말 코디` })).toBeVisible()
      await expect(page.getByRole('button', { name: '일주일 코디 설정' })).toHaveCount(0)
      await page.getByRole('radio', { name: '주간', exact: true }).click()
      await expect(page.getByRole('button', { name: '일주일 코디 설정' })).toBeVisible()
    } finally {
      release()
    }
  })
}

test('오늘 코디 고르기에서 카드 사진을 맞추고 기온과 코디북 필터를 함께 적용한다', async ({ page, mockApi }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.setFixedTime(new Date('2026-11-21T12:00:00+09:00'))
  const worn = createOutfit({ id: '000000000000000000000101', name: '기온 기록 코디' })
  const unworn = createOutfit({
    id: '000000000000000000000102', name: '처음 입는 코디',
    createdAt: '2026-11-20T00:00:00.000Z',
    items: [{ wardrobeItemId: 'item-2', layerOrder: 0 }],
  })
  mockApi.outfits = [worn, unworn]
  mockApi.plannerEntries = [{
    date: '2026-11-19', title: worn.name, outfit: worn, occasion: null,
    weatherSummary: null, temperatureC: null, wornAt: '2026-11-19T12:00:00+09:00', wearTemperatureC: 12,
  }]
  await page.addInitScript(() => {
    window.ClosetRuntimeConfig = { isNativeWebView: true }
    window.ClosetNative = {
      getAppInfo: async () => ({ permissions: { location: 'granted' }, capabilities: [] }),
      getCurrentLocation: async () => ({ status: 'available', latitude: 37.57, longitude: 126.98, accuracy: 100 }),
    } as unknown as NonNullable<Window['ClosetNative']>
  })
  await page.route('**/graphql', async (route) => {
    const { query, variables } = route.request().postDataJSON()
    if (!query.includes('query WeatherForecast')) return route.fallback()
    await route.fulfill({ json: { data: { weatherForecast: {
      date: variables.input.date, expiresAt: '2026-11-21T04:00:00Z', temperatureC: 18, meanTemperatureC: 12,
      minTemperatureC: 7, maxTemperatureC: 18, apparentTemperatureC: 17, precipitationProbability: 0,
      weatherCode: 0, summary: '맑음', recommendedSeason: 'fall', source: 'open-meteo', attribution: 'Open-Meteo',
      attributionUrl: 'https://open-meteo.com/',
    } } } })
  })
  await page.goto('/plan?view=today&date=2026-11-21')
  await page.getByRole('button', { name: '코디북에서 고르기', exact: true }).click()
  const picker = page.getByRole('dialog', { name: '코디 고르기', exact: true })
  const wornCard = picker.getByRole('button', { name: /기온 기록 코디/ })
  const unwornCard = picker.getByRole('button', { name: /처음 입는 코디/ })
  await expect(wornCard).toContainText('12℃에 입었어요')
  const photoTop = (card: typeof wornCard) => card.locator('[class*="aspect-"]').first().evaluate((node) => node.getBoundingClientRect().top)
  expect(await photoTop(wornCard)).toBe(await photoTop(unwornCard))
  await page.screenshot({ path: testInfo.outputPath('today-outfit-picker.png'), animations: 'disabled' })

  await picker.getByRole('button', { name: '코디북 필터' }).click()
  const filters = page.getByRole('dialog', { name: '코디북 필터' })
  await filters.getByRole('button', { name: '오래된순' }).click()
  await page.keyboard.press('Escape')
  await expect(filters).toHaveCount(0)
  await expect(picker).toBeVisible()
  expect((await wornCard.boundingBox())!.x).toBeLessThan((await unwornCard.boundingBox())!.x)

  const weatherFilter = picker.getByRole('button', { name: '오늘 기온 · 평균 12℃' })
  await weatherFilter.click()
  await expect(weatherFilter).toHaveAttribute('aria-pressed', 'true')
  await expect(unwornCard).toHaveCount(0)
  await expect(wornCard).toBeVisible()
  await weatherFilter.click()
  await expect(unwornCard).toBeVisible()

  await picker.getByRole('button', { name: '코디북 필터' }).click()
  await filters.getByRole('button', { name: '네이비', exact: true }).click()
  await filters.getByRole('button', { name: '코디 보기', exact: true }).click()
  await expect(unwornCard).toHaveCount(0)
  await expect(wornCard).toBeVisible()
})
