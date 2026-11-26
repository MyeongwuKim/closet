import { createOutfit, createWardrobeItem, expect, test } from './support/fixture'

type ColorScheme = 'auto' | 'tone-on-tone' | 'tone-in-tone' | 'achromatic' | 'accent'

type RecommendationRequest = {
  query: string
  variables?: {
    input?: {
      date: string
      season: string
      colorScheme?: ColorScheme
    }
  }
}

for (const previousDayRepeatOnly of [false, true]) test(`전날 조합을 제외한 뒤 ${previousDayRepeatOnly ? '후보가 없으면 전날 코디를 열 수 있다' : '주가 바뀌어도 새 조합을 보여준다'}`, async ({ page, mockApi }) => {
  const date = '2026-11-23'
  const previousDate = '2026-11-22'
  await page.clock.setFixedTime(new Date(`${date}T03:00:00Z`))
  const previousTop = createWardrobeItem({ id: 'previous-top', name: '어제 추천 상의' })
  const shoes = createWardrobeItem({ id: 'shoes', name: '신발', category: 'shoes' })
  const nextTop = createWardrobeItem({ id: 'next-top', name: '새 추천 상의' })
  mockApi.wardrobeItems.push(previousTop, shoes, nextTop)
  mockApi.plannerEntries = [{
    date: previousDate, title: null, occasion: null, weatherSummary: null, temperatureC: null,
    outfit: { ...createOutfit(), plannerOnly: true },
  }]
  const previousRecommendation = {
    date: previousDate, season: 'spring', ready: true, headline: '어제 추천', summary: '어제 입을 코디',
    style: null, reasons: [], items: [previousTop, mockApi.wardrobeItems[1], shoes],
  }
  await page.addInitScript(({ previousDate, previousRecommendation }) => {
    window.localStorage.setItem(`closet:today-outfit-recommendation:v8:e2e-user:${previousDate}:spring:wardrobe`, JSON.stringify([{
      id: 'yesterday', date: previousDate, createdAt: `${previousDate}T01:00:00.000Z`,
      season: 'spring', style: null, variation: 0, recommendation: previousRecommendation,
    }]))
  }, { previousDate, previousRecommendation })
  const requested: string[][][] = []
  await page.route('**/graphql', async (route) => {
    const { query, variables } = route.request().postDataJSON()
    if (!query.includes('query TodayOutfitRecommendation')) { await route.fallback(); return }
    expect(variables.input.date).toBe(date)
    requested.push(variables.input.previousDayOutfitItemIds)
    await route.fulfill({ json: { data: { todayOutfitRecommendation: {
      ...previousRecommendation, date, previousDayRepeatOnly, ready: !previousDayRepeatOnly,
      combinationCount: previousDayRepeatOnly ? 0 : 1,
      headline: previousDayRepeatOnly ? '전날과 다른 코디를 찾지 못했어요' : '오늘의 새 조합',
      items: previousDayRepeatOnly ? [] : [nextTop, mockApi.wardrobeItems[1]], profileSummary: [], model: 'fixture',
      source: 'fallback', colorSchemeApplied: true, weather: null,
    } } } })
  })
  await page.goto('/plan')
  await page.getByRole('button', { name: 'AI 코디 추천', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: '오늘의 AI 코디 추천' })
  await sheet.getByRole('button', { name: '조건 바꾸기', exact: true }).click()
  await sheet.getByRole('button', { name: '봄', exact: true }).click()
  if (previousDayRepeatOnly) {
    await expect(sheet.getByText('전날과 다른 코디를 찾지 못했어요', { exact: true })).toBeVisible()
    await sheet.getByRole('link', { name: '전날 코디 보기' }).click()
    await expect(page).toHaveURL(new RegExp(`/plan/${previousDate}$`))
  } else {
    await expect(sheet.getByText('오늘의 새 조합', { exact: true })).toBeVisible()
  }
  expect(requested).toEqual([[['item-1', 'item-2'], ['item-2', 'previous-top']]])
})

test('기준 코트에서 바로 추천받고 다시 열어도 본 코디와 최근 신발을 전달한다', async ({ page, mockApi }) => {
  const coat = createWardrobeItem({ id: 'duke-coat', name: '듀크 코트', category: 'outer', seasons: ['autumn'] })
  const pants = createWardrobeItem({ id: 'jeans', name: '데님', category: 'bottom' })
  const tops = ['니트', '셔츠', '가디건'].map((name, index) => createWardrobeItem({ id: `top-${index}`, name }))
  const shoes = ['더비', '스니커즈', '부츠'].map((name, index) => createWardrobeItem({ id: `shoe-${index}`, name, category: 'shoes' }))
  mockApi.wardrobeItems.push(coat, pants, ...tops, ...shoes)
  const requests: Array<{ date: string; season: string; baseItemId: string; colorScheme: string; seenOutfitItemIds?: string[][]; recentShoeItemIds?: string[] }> = []
  await page.route('**/graphql', async (route) => {
    const { query, variables } = route.request().postDataJSON()
    if (!query.includes('query TodayOutfitRecommendation')) { await route.fallback(); return }
    const index = requests.length
    const input = variables.input as (typeof requests)[number]
    requests.push(input)
    await route.fulfill({ json: { data: { todayOutfitRecommendation: {
      date: input.date, season: input.season, ready: true, combinationCount: 3 - index, style: null,
      headline: `듀크 코트 추천 ${index + 1}`, summary: '선택한 옷에 맞는 조합이에요.',
      colorSchemeApplied: true, items: [coat, pants, tops[index], shoes[index]], reasons: ['푸른 계열을 맞췄어요.'],
      profileSummary: [], model: 'fixture', source: 'fallback', weather: null,
    } } } })
  })
  await page.goto('/closet')
  await page.getByRole('button', { name: '듀크 코트 옷 상세 보기' }).click()
  const sheet = page.getByRole('dialog', { name: '이 옷으로 AI 코디 추천' })
  const requestForCoat = () => page.getByRole('button', { name: '이 옷으로 코디 추천', exact: true }).click()

  await requestForCoat()
  await expect(sheet.getByRole('heading', { name: '듀크 코트 추천 1' })).toBeVisible()
  await sheet.getByRole('button', { name: '다른 추천', exact: true }).click()
  await expect(sheet.getByRole('heading', { name: '듀크 코트 추천 2' })).toBeVisible()
  await sheet.getByRole('button', { name: 'AI 코디 추천 닫기' }).click()
  await requestForCoat()
  await expect(sheet.getByRole('heading', { name: '듀크 코트 추천 3' })).toBeVisible()

  expect(requests.map(({ baseItemId, season, colorScheme }) => [baseItemId, season, colorScheme]))
    .toEqual(Array(3).fill(['duke-coat', 'autumn', 'auto']))
  expect(requests.map(({ seenOutfitItemIds }) => seenOutfitItemIds)).toEqual([
    undefined, [['duke-coat', 'jeans', 'top-0']], [['duke-coat', 'jeans', 'top-0'], ['duke-coat', 'jeans', 'top-1']],
  ])
  expect(requests.map(({ recentShoeItemIds }) => recentShoeItemIds)).toEqual([undefined, ['shoe-0'], ['shoe-1', 'shoe-0']])
})

for (const viewport of [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
]) {
  test(`${viewport.name}: 계절을 고르면 색감 단계 없이 추천 결과를 열고 설명을 본다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const browserErrors: string[] = []
    page.on('pageerror', (error) => browserErrors.push(error.message))
    const requests: RecommendationRequest[] = []
    await page.route('**/graphql', async (route) => {
      const request = route.request().postDataJSON() as RecommendationRequest
      if (!request.query.includes('query TodayOutfitRecommendation')) { await route.fallback(); return }
      requests.push(request)
      const input = request.variables!.input!
      await route.fulfill({ json: { data: { todayOutfitRecommendation: {
        date: input.date, season: input.season, ready: true, combinationCount: 2,
        headline: '니트 중심 코디', summary: '옷장에 있는 옷으로 골랐어요.',
        style: null, colorSchemeApplied: true, items: mockApi.wardrobeItems,
        reasons: ['밝은 상의와 짙은 하의로 밝기 차이를 줬어요.'],
        profileSummary: [], model: 'fixture', source: 'fallback', weather: null,
      } } } })
    })

    await page.goto('/plan')
    await page.getByRole('button', { name: 'AI 코디 추천', exact: true }).click()
    const sheet = page.getByRole('dialog', { name: '오늘의 AI 코디 추천' })
    await sheet.getByRole('button', { name: '조건 바꾸기', exact: true }).click()
    await sheet.getByRole('button', { name: '봄', exact: true }).click()
    await expect(sheet.getByRole('heading', { name: '니트 중심 코디' })).toBeVisible()
    await expect(sheet.getByRole('button', { name: /톤온톤|톤인톤|무채색/ })).toHaveCount(0)
    expect(requests.map(({ variables }) => [variables!.input!.season, variables!.input!.colorScheme])).toEqual([['spring', 'auto']])
    await expect(sheet.getByRole('button', { name: '다른 추천' })).toBeInViewport({ ratio: 0.95 })
    await expect(sheet.getByRole('button', { name: '오늘 일정에 담기' })).toBeInViewport({ ratio: 0.95 })
    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-recommendation-result.png`), animations: 'disabled' })
    await sheet.getByRole('button', { name: '설명 전체 보기' }).click()
    const explanation = page.getByRole('dialog', { name: '이 조합을 추천한 이유' })
    await expect(explanation.getByText('밝은 상의와 짙은 하의로 밝기 차이를 줬어요.')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(browserErrors).toEqual([])
  })
}

test('옷 정보를 바꾼 뒤 다시 추천받으면 이전 기록 대신 갱신된 옷으로 조회한다', async ({ page, mockApi }) => {
  let recommendationCalls = 0
  let canceledCalls = 0
  page.on('requestfailed', (request) => {
    if (request.postData()?.includes('query TodayOutfitRecommendation') && request.failure()?.errorText === 'net::ERR_ABORTED') canceledCalls += 1
  })
  await page.route('**/graphql', async (route) => {
    const request = route.request().postDataJSON()
    if (!request.query.includes('query TodayOutfitRecommendation')) {
      await route.fallback()
      return
    }
    recommendationCalls += 1
    mockApi.operations.push('TodayOutfitRecommendation')
    const input = request.variables.input
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ data: { todayOutfitRecommendation: {
      date: input.date, season: input.season, ready: true, style: null,
      headline: `${mockApi.wardrobeItems[0].name} 중심 코디`, summary: '현재 옷장 정보로 추천했어요.',
      colorSchemeApplied: true, items: mockApi.wardrobeItems, reasons: ['상하의를 함께 골랐어요.'], profileSummary: [], model: 'e2e-mock', source: 'fallback', weather: null,
    } } }) })
  })
  const openRecommendation = async () => {
    await page.getByRole('button', { name: 'AI 코디 추천', exact: true }).click()
    await page.getByRole('button', { name: '조건 바꾸기', exact: true }).click()
    await page.getByRole('button', { name: '봄', exact: true }).click()
  }
  await page.goto('/plan')
  await openRecommendation()
  await expect(page.getByRole('heading', { name: '테스트 셔츠 중심 코디', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'AI 코디 추천 닫기' }).click()
  await page.getByRole('link', { name: '옷장', exact: true }).click()
  await page.getByRole('button', { name: '테스트 셔츠 옷 상세 보기' }).click()
  await page.getByRole('button', { name: '옷 정보 수정' }).click()
  const edit = page.getByRole('dialog', { name: '옷 정보 수정' })
  await edit.getByRole('textbox', { name: '아이템 이름' }).fill('바뀐 셔츠')
  await edit.getByRole('button', { name: '변경사항 저장' }).click()
  await expect(edit).toHaveCount(0)
  await page.getByRole('button', { name: '내 옷장으로 돌아가기' }).click()
  await page.getByRole('link', { name: '플래너', exact: true }).click()
  await openRecommendation()
  await expect(page.getByRole('heading', { name: '바뀐 셔츠 중심 코디', exact: true })).toBeVisible()
  expect(recommendationCalls - canceledCalls).toBe(2)
})


for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px: 가능한 조합이 하나면 불필요한 재추천을 막는다`, async ({ page, mockApi }) => {
    await page.setViewportSize(viewport)
    await page.route('**/graphql', async (route) => {
      const request = route.request().postDataJSON()
      if (!request.query.includes('query TodayOutfitRecommendation')) {
        await route.fallback()
        return
      }
      mockApi.operations.push('TodayOutfitRecommendation')
      const input = request.variables.input
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ data: { todayOutfitRecommendation: {
        date: input.date, season: input.season, ready: true, combinationCount: 1, style: null,
        headline: '함께 입을 수 있는 코디', summary: '지금 조건으로 고를 수 있는 조합이에요.',
        colorSchemeApplied: true, items: mockApi.wardrobeItems, reasons: ['상하의를 함께 골랐어요.'], profileSummary: [], model: 'e2e-mock', source: 'fallback', weather: null,
      } } }) })
    })
    await page.goto('/plan')
    await page.getByRole('button', { name: 'AI 코디 추천', exact: true }).click()
    await page.getByRole('button', { name: '조건 바꾸기', exact: true }).click()
    await page.getByRole('button', { name: '봄', exact: true }).click()
    await expect(page.getByRole('button', { name: '다른 조합 없음', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: '오늘 일정에 담기', exact: true })).toBeEnabled()
  })
}
