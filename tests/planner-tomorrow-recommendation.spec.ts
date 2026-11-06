import type { Page } from '@playwright/test'
import type { WeatherSnapshot } from '../packages/types/src/index'
import { createOutfit, createWardrobeItem, expect, test, type MockApi } from './support/fixture'

// 기기에서는 토요일이지만 한국은 일요일인 시각이다. 내일은 다음 주 월요일이다.
test.use({ timezoneId: 'America/Los_Angeles' })
const now = new Date('2026-11-07T15:30:00Z')
const today = '2026-11-08'
const tomorrow = '2026-11-09'
const recommendedName = '비 오는 날의 코디'
const thermalContext = { revision: 'tomorrow-weather-test', direction: 'warmer', strength: 0.4, sampleCount: 3 }

function forecast(date: string): WeatherSnapshot {
  const isTomorrow = date === tomorrow
  return {
    date,
    expiresAt: new Date(now.getTime() + 600_000).toISOString(),
    temperatureC: isTomorrow ? 13 : 24,
    meanTemperatureC: isTomorrow ? 13 : 20,
    minTemperatureC: isTomorrow ? 9 : 16,
    maxTemperatureC: isTomorrow ? 17 : 26,
    apparentTemperatureC: isTomorrow ? 12 : 23,
    precipitationProbability: isTomorrow ? 80 : 0,
    weatherCode: isTomorrow ? 63 : 0,
    summary: isTomorrow ? '비' : '맑음',
    recommendedSeason: 'autumn',
    source: 'open-meteo',
    attribution: 'Open-Meteo',
    attributionUrl: 'https://open-meteo.com/',
  }
}

/** 모의 기기 위치와 날짜별 예보를 제공하고 추천·일정 저장 요청에 전달된 날짜와 근거를 기록한다. */
async function mockTomorrowWeather(page: Page, mockApi: MockApi, locationGranted = true) {
  await page.clock.setFixedTime(now)
  await page.addInitScript((granted) => {
    window.ClosetRuntimeConfig = { isNativeWebView: true }
    window.ClosetNative = {
      getAppInfo: async () => ({ permissions: { location: granted ? 'granted' : 'denied' }, capabilities: [] }),
      getCurrentLocation: async () => granted
        ? { status: 'available', latitude: 37.57, longitude: 126.98, accuracy: 100 }
        : { status: 'permission-denied', canAskAgain: false },
    } as unknown as NonNullable<Window['ClosetNative']>
  }, locationGranted)
  mockApi.wardrobeItems.push(createWardrobeItem({ id: 'rain-jacket', name: '비 오는 날 재킷', category: 'outer', seasons: ['autumn'] }))
  const weatherDates: string[] = []
  const recommendationInputs: unknown[] = []
  const thermalInputs: unknown[] = []
  const plannerInputs: unknown[] = []

  await page.route('**/graphql', async (route) => {
    const { query, variables = {} } = route.request().postDataJSON()
    if (query.includes('query WeatherForecast')) {
      const date = variables.input.date as string
      weatherDates.push(date)
      await route.fulfill({ json: { data: { weatherForecast: forecast(date) } } })
    } else if (query.includes('query ThermalRecommendationContext')) {
      thermalInputs.push(variables)
      await route.fulfill({ json: { data: { thermalRecommendationContext: thermalContext } } })
    } else if (query.includes('query TodayOutfitRecommendation')) {
      const { date, season, colorScheme, weather } = variables.input
      recommendationInputs.push(variables.input)
      await route.fulfill({ json: { data: { todayOutfitRecommendation: {
        date, season, colorScheme, colorSchemeApplied: true, ready: true, combinationCount: 1,
        headline: recommendedName, summary: '비 예보와 일교차를 고려했어요.',
        items: mockApi.wardrobeItems, reasons: [], profileSummary: [], style: null,
        source: 'fallback', model: null, thermalContext, weather,
      } } } })
    } else {
      if (query.includes('mutation SetDirectPlannerEntry')) plannerInputs.push(variables.input)
      await route.fallback()
    }
  })

  return { weatherDates, recommendationInputs, thermalInputs, plannerInputs }
}

test('한국 기준 내일의 예보로 다음 주 일정에 코디를 담고 오늘의 착용 기록은 유지한다', async ({ page, mockApi }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const requests = await mockTomorrowWeather(page, mockApi)
  const wornOutfit = createOutfit({ name: '오늘 이미 입은 코디' })
  const wornEntry = {
    date: today, title: wornOutfit.name, occasion: null, temperatureC: 24, weatherSummary: '맑음',
    outfit: { ...wornOutfit, plannerOnly: true },
    wornAt: '2026-11-07T15:15:00Z', wearFeeling: 'comfortable' as const, wearTemperatureC: 20,
  }
  mockApi.plannerEntries = [wornEntry]
  const savedToday = structuredClone(wornEntry)

  await page.goto('/#/plan')
  await expect(page.getByRole('heading', { name: '2026년 11월 8일 일요일' })).toBeVisible()
  await expect(page.getByText(wornOutfit.name, { exact: true })).toBeVisible()
  await expect(page.getByText('착용 완료', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /오늘 24도, 맑음/ })).toBeVisible()
  await page.getByRole('button', { name: '다음 날짜', exact: true }).click()

  await expect(page.getByRole('heading', { name: '2026년 11월 9일 월요일' })).toBeVisible()
  const tomorrowForecast = page.getByRole('region', { name: '내일 예보', exact: true })
  await expect(tomorrowForecast.getByText('비', { exact: true })).toBeVisible()
  await expect(tomorrowForecast.getByText('최저 9° · 최고 17°', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /오늘 24도, 맑음/ })).toHaveCount(0)
  expect(requests.weatherDates).toEqual([today, tomorrow])
  expect(requests.recommendationInputs).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('tomorrow-forecast-mobile.png'), animations: 'disabled' })

  await tomorrowForecast.getByRole('button', { name: '내일 코디 추천', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: '내일의 AI 코디 추천', exact: true })
  await expect(sheet.getByRole('heading', { name: recommendedName })).toBeVisible()
  const addToTomorrow = sheet.getByRole('button', { name: '내일 일정에 담기', exact: true })
  await expect(addToTomorrow).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath('tomorrow-recommendation-mobile.png'), animations: 'disabled' })
  expect(requests.recommendationInputs).toEqual([expect.objectContaining({
    date: tomorrow,
    season: 'autumn',
    colorScheme: 'auto',
    weather: expect.objectContaining({ date: tomorrow, meanTemperatureC: 13, precipitationProbability: 80 }),
    thermalContextRevision: thermalContext.revision,
  })])
  expect(requests.thermalInputs).toContainEqual({ date: tomorrow, meanTemperatureC: 13 })

  let releaseDayRefetch = () => {}
  const dayRefetchReady = new Promise<void>((resolve) => { releaseDayRefetch = resolve })
  await page.route('**/graphql', async (route) => {
    const { query, variables = {} } = route.request().postDataJSON()
    if (requests.plannerInputs.length > 0 && query.includes('query PlannerEntries') && variables.from === tomorrow && variables.to === tomorrow) {
      await dayRefetchReady
    }
    await route.fallback()
  })
  const tomorrowCard = page.getByRole('link', { name: /11월 9일 월요일, 비 오는 날의 코디, 옷 설정하기/ })
  try {
    await addToTomorrow.click()
    await expect(sheet).toHaveCount(0)
    await expect(tomorrowCard).toBeVisible()
  } finally {
    releaseDayRefetch()
  }
  expect(requests.plannerInputs).toEqual([expect.objectContaining({
    date: tomorrow, weekStartsOn: tomorrow, temperatureC: 13, weatherSummary: '비',
    itemIds: mockApi.wardrobeItems.map((item) => item.id),
  })])
  expect(requests.recommendationInputs).toHaveLength(1)
  expect(mockApi.plannerEntries.find((entry) => entry.date === today)).toEqual(savedToday)
  expect(mockApi.plannerEntries.find((entry) => entry.date === tomorrow)).toMatchObject({
    wornAt: null,
    temperatureC: 13,
    weatherSummary: '비',
  })
  await page.reload()
  await expect(tomorrowCard).toBeVisible()
  await expect(page.getByRole('group', { name: '실제 착용 확인' })).toHaveCount(0)
  await page.getByRole('button', { name: '이전 날짜', exact: true }).click()
  await expect(page.getByText(wornOutfit.name, { exact: true })).toBeVisible()
  await expect(page.getByText('착용 완료', { exact: true })).toBeVisible()
})

test('데스크톱 월간 플래너의 내일 상세에서도 예보를 보고 기존 코디를 바꾼다', async ({ page, mockApi }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const requests = await mockTomorrowWeather(page, mockApi)
  const previousOutfit = createOutfit({ name: '미리 담은 월요일 코디' })
  mockApi.plannerEntries = [{
    date: tomorrow, title: previousOutfit.name, occasion: null, temperatureC: null, weatherSummary: null,
    outfit: { ...previousOutfit, plannerOnly: true }, wornAt: null,
  }]

  await page.goto('/#/plan?view=month&month=2026-11')
  await page.getByRole('link', { name: `${tomorrow}, ${previousOutfit.name}`, exact: true }).click()
  const tomorrowForecast = page.getByRole('region', { name: '내일 예보', exact: true })
  await expect(tomorrowForecast.getByText('최저 9° · 최고 17°', { exact: true })).toBeVisible()
  expect(requests.recommendationInputs).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('tomorrow-forecast-desktop.png'), animations: 'disabled' })

  await tomorrowForecast.getByRole('button', { name: '내일 코디 추천', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: '내일의 AI 코디 추천', exact: true })
  await sheet.getByRole('button', { name: '추천 코디 구성 변경하기' }).click()
  const recommendationDetail = page.getByRole('dialog', { name: '내일의 추천 코디 상세', exact: true })
  await recommendationDetail.getByRole('button', { name: '내일 코디 바꾸기', exact: true }).click()
  await expect.poll(() => mockApi.plannerEntries.find((entry) => entry.date === tomorrow)?.title).toBe(recommendedName)
  expect(requests.plannerInputs).toEqual([expect.objectContaining({ date: tomorrow, weekStartsOn: tomorrow })])

  await page.reload()
  await expect(page.getByRole('heading', { name: recommendedName, exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: '내일 예보', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '플래너로 돌아가기', exact: true }).click()
  await expect(page.getByRole('link', { name: `${tomorrow}, ${recommendedName}`, exact: true })).toBeVisible()
})

test('내일 예보를 위한 위치 권한이 없으면 날씨 없는 추천을 자동으로 보내지 않는다', async ({ page, mockApi }) => {
  const requests = await mockTomorrowWeather(page, mockApi, false)
  await page.goto(`/#/plan?view=today&date=${tomorrow}`)
  const tomorrowForecast = page.getByRole('region', { name: '내일 예보', exact: true })
  await tomorrowForecast.getByRole('button', { name: '내일 코디 추천', exact: true }).click()

  const sheet = page.getByRole('dialog', { name: '내일의 AI 코디 추천', exact: true })
  await expect(sheet.getByRole('alert')).toHaveText('기기 설정에서 위치 권한을 허용해 주세요.')
  await expect(sheet.getByRole('button', { name: '다시 시도', exact: true })).toBeVisible()
  await expect(sheet.getByRole('button', { name: '조건 바꾸기', exact: true })).toBeVisible()
  expect(requests.weatherDates).toEqual([])
  expect(requests.recommendationInputs).toEqual([])
  expect(requests.plannerInputs).toEqual([])
})
