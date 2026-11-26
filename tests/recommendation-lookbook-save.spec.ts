import { createOutfit, createWardrobeItem, expect, test } from './support/fixture'

test('오늘 날씨 추천으로 일정을 바꾼 뒤 코디북 이름·스타일·계절을 저장한다', async ({ page, mockApi }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    window.ClosetRuntimeConfig = { isNativeWebView: true }
    window.ClosetNative = {
      getAppInfo: async () => ({ permissions: { location: 'granted' }, capabilities: [] }),
      getCurrentLocation: async () => ({ status: 'available', latitude: 37.57, longitude: 126.98, accuracy: 100 }),
    } as unknown as NonNullable<Window['ClosetNative']>
  })
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())
  const planned = createOutfit({ name: '이미 정해둔 코디' })
  mockApi.outfits = []
  mockApi.plannerEntries = [{
    date: today, title: planned.name, occasion: null, temperatureC: null, weatherSummary: null,
    outfit: { ...planned, plannerOnly: true },
  }]
  const thermalContext = { revision: 'save-lookbook-test', direction: 'neutral', strength: 0, sampleCount: 0 }
  let recommendationRequests = 0
  await page.route('**/graphql', async (route) => {
    const { query, variables = {} } = route.request().postDataJSON()
    if (query.includes('query WeatherForecast')) {
      await route.fulfill({ json: { data: { weatherForecast: {
        date: variables.input.date, temperatureC: 21, meanTemperatureC: 18, minTemperatureC: 14, maxTemperatureC: 23, apparentTemperatureC: 20,
        weatherCode: 0, precipitationProbability: 0, recommendedSeason: 'spring', summary: '맑음', source: 'open-meteo',
        expiresAt: new Date(Date.now() + 600_000).toISOString(), attribution: 'Open-Meteo', attributionUrl: 'https://open-meteo.com/',
      } } } })
    } else if (query.includes('query ThermalRecommendationContext')) {
      await route.fulfill({ json: { data: { thermalRecommendationContext: thermalContext } } })
    } else if (query.includes('query TodayOutfitRecommendation')) {
      const { date, season, colorScheme, weather } = variables.input
      recommendationRequests += 1
      expect(colorScheme).toBe('auto')
      expect(weather.meanTemperatureC).toBe(18)
      await route.fulfill({ json: { data: { todayOutfitRecommendation: {
        date, season, colorScheme, colorSchemeApplied: true, ready: true,
        headline: '맑은 날의 추천 코디', summary: '오늘 기온에 맞춰 골랐어요.',
        items: mockApi.wardrobeItems, reasons: [], profileSummary: [], style: null,
        source: 'fallback', model: null, thermalContext, weather,
      } } } })
    } else await route.fallback()
  })

  await page.goto('/#/plan')
  await page.getByRole('button', { name: 'AI 코디 추천', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: '오늘의 AI 코디 추천' })
  await sheet.getByRole('button', { name: '오늘 날씨로 바로 추천', exact: true }).click()
  await expect(sheet.getByRole('heading', { name: '맑은 날의 추천 코디' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: '코디북에 저장', exact: true })).toHaveCount(0)
  await sheet.getByRole('button', { name: '오늘 코디 바꾸기', exact: true }).click()
  const offer = page.getByRole('alertdialog', { name: '코디북에도 추가할까요?' })
  await expect(offer).toBeVisible()
  expect(mockApi.plannerEntries[0]).toMatchObject({ date: today, title: '맑은 날의 추천 코디' })
  expect(mockApi.outfits).toHaveLength(0)
  await page.screenshot({ path: testInfo.outputPath('recommendation-lookbook-offer.png'), animations: 'disabled' })
  await offer.getByRole('button', { name: '코디북에 추가', exact: true }).click()
  const save = page.getByRole('dialog', { name: '이 코디를 저장할까요?' })
  await expect(save.getByRole('textbox', { name: '코디 이름' })).toHaveValue('맑은 날의 추천 코디')
  await save.getByRole('textbox', { name: '코디 이름' }).fill('날씨 보고 저장한 코디')
  await save.getByRole('button', { name: '미니멀', exact: true }).click()
  const seasons = save.getByRole('group', { name: '입을 계절' })
  await expect(seasons.getByRole('button', { name: '봄', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await seasons.getByRole('button', { name: '봄', exact: true }).click()
  await seasons.getByRole('button', { name: '가을', exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('recommendation-lookbook-info.png'), animations: 'disabled' })
  await save.getByRole('button', { name: '코디북에 저장', exact: true }).click()
  await expect(save).toHaveCount(0)
  await expect(sheet).toHaveCount(0)
  expect(mockApi.outfits).toHaveLength(1)
  expect(mockApi.outfits[0]).toMatchObject({ name: '날씨 보고 저장한 코디', style: 'minimal', seasons: ['autumn'] })
  expect(mockApi.outfits[0].items.map((item) => item.wardrobeItemId)).toEqual(mockApi.wardrobeItems.map((item) => item.id))
  expect(mockApi.plannerEntries[0].title).toBe('맑은 날의 추천 코디')
  expect(mockApi.operations.filter((item) => item === 'SetDirectPlannerEntry')).toHaveLength(1)
  expect(mockApi.operations).not.toContain('StartOutfitPreview')
  expect(recommendationRequests).toBe(1)
})

test('추천 상세에서 옷을 바꾼 조합을 저장한다', async ({ page, mockApi }) => {
  const originalItems = [...mockApi.wardrobeItems]
  const pants = createWardrobeItem({ id: 'another-bottom', name: '추천 코디에 바꿀 바지', category: 'bottom' })
  mockApi.wardrobeItems.push(pants)
  mockApi.outfits = []
  await page.route('**/graphql', async (route) => {
    const { query, variables } = route.request().postDataJSON()
    if (!query.includes('query TodayOutfitRecommendation')) {
      await route.fallback()
      return
    }
    const { date, season, colorScheme } = variables.input
    await route.fulfill({ json: { data: { todayOutfitRecommendation: {
      date, season, colorScheme, colorSchemeApplied: true, ready: true,
      headline: '편집할 추천 코디', summary: '옷장에서 골랐어요.', items: originalItems,
      reasons: [], profileSummary: [], style: null, source: 'fallback', model: null, weather: null,
    } } } })
  })

  await page.goto('/plan')
  await page.getByRole('button', { name: 'AI 코디 추천', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: '오늘의 AI 코디 추천' })
  await sheet.getByRole('button', { name: '조건 바꾸기', exact: true }).click()
  await sheet.getByRole('button', { name: '봄', exact: true }).click()
  await sheet.getByRole('button', { name: '추천 코디 구성 변경하기' }).click()

  const detail = page.getByRole('dialog', { name: '오늘의 추천 코디 상세' })
  await detail.getByRole('button', { name: '하의 교체하기' }).click()
  const picker = page.getByRole('dialog', { name: '하의 옷 선택' })
  await picker.getByRole('button', { name: /추천 코디에 바꿀 바지/ }).click()
  await picker.getByRole('button', { name: '1개 선택 완료' }).click()
  await expect(detail.getByRole('button', { name: 'AI 룩북 만들기' })).toBeVisible()
  await expect(detail.getByRole('button', { name: '코디북에 저장', exact: true })).toHaveCount(0)
  await detail.getByRole('button', { name: '오늘 일정에 추가', exact: true }).click()
  const offer = page.getByRole('alertdialog', { name: '코디북에도 추가할까요?' })
  await expect(offer).toBeVisible()
  expect(mockApi.plannerEntries[0].outfit?.items.map((item) => item.wardrobeItemId)).toEqual([originalItems[0].id, pants.id])
  await offer.getByRole('button', { name: '코디북에 추가', exact: true }).click()
  const save = page.getByRole('dialog', { name: '이 코디를 저장할까요?' })
  await expect(save).toBeVisible()
  await save.getByRole('button', { name: '코디북에 저장', exact: true }).click()
  await expect(detail).toHaveCount(0)
  expect(mockApi.outfits[0].items.map((item) => item.wardrobeItemId)).toEqual([originalItems[0].id, pants.id])
})
