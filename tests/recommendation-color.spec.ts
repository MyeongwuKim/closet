import { expect, test } from './support/fixture'

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

for (const viewport of [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'iphone-12-pro-max', width: 428, height: 926 },
  { name: 'desktop', width: 1440, height: 900 },
]) {
  test(`${viewport.name}: 계절 다음 색감을 고르고 다른 색감으로 다시 추천받는다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })

    const browserErrors: string[] = []
    page.on('pageerror', (error) => browserErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text())
    })
    page.on('requestfailed', (request) => {
      const errorText = request.failure()?.errorText
      if (request.url().includes('/graphql') && errorText !== 'net::ERR_ABORTED') {
        browserErrors.push(`${request.url()}: ${errorText}`)
      }
    })

    const receivedSchemes: ColorScheme[] = []
    let releaseAccent: (() => void) | undefined
    const accentGate = new Promise<void>((resolve) => {
      releaseAccent = resolve
    })

    // 추천 요청만 가로채고 계정·플래너 조회는 기존 E2E fixture에 맡긴다.
    await page.route('**/graphql', async (route) => {
      const request = route.request().postDataJSON() as RecommendationRequest
      if (!request.query.includes('query TodayOutfitRecommendation')) {
        await route.fallback()
        return
      }

      const input = request.variables?.input
      expect(input).toBeDefined()
      expect(input?.season).toBe('spring')
      const colorScheme = input?.colorScheme
      expect(colorScheme).toBeDefined()
      receivedSchemes.push(colorScheme!)
      mockApi.operations.push('TodayOutfitRecommendation')

      if (colorScheme === 'accent') await accentGate

      const label = colorScheme === 'tone-on-tone' ? '톤온톤' : '포인트'
      const isAccent = colorScheme === 'accent'
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({
          data: {
            todayOutfitRecommendation: {
              date: input!.date,
              season: input!.season,
              ready: true,
              headline: isAccent
                ? '포인트 추천 조합, 오늘 입기 좋은 옷을 함께 골랐어요'
                : `${label} 추천 조합`,
              summary: isAccent
                ? '오늘의 계절에 맞는 옷과 실루엣을 살펴봤어요. 차분한 옷을 중심으로 함께 입기 좋은 조합을 고르고, 색의 밝기와 선명함도 확인했어요.'
                : `${label} 색감으로 고른 조합이에요.`,
              style: null,
              colorScheme,
              colorSchemeApplied: colorScheme !== 'accent',
              items: mockApi.wardrobeItems,
              reasons: [`${label} 색 조합을 비교했어요.`],
              profileSummary: [],
              model: 'e2e-mock',
              source: 'fallback',
              weather: null,
            },
          },
        }),
      })
    })

    try {
      await page.goto('/plan')
      await page.getByRole('button', { name: 'AI 코디 추천', exact: true }).click()
      const sheet = page.getByRole('dialog', { name: '오늘의 AI 코디 추천' })
      await expect(sheet).toBeVisible()
      await sheet.getByRole('button', { name: '추천받기' }).click()
      const seasonHeight = await sheet.evaluate((element) => element.getBoundingClientRect().height)
      await testInfo.attach(`${viewport.name}-season-options`, {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      })
      await sheet.getByRole('button', { name: '봄', exact: true }).click()

      const colorHeight = await sheet.evaluate((element) => element.getBoundingClientRect().height)
      expect(Math.abs(colorHeight - seasonHeight)).toBeLessThan(1)

      await expect(sheet.getByRole('button', { name: /자동/ })).toBeVisible()
      await expect(sheet.getByRole('button', { name: /톤온톤/ })).toBeVisible()
      await expect(sheet.getByRole('button', { name: /톤인톤/ })).toBeVisible()
      await expect(sheet.getByRole('button', { name: /무채색/ })).toBeVisible()
      await expect(sheet.getByRole('button', { name: /포인트/ })).toBeVisible()
      await testInfo.attach(`${viewport.name}-color-options`, {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      })

      await sheet.getByRole('button', { name: '계절 다시 선택' }).click()
      await expect(sheet.getByRole('button', { name: '봄', exact: true })).toBeVisible()
      await sheet.getByRole('button', { name: '봄', exact: true }).click()
      await sheet.getByRole('button', { name: /톤온톤/ }).click()
      await expect(sheet.getByText('톤온톤 추천 조합')).toBeVisible()
      expect(new Set(receivedSchemes)).toEqual(new Set(['tone-on-tone']))

      await sheet.getByRole('button', { name: /뒤로가기/ }).click()
      await expect(sheet.getByRole('button', { name: /포인트/ })).toBeVisible()
      await sheet.getByRole('button', { name: /포인트/ }).click()
      await expect.poll(() => receivedSchemes.includes('accent')).toBe(true)
      await expect(sheet.getByText('톤온톤 추천 조합')).toHaveCount(0)

      releaseAccent?.()
      await expect(sheet.getByText(/포인트 추천 조합/)).toBeVisible()
      await expect(sheet.getByText('봄 · 기본 추천')).toBeVisible()
      await expect(sheet.getByRole('status').getByText('포인트 조합을 찾지 못했어요')).toBeVisible()
      await expect(sheet.getByRole('status').getByText('이번에는 기본 추천을 보여드려요.')).toBeVisible()
      await expect(sheet.getByText('봄 · 기본 추천')).toBeInViewport({ ratio: 1 })
      await expect(sheet.getByRole('status')).toBeInViewport({ ratio: 1 })
      await expect(sheet.getByRole('button', { name: '다른 추천' })).toBeInViewport({ ratio: 0.95 })
      await expect(sheet.getByRole('button', { name: '오늘 일정에 담기' })).toBeInViewport({ ratio: 0.95 })
      const resultHeight = await sheet.evaluate((element) => element.getBoundingClientRect().height)
      expect(Math.abs(resultHeight - seasonHeight)).toBeLessThan(1)
      await testInfo.attach(`${viewport.name}-accent-result`, {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      })
      await sheet.getByRole('button', { name: '설명 전체 보기' }).click()
      const explanation = page.getByRole('dialog', { name: '이 조합을 추천한 이유' })
      await expect(explanation.getByText('봄 · 기본 추천')).toBeVisible()
      await expect(explanation.getByRole('status').getByText('포인트 조합을 찾지 못했어요')).toBeVisible()
      await explanation.getByRole('button', { name: '추천 설명 닫기' }).click()

      expect(mockApi.operations).not.toContain('SetDirectPlannerEntry')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      expect(browserErrors).toEqual([])
    } finally {
      releaseAccent?.()
    }
  })
}
