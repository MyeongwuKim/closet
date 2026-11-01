import { mkdirSync } from 'node:fs'
import { test, expect } from './support/fixture'
import type { ClosetNativeBridge } from '../apps/web/src/native-bridge/types'

const walletFields = (remaining = 0) => ({ capacity: 5, nextRefillAt: remaining >= 5 ? null : new Date(Date.now() + 60 * 60_000).toISOString(), serverNow: new Date().toISOString() })

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px: 추천 무료 5회 소진 후 광고로 1회 추가하고 재추천한다`, async ({ page, mockApi }) => {
    await page.setViewportSize(viewport)
    let free = 5
    let rewards = 0
    let granted = 0
    let adCalls = 0
    const requests: unknown[] = []
    const completed = new Map<string, unknown>()
    const session = { id: 'recommendation-ad', mode: 'test', adUnitId: 'test', status: 'pending', watchedAt: null, validUntil: new Date(Date.now() + 600_000).toISOString() }
    await page.exposeFunction('earnRecommendationReward', () => { rewards++; granted++; adCalls++ })
    await page.addInitScript(() => {
      window.ClosetRuntimeConfig = { isNativeWebView: true }
      window.ClosetNative = {
        getAppInfo: async () => ({ capabilities: ['rewarded-ad'], platform: 'ios' }),
        showRewardedAd: async (sessionId: string) => {
          await (window as unknown as { earnRecommendationReward: () => Promise<void> }).earnRecommendationReward()
          return { status: 'earned', sessionId }
        },
      } as unknown as ClosetNativeBridge
    })
    await page.route('**/graphql', async (route) => {
      const { query, variables } = route.request().postDataJSON()
      let data: unknown
      if (query.includes('query PreviewCredits') && variables.kind === 'recommendation') {
        data = { previewCredits: { freeRemaining: free, rewardRemaining: rewards, totalRemaining: free + rewards, ...walletFields(free + rewards), adRewardsRemaining: null, rewardMode: 'test', resetsAt: new Date(Date.now() + 86_400_000).toISOString(), pendingRewardSessionId: null } }
      } else if (query.includes('query TodayOutfitRecommendation')) {
        const key = JSON.stringify(variables.input)
        if (completed.has(key)) { await route.fulfill({ json: { data: completed.get(key) } }); return }
        requests.push(variables.input)
        if (free + rewards === 0) {
          await route.fulfill({ json: { errors: [{ message: '오늘의 추천 횟수를 모두 사용했어요.', extensions: { code: 'RECOMMENDATION_CREDITS_EXHAUSTED' } }] } })
          return
        }
        if (free > 0) free--; else rewards--
        data = { todayOutfitRecommendation: { date: variables.input.date, season: variables.input.season, ready: true, combinationCount: 30, headline: `추천 코디 ${5 - free + granted}`, summary: '보유한 옷으로 고른 코디예요.', style: null, items: mockApi.wardrobeItems, reasons: ['색감을 맞췄어요.'], profileSummary: [], model: 'fixture', source: 'ai', colorSchemeApplied: true, weather: null } }
        completed.set(key, data)
      } else if (query.includes('mutation StartPreviewReward')) {
        expect(variables.kind).toBe('recommendation')
        data = { startPreviewReward: session }
      } else if (query.includes('query PreviewRewardSession')) data = { previewRewardSession: { ...session, status: granted > 0 ? 'granted' : 'pending' } }
      else { await route.fallback(); return }
      await route.fulfill({ json: { data } })
    })
    await page.goto('/#/plan')
    await page.getByRole('button', { name: 'AI 코디 추천', exact: true }).click()
    const sheet = page.getByRole('dialog', { name: '오늘의 AI 코디 추천' })
    await sheet.getByRole('button', { name: '추천받기', exact: true }).click()
    await sheet.getByRole('button', { name: '봄', exact: true }).click()
    await sheet.getByRole('button', { name: /자동/ }).click()
    await expect(sheet.getByText('추천 코디 1', { exact: true })).toBeVisible()
    for (let index = 2; index <= 5; index++) {
      await sheet.getByRole('button', { name: /^(다른 추천|광고 보고 다른 추천)$/ }).click()
      await expect(sheet.getByText(`추천 코디 ${index}`, { exact: true })).toBeVisible()
    }
    await expect(sheet.getByText('AI 사용권 0/5', { exact: true })).toBeVisible()
    mkdirSync('.playwright-mcp', { recursive: true })
    await page.screenshot({ path: `.playwright-mcp/recommendation-balance-${viewport.width}.png`, animations: 'disabled' })
    for (let round = 1; round <= 3; round++) {
      await sheet.getByRole('button', { name: '광고 보고 사용권 얻기', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'AI 사용권이 부족해요', exact: true })
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('button', { name: /기다리기/ })).toBeVisible()
      expect(requests).toHaveLength(4 + round)
      if (round === 1) await page.screenshot({ path: `.playwright-mcp/recommendation-reward-${viewport.width}.png`, animations: 'disabled' })
      await dialog.getByRole('button', { name: /광고 보고.*즉시 받기/ }).click()
      await expect(dialog).toHaveCount(0)
      await expect(sheet.getByText('AI 사용권 1/5', { exact: true })).toBeVisible()
      await expect(sheet.getByRole('button', { name: '다른 추천', exact: true })).toBeEnabled()
      expect(adCalls).toBe(round)
      expect(requests).toHaveLength(4 + round)
      if (round === 1) await page.screenshot({ path: `.playwright-mcp/recommendation-ready-${viewport.width}.png`, animations: 'disabled' })
      await sheet.getByRole('button', { name: '다른 추천', exact: true }).click()
      await expect(sheet.getByText(`추천 코디 ${5 + round}`, { exact: true })).toBeVisible()
    }
    expect(free).toBe(0)
    expect(rewards).toBe(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

  })
}

test('추천 광고를 취소하면 추천을 재전송하지 않는다', async ({ page, mockApi }) => {
  let recommendationCalls = 0
  let adCalls = 0
  await page.exposeFunction('cancelRecommendationReward', () => { adCalls++ })
  await page.addInitScript(() => {
    window.ClosetRuntimeConfig = { isNativeWebView: true }
    window.ClosetNative = {
      getAppInfo: async () => ({ capabilities: ['rewarded-ad'], platform: 'ios' }),
      showRewardedAd: async (sessionId: string) => {
        await (window as unknown as { cancelRecommendationReward: () => Promise<void> }).cancelRecommendationReward()
        return { status: 'cancelled', sessionId }
      },
    } as unknown as ClosetNativeBridge
  })
  await page.route('**/graphql', async (route) => {
    const { query } = route.request().postDataJSON()
    if (query.includes('query TodayOutfitRecommendation')) {
      recommendationCalls++
      await route.fulfill({ json: { errors: [{ message: '추천권을 모두 사용했어요.', extensions: { code: 'RECOMMENDATION_CREDITS_EXHAUSTED' } }] } })
    } else if (query.includes('query PreviewCredits')) {
      await route.fulfill({ json: { data: { previewCredits: { freeRemaining: 0, rewardRemaining: 0, totalRemaining: 0, ...walletFields(), adRewardsRemaining: null, rewardMode: 'test', resetsAt: new Date(Date.now() + 86_400_000).toISOString(), pendingRewardSessionId: null } } } })
    } else if (query.includes('mutation StartPreviewReward')) {
      await route.fulfill({ json: { data: { startPreviewReward: { id: 'cancel-recommendation', mode: 'test', adUnitId: 'test', status: 'pending', watchedAt: null, validUntil: new Date(Date.now() + 600_000).toISOString() } } } })
    } else await route.fallback()
  })
  await page.goto('/#/plan')
  await page.getByRole('button', { name: 'AI 코디 추천', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: '오늘의 AI 코디 추천' })
  await sheet.getByRole('button', { name: '광고 보고 사용권 얻기', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'AI 사용권이 부족해요', exact: true })
  await expect(dialog).toBeVisible()
  const callsBeforeAd = recommendationCalls
  expect(callsBeforeAd).toBe(0)
  await dialog.getByRole('button', { name: /광고 보고.*즉시 받기/ }).click()
  await expect(dialog.getByRole('alert')).toContainText('광고 시청을 취소했어요')
  await dialog.getByRole('button', { name: /기다리기/ }).click()
  await expect(sheet.getByRole('button', { name: '광고 보고 사용권 얻기', exact: true })).toBeEnabled()
  expect(adCalls).toBe(1)
  expect(mockApi.operations).not.toContain('StartOutfitPreview')
  expect(recommendationCalls).toBe(callsBeforeAd)
})

test('일반 브라우저의 추천권 안내에서는 광고를 실행하지 않는다', async ({ page, mockApi }) => {
  await page.route('**/graphql', async (route) => {
    const { query } = route.request().postDataJSON()
    if (query.includes('query TodayOutfitRecommendation')) {
      await route.fulfill({ json: { errors: [{ message: '추천권을 모두 사용했어요.', extensions: { code: 'RECOMMENDATION_CREDITS_EXHAUSTED' } }] } })
    } else if (query.includes('query PreviewCredits')) {
      await route.fulfill({ json: { data: { previewCredits: { freeRemaining: 0, rewardRemaining: 0, totalRemaining: 0, ...walletFields(), adRewardsRemaining: null, rewardMode: 'test', resetsAt: new Date(Date.now() + 86_400_000).toISOString(), pendingRewardSessionId: null } } } })
    } else await route.fallback()
  })
  await page.goto('/plan')
  await page.getByRole('button', { name: 'AI 코디 추천', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: '오늘의 AI 코디 추천' })
  await sheet.getByRole('button', { name: '광고 보고 사용권 얻기', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'AI 사용권이 부족해요', exact: true })
  await expect(dialog.getByRole('button', { name: /광고 보고.*즉시 받기/ })).toBeDisabled()
  await expect(dialog.getByText('광고 보상은 광고 기능이 포함된 iOS 앱에서 이용할 수 있어요.')).toBeVisible()
  expect(mockApi.operations).not.toContain('StartPreviewReward')
})

test('충전 대기 시간과 광고 즉시 지급을 선택하고 보상 후 같은 화면의 추천받기 버튼으로 돌아온다', async ({ page, mockApi }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.install()
  let granted = false
  let adCalls = 0
  let recommendationCalls = 0
  await page.exposeFunction('watchDelayedRewardAd', () => { adCalls++ })
  await page.addInitScript(() => {
    window.ClosetRuntimeConfig = { isNativeWebView: true }
    window.ClosetNative = {
      getAppInfo: async () => ({ platform: 'ios', capabilities: ['rewarded-ad'] }),
      showRewardedAd: async (sessionId: string) => {
        await (window as unknown as { watchDelayedRewardAd: () => Promise<void> }).watchDelayedRewardAd()
        return { status: 'earned', sessionId }
      },
    } as unknown as ClosetNativeBridge
  })
  const session = { id: 'delayed-credit', mode: 'test', adUnitId: 'test', status: 'pending', watchedAt: null, validUntil: new Date(Date.now() + 600_000).toISOString() }
  await page.route('**/graphql', async (route) => {
    const { query } = route.request().postDataJSON()
    let data: unknown
    if (query.includes('query PreviewCredits')) data = { previewCredits: { freeRemaining: granted ? 1 : 0, rewardRemaining: 0, totalRemaining: granted ? 1 : 0, ...walletFields(granted ? 1 : 0), adRewardsRemaining: null, rewardMode: 'test', resetsAt: new Date(Date.now() + 86_400_000).toISOString(), pendingRewardSessionId: null } }
    else if (query.includes('mutation StartPreviewReward')) data = { startPreviewReward: session }
    else if (query.includes('query PreviewRewardSession')) data = { previewRewardSession: { ...session, status: granted ? 'granted' : 'pending' } }
    else if (query.includes('query TodayOutfitRecommendation')) { recommendationCalls++; await route.fallback(); return }
    else { await route.fallback(); return }
    await route.fulfill({ json: { data } })
  })
  await page.goto('/#/plan')
  await page.getByRole('button', { name: 'AI 코디 추천', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: '오늘의 AI 코디 추천', exact: true })
  await sheet.getByRole('button', { name: '광고 보고 사용권 얻기', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'AI 사용권이 부족해요', exact: true })
  const wait = dialog.getByRole('button', { name: /기다리기/ })
  await expect(wait).toBeVisible()
  const before = await wait.innerText()
  await page.clock.fastForward(30_000)
  await expect(wait).not.toHaveText(before)
  await wait.click()
  await expect(dialog).toHaveCount(0)
  expect(adCalls).toBe(0)
  expect(recommendationCalls).toBe(0)
  await sheet.getByRole('button', { name: '광고 보고 사용권 얻기', exact: true }).click()
  mkdirSync('.playwright-mcp', { recursive: true })
  await page.screenshot({ path: '.playwright-mcp/ai-credit-wait-or-ad.png', animations: 'disabled' })
  await dialog.getByRole('button', { name: /광고 보고.*즉시 받기/ }).click()
  await expect.poll(() => adCalls).toBe(1)
  await expect(dialog.getByRole('button', { name: '보상 확인 중…', exact: true })).toBeDisabled()
  expect(recommendationCalls).toBe(0)
  granted = true
  await page.clock.fastForward(1500)
  await expect(dialog).toHaveCount(0)
  await expect(sheet.getByRole('button', { name: '추천받기', exact: true })).toBeEnabled()
  await expect(sheet.getByText('AI 사용권 1/5', { exact: true })).toBeVisible()
  await expect(sheet.getByRole('heading', { name: '오늘 입을 코디를 골라드릴까요?', exact: true })).toBeVisible()
  expect(recommendationCalls).toBe(0)
  await page.screenshot({ path: '.playwright-mcp/ai-credit-recommendation-ready.png', animations: 'disabled' })
  await sheet.getByRole('button', { name: '추천받기', exact: true }).click()
  await expect(sheet.getByRole('button', { name: '봄', exact: true })).toBeVisible()
  expect(mockApi.operations).not.toContain('StartOutfitPreview')
})
