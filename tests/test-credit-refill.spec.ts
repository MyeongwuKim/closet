import { test, expect } from './support/fixture'

function wallet(remaining: number, enabled = true) {
  return { freeRemaining: remaining, rewardRemaining: 0, totalRemaining: remaining, capacity: 5, nextRefillAt: remaining === 5 ? null : new Date(Date.now() + 3600_000).toISOString(), serverNow: new Date().toISOString(), adRewardsRemaining: null, rewardMode: 'test', resetsAt: new Date(Date.now() + 86400_000).toISOString(), pendingRewardSessionId: null, testRefillAvailable: enabled }
}

for (const viewport of [{ width: 320, height: 668 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px: 상단 테스트 충전은 5개로 채우고 AI 요청 없이 공통 잔액을 갱신한다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize(viewport)
    let remaining = 0
    let refillCalls = 0
    let recommendationReads = 0
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => { release = resolve })
    await page.route('**/graphql', async (route) => {
      const { query, variables } = route.request().postDataJSON()
      if (query.includes('query PreviewCredits')) {
        if (variables.kind === 'recommendation') recommendationReads++
        await route.fulfill({ json: { data: { previewCredits: wallet(remaining) } } })
      } else if (query.includes('mutation RefillTestAiCredits')) {
        refillCalls++
        await gate
        remaining = 5
        await route.fulfill({ json: { data: { refillTestAiCredits: wallet(5) } } })
      } else await route.fallback()
    })
    try {
      await page.goto('/lookbook')
      const refill = page.getByRole('button', { name: '테스트용 AI 사용권 5개 충전' })
      await expect(refill).toBeVisible()
      await expect(page.getByRole('button', { name: `${mockApi.outfits[0].name} 코디 상세 보기` })).toBeVisible()
      await testInfo.attach(`test-refill-header-${viewport.width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await refill.click()
      await expect(refill).toBeDisabled()
      release()
      await expect(page.getByText('AI 사용권을 5개로 충전했어요.', { exact: true })).toBeVisible()
      await expect(refill).toBeEnabled()
      expect(refillCalls).toBe(1)
      await page.getByRole('button', { name: 'AI 코디 추천', exact: true }).click()
      const recommendation = page.getByRole('dialog', { name: '오늘의 AI 코디 추천' })
      await expect(recommendation.getByText('AI 사용권 5/5', { exact: true })).toBeVisible()
      await expect(recommendation.getByRole('button', { name: '오늘 날씨로 바로 추천', exact: true })).toBeEnabled()
      expect(recommendationReads).toBe(0)
      expect(mockApi.operations).not.toContain('TodayOutfitRecommendation')
      expect(mockApi.operations).not.toContain('StartOutfitPreview')
    } finally { release() }
  })
}

test('서버가 테스트 충전을 허용하지 않으면 상단 버튼을 표시하지 않는다', async ({ page, mockApi }) => {
  await page.route('**/graphql', async (route) => {
    const { query } = route.request().postDataJSON()
    if (query.includes('query PreviewCredits')) await route.fulfill({ json: { data: { previewCredits: wallet(0, false) } } })
    else await route.fallback()
  })
  await page.goto('/lookbook')
  await expect(page.getByRole('button', { name: `${mockApi.outfits[0].name} 코디 상세 보기` })).toBeVisible()
  await expect(page.getByRole('button', { name: '테스트용 AI 사용권 5개 충전' })).toHaveCount(0)
})

test('충전 실패는 잔액을 바꾸지 않고 오류를 알린다', async ({ page, mockApi }) => {
  await page.route('**/graphql', async (route) => {
    const { query } = route.request().postDataJSON()
    if (query.includes('query PreviewCredits')) await route.fulfill({ json: { data: { previewCredits: wallet(0) } } })
    else if (query.includes('mutation RefillTestAiCredits')) await route.fulfill({ json: { errors: [{ message: '테스트 충전 오류' }] } })
    else await route.fallback()
  })
  await page.goto('/lookbook')
  await page.getByRole('button', { name: '테스트용 AI 사용권 5개 충전' }).click()
  await expect(page.getByText('테스트 충전 오류', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '테스트용 AI 사용권 5개 충전' })).toBeEnabled()
  await page.getByRole('button', { name: 'AI 코디 추천', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '오늘의 AI 코디 추천' }).getByText('AI 사용권 0/5', { exact: true })).toBeVisible()
  expect(mockApi.operations).not.toContain('StartOutfitPreview')
})
