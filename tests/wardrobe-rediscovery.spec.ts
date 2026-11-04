import { mkdirSync } from 'node:fs'
import { expect, test, createWardrobeItem } from './support/fixture'

for (const viewport of [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 900 }]) {
  test(`${viewport.name}: 묻힌 옷을 먼저 보여주고 그 옷을 고정해 코디 추천으로 연결한다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize(viewport)
    const oldShirt = createWardrobeItem({ id: 'forgotten-shirt', name: '잊고 있던 네이비 셔츠' })
    mockApi.wardrobeItems = [oldShirt,
      createWardrobeItem({ id: 'pants', name: '오래된 데님', category: 'bottom' }),
      createWardrobeItem({ id: 'jacket', name: '가을 재킷', category: 'outer' }),
    ]
    mockApi.rediscoveryItems = mockApi.wardrobeItems.map((item, index) => ({ item, reason: index === 0 ? 'no_wear_record' : 'long_unworn', daysSinceLastWorn: index === 0 ? null : 90 }))
    const recommendationInputs: Array<{ baseItemId: string }> = []
    await page.route('**/graphql', async (route) => {
      const { query, variables } = route.request().postDataJSON()
      if (query.includes('query WardrobePage')) {
        // 하이라이트 옷은 현재 목록 페이지에 없어도 표시되고 추천 기준으로 전달되어야 한다.
        await route.fulfill({ json: { data: { wardrobePage: { items: mockApi.wardrobeItems.slice(1), totalCount: 50, hasNextPage: false, nextCursor: null } } } })
      } else if (query.includes('query TodayOutfitRecommendation')) {
        recommendationInputs.push(variables.input)
        await route.fulfill({ json: { data: { todayOutfitRecommendation: {
          date: variables.input.date, season: 'spring', ready: true, headline: '셔츠를 다시 입는 코디',
          summary: '옷장 속 셔츠를 기준으로 구성했어요.', style: null, colorScheme: 'auto', colorSchemeApplied: true,
          items: mockApi.wardrobeItems.slice(0, 2), reasons: ['등록된 옷의 색을 비교했어요.'], profileSummary: [], source: 'fallback', model: null, weather: null,
        } } } })
      } else await route.fallback()
    })
    await page.goto('/closet')
    const toggle = page.getByRole('button', { name: '잊고 있던 옷 확인하기', exact: true })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(mockApi.operations).not.toContain('WardrobeRediscovery')
    mkdirSync('.playwright-mcp/rediscovery', { recursive: true })
    await page.screenshot({ path: `.playwright-mcp/rediscovery/collapsed-${viewport.name}.png`, animations: 'disabled' })
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const section = page.getByRole('region', { name: '잊고 있던 옷', exact: true })
    await expect(section).toBeVisible()
    await expect(section.getByText('아직 착용 기록이 없어요')).toBeVisible()
    await expect(section.getByRole('button', { name: `${oldShirt.name} 다시 보기` })).toBeInViewport()
    await expect.poll(() => mockApi.rediscoverySeenIds.includes(oldShirt.id)).toBe(true)
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(section.getByRole('button', { name: `${oldShirt.name} 다시 보기` })).toHaveCount(0)
    await toggle.click()
    await expect(section.getByRole('button', { name: `${oldShirt.name} 다시 보기` })).toBeVisible()
    if (viewport.name === 'mobile') {
      expect(mockApi.rediscoverySeenIds).not.toContain('jacket')
      await section.getByRole('region', { name: '잊고 있던 옷 목록' }).evaluate((element) => { element.scrollLeft = element.scrollWidth })
      await expect.poll(() => mockApi.rediscoverySeenIds.includes('jacket')).toBe(true)
      await section.getByRole('region', { name: '잊고 있던 옷 목록' }).evaluate((element) => { element.scrollLeft = 0 })
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`rediscovery-${viewport.name}.png`), animations: 'disabled' })
    await section.getByRole('button', { name: `${oldShirt.name} 코디 추천` }).click()
    const sheet = page.getByRole('dialog', { name: '이 옷으로 AI 코디 추천' })
    await expect(sheet.getByText(oldShirt.name, { exact: true })).toBeVisible()
    await sheet.getByRole('button', { name: '봄', exact: true }).click()
    await sheet.getByRole('button', { name: /자동/ }).click()
    await expect(sheet.getByText('셔츠를 다시 입는 코디')).toBeVisible()
    expect(recommendationInputs).toHaveLength(1)
    expect(recommendationInputs[0].baseItemId).toBe(oldShirt.id)
    await sheet.getByRole('button', { name: 'AI 코디 추천 닫기' }).click()
    await section.getByRole('button', { name: `${oldShirt.name} 다시 보기` }).click()
    await expect(page.getByRole('dialog', { name: `${oldShirt.name} 상세` })).toBeVisible()
  })
}

test('검색 중에는 숨기고 조회 실패 후에는 다시 불러올 수 있다', async ({ page, mockApi }) => {
  mockApi.rediscoveryItems = [{ item: mockApi.wardrobeItems[0], reason: 'no_wear_record', daysSinceLastWorn: null }]
  let failRediscovery = true
  await page.route('**/graphql', async (route) => {
    if (route.request().postDataJSON().query.includes('query WardrobeRediscovery') && failRediscovery) {
      await route.fulfill({ json: { errors: [{ message: '일시적인 테스트 오류' }] } })
    } else await route.fallback()
  })
  await page.goto('/closet')
  await page.getByRole('button', { name: '잊고 있던 옷 확인하기', exact: true }).click()
  const section = page.getByRole('region', { name: '잊고 있던 옷', exact: true })
  await expect(section.getByRole('button', { name: '다시 시도' })).toBeVisible()
  failRediscovery = false
  await section.getByRole('button', { name: '다시 시도' }).click()
  await expect(section.getByRole('button', { name: '테스트 셔츠 다시 보기' })).toBeVisible()
  await page.getByRole('button', { name: '옷장 검색', exact: true }).click()
  await page.getByRole('searchbox', { name: '옷장 검색어' }).fill('셔츠')
  await expect(section).toHaveCount(0)
})

test('하이라이트는 사용권 없이 볼 수 있고 코디 추천은 기존 사용권 확인을 거친다', async ({ page, mockApi }) => {
  mockApi.rediscoveryItems = [{ item: mockApi.wardrobeItems[0], reason: 'no_wear_record', daysSinceLastWorn: null }]
  let recommendationCalls = 0
  await page.route('**/graphql', async (route) => {
    const { query } = route.request().postDataJSON()
    if (query.includes('query PreviewCredits')) {
      await route.fulfill({ json: { data: { previewCredits: {
        freeRemaining: 0, rewardRemaining: 0, totalRemaining: 0, capacity: 5,
        nextRefillAt: new Date(Date.now() + 3_600_000).toISOString(), serverNow: new Date().toISOString(),
        rewardMode: 'test', pendingRewardSessionId: null, resetsAt: new Date(Date.now() + 86_400_000).toISOString(), adRewardsRemaining: null,
      } } } })
    } else if (query.includes('query TodayOutfitRecommendation')) {
      recommendationCalls += 1
      await route.fulfill({ json: { errors: [{ message: '추천이 실행되면 안 됩니다.' }] } })
    } else await route.fallback()
  })
  await page.goto('/closet')
  await page.getByRole('button', { name: '잊고 있던 옷 확인하기', exact: true }).click()
  await page.getByRole('button', { name: '테스트 셔츠 코디 추천' }).click()
  const sheet = page.getByRole('dialog', { name: '이 옷으로 AI 코디 추천' })
  await sheet.getByRole('button', { name: '봄', exact: true }).click()
  await sheet.getByRole('button', { name: /자동/ }).click()
  await expect(page.getByRole('dialog', { name: 'AI 사용권이 부족해요', exact: true })).toBeVisible()
  expect(recommendationCalls).toBe(0)
})
