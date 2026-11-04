import { expect, test } from './support/fixture'

test('일평균과 개인 체감 근거를 먼저 확인한 뒤 현재 날씨 코디에 반영한다', async ({ page, mockApi }) => {
  await page.addInitScript(() => {
    window.ClosetRuntimeConfig = { isNativeWebView: true }
    window.ClosetNative = {
      getAppInfo: async () => ({ permissions: { location: 'granted' }, capabilities: [] }),
      getCurrentLocation: async () => ({ status: 'available', latitude: 37.57, longitude: 126.98, accuracy: 100 }),
    } as unknown as NonNullable<Window['ClosetNative']>
  })
  const contexts: unknown[] = []
  const requests: Array<Record<string, any>> = []
  const thermalContext = { revision: 'cold-feedback-1', direction: 'warmer', strength: 0.4, sampleCount: 3 }
  await page.route('**/graphql', async (route) => {
    const { query, variables = {} } = route.request().postDataJSON()
    if (query.includes('query WeatherForecast')) {
      await route.fulfill({ json: { data: { weatherForecast: {
        date: variables.input.date, temperatureC: 21, meanTemperatureC: 18, minTemperatureC: 14, maxTemperatureC: 23, apparentTemperatureC: 20,
        weatherCode: 0, precipitationProbability: 0, recommendedSeason: 'spring', summary: '맑음', source: 'open-meteo',
        expiresAt: new Date(Date.now() + 600_000).toISOString(), attribution: 'Open-Meteo', attributionUrl: 'https://open-meteo.com/',
      } } } })
    } else if (query.includes('query ThermalRecommendationContext')) {
      contexts.push(variables)
      await route.fulfill({ json: { data: { thermalRecommendationContext: thermalContext } } })
    } else if (query.includes('query TodayOutfitRecommendation')) {
      requests.push(variables.input)
      expect(variables.input.weather.meanTemperatureC).toBe(18)
      expect(variables.input.thermalContextRevision).toBe(thermalContext.revision)
      await route.fulfill({ json: { data: { todayOutfitRecommendation: {
        date: variables.input.date, season: 'spring', ready: true, headline: '체감을 반영한 코디', summary: '보온성을 더 고려했어요.',
        style: null, colorSchemeApplied: true, items: mockApi.wardrobeItems,
        reasons: ['비슷한 평균 기온에서 남긴 체감 기록을 참고해 보온성을 더 고려했어요.'], profileSummary: [], source: 'fallback', model: null,
        thermalContext, weather: variables.input.weather,
      } } } })
    } else await route.fallback()
  })
  await page.goto('/#/plan')
  await page.getByRole('button', { name: 'AI 코디 추천', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: '오늘의 AI 코디 추천' })
  await sheet.getByRole('button', { name: '추천받기', exact: true }).click()
  await sheet.getByRole('button', { name: '현재 날씨로 받기', exact: true }).click()
  await sheet.getByRole('button', { name: /자동/ }).click()
  await expect(sheet.getByText('체감을 반영한 코디', { exact: true })).toBeVisible()
  await sheet.getByRole('button', { name: '설명 전체 보기', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '이 조합을 추천한 이유' }).getByText('비슷한 평균 기온에서 남긴 체감 기록을 참고해 보온성을 더 고려했어요.', { exact: true })).toBeVisible()
  expect(contexts.length).toBeGreaterThan(0)
  expect((contexts[0] as { meanTemperatureC: number }).meanTemperatureC).toBe(18)
  expect(requests).toHaveLength(1)
})

test('체감 근거가 중간에 바뀌면 최신 근거를 다시 읽고 이전 추천을 표시하지 않는다', async ({ page, mockApi }) => {
  await page.addInitScript(() => {
    window.ClosetRuntimeConfig = { isNativeWebView: true }
    window.ClosetNative = {
      getAppInfo: async () => ({ permissions: { location: 'granted' }, capabilities: [] }),
      getCurrentLocation: async () => ({ status: 'available', latitude: 37.57, longitude: 126.98, accuracy: 100 }),
    } as unknown as NonNullable<Window['ClosetNative']>
  })
  let revision = 'old-context'
  const requestedRevisions: string[] = []
  await page.route('**/graphql', async (route) => {
    const { query, variables = {} } = route.request().postDataJSON()
    if (query.includes('query WeatherForecast')) {
      await route.fulfill({ json: { data: { weatherForecast: {
        date: variables.input.date, temperatureC: 21, meanTemperatureC: 18, minTemperatureC: 14, maxTemperatureC: 23, apparentTemperatureC: 20,
        weatherCode: 0, precipitationProbability: 0, recommendedSeason: 'spring', summary: '맑음', source: 'open-meteo',
        expiresAt: new Date(Date.now() + 600_000).toISOString(), attribution: 'Open-Meteo', attributionUrl: 'https://open-meteo.com/',
      } } } })
    } else if (query.includes('query ThermalRecommendationContext')) {
      await route.fulfill({ json: { data: { thermalRecommendationContext: { revision, direction: 'cooler', strength: 0.4, sampleCount: 3 } } } })
    } else if (query.includes('query TodayOutfitRecommendation')) {
      requestedRevisions.push(variables.input.thermalContextRevision)
      if (variables.input.thermalContextRevision === 'old-context') {
        revision = 'fresh-context'
        await route.fulfill({ json: { errors: [{ message: '체감 기록이 바뀌었습니다.', extensions: { code: 'THERMAL_CONTEXT_CHANGED' } }] } })
      } else await route.fulfill({ json: { data: { todayOutfitRecommendation: {
        date: variables.input.date, season: 'spring', ready: true, headline: '최신 체감으로 고른 코디', summary: '가벼운 구성을 더 고려했어요.',
        style: null, colorSchemeApplied: true, items: mockApi.wardrobeItems, reasons: ['체감 기록을 반영했어요.'], profileSummary: [], source: 'fallback', model: null,
        thermalContext: { revision, direction: 'cooler', strength: 0.4, sampleCount: 3 }, weather: variables.input.weather,
      } } } })
    } else await route.fallback()
  })
  await page.goto('/#/plan')
  await page.getByRole('button', { name: 'AI 코디 추천', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: '오늘의 AI 코디 추천' })
  await sheet.getByRole('button', { name: '추천받기', exact: true }).click()
  await sheet.getByRole('button', { name: '현재 날씨로 받기', exact: true }).click()
  await sheet.getByRole('button', { name: /자동/ }).click()
  await expect(sheet.getByText('최신 체감으로 고른 코디', { exact: true })).toBeVisible()
  expect(requestedRevisions).toEqual(['old-context', 'fresh-context'])
})
