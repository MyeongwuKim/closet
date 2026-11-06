import { mkdirSync, readFileSync } from 'node:fs'
import { test, expect } from './support/fixture'
import type { ClosetNativeBridge } from '../apps/web/src/native-bridge/types'

const imageUrl = `data:image/png;base64,${readFileSync('tests/support/mock-shirt.png').toString('base64')}`
const walletFields = () => ({ capacity: 5, nextRefillAt: new Date(Date.now() + 60 * 60_000).toISOString(), serverNow: new Date().toISOString() })
const session = { id: 'reward-session-test', mode: 'test', adUnitId: 'test-ad-unit', status: 'pending', watchedAt: null, validUntil: new Date(Date.now() + 30 * 60_000).toISOString() }

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px: 무료 소진 후 네이티브 광고 보상을 확인하고 같은 생성 요청을 재개한다`, async ({ page, mockApi }) => {
    await page.setViewportSize(viewport)
    let rewarded = false
    let consumed = false
    let startCalls = 0
    let adCalls = 0
    let previewJob: Record<string, unknown> | null = null
    await page.exposeFunction('earnTestPreviewReward', () => { rewarded = true; adCalls += 1 })
    await page.addInitScript(() => {
      window.ClosetRuntimeConfig = { isNativeWebView: true }
      window.ClosetNative = {
        getAppInfo: async () => ({ capabilities: ['rewarded-ad'], platform: 'ios' }),
        showRewardedAd: async (sessionId: string) => {
          await (window as unknown as { earnTestPreviewReward: () => Promise<void> }).earnTestPreviewReward()
          return { status: 'earned', sessionId }
        },
      } as unknown as ClosetNativeBridge
    })
    const requestIds: string[] = []
    await page.route('**/graphql', async (route) => {
      const { query, variables } = route.request().postDataJSON()
      let data: unknown
      if (query.includes('query PreviewCredits')) data = { previewCredits: { freeRemaining: 0, rewardRemaining: rewarded && !consumed ? 1 : 0, totalRemaining: rewarded && !consumed ? 1 : 0, ...walletFields(), adRewardsRemaining: null, rewardMode: 'test', resetsAt: new Date(Date.now() + 86_400_000).toISOString(), pendingRewardSessionId: null } }
      else if (query.includes('mutation StartPreviewReward')) data = { startPreviewReward: session }
      else if (query.includes('query PreviewRewardSession')) data = { previewRewardSession: { ...session, status: rewarded ? 'granted' : 'pending' } }
      else if (query.includes('mutation StartOutfitPreview')) {
        startCalls += 1
        requestIds.push(variables.input.requestId)
        if (!rewarded) {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ errors: [{ message: '생성권을 모두 사용했어요.', extensions: { code: 'PREVIEW_CREDITS_EXHAUSTED' } }] }) })
          return
        }
        consumed = true
        previewJob = { id: 'preview-credit-job', status: 'completed', selectedItemIds: ['item-1', 'item-2'], style: null, imageAssetId: 'rewarded-image', model: 'fixture', errorCode: null, errorMessage: null, createdAt: new Date().toISOString(), path: '/lookbook/new?items=item-1,item-2&preview=open&previewAssetId=rewarded-image' }
        data = { startOutfitPreview: previewJob }
      } else if (query.includes('query OutfitPreviewJob(')) {
        expect(variables.id).toBe('preview-credit-job')
        data = { outfitPreviewJob: previewJob }
      } else if (query.includes('query OutfitPreviewAsset')) data = { outfitPreviewAsset: { assetId: 'rewarded-image', imageUrl, mimeType: 'image/png', model: 'fixture' } }
      else { await route.fallback(); return }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })
    })
    await page.goto('/#/lookbook/new?items=item-1,item-2')
    await page.getByRole('button', { name: '광고 보고 충전', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'AI 사용권이 부족해요', exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: /광고 보고.*즉시 받기/ })).toBeEnabled()
    mkdirSync('.playwright-mcp', { recursive: true })
    await page.screenshot({ path: `.playwright-mcp/preview-credits-${viewport.width}.png`, animations: 'disabled' })
    await dialog.getByRole('button', { name: /광고 보고.*즉시 받기/ }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'AI 착장 이미지 만들기', exact: true })).toBeEnabled()
    expect(startCalls).toBe(0)
    await page.getByRole('button', { name: 'AI 착장 이미지 만들기', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'AI 룩 미리보기', exact: true })).toBeVisible()
    await expect(page.getByAltText('선택한 옷으로 생성한 AI 룩 미리보기')).toHaveAttribute('src', imageUrl)
    expect(startCalls).toBe(1)
    expect(requestIds).toHaveLength(1)
    expect(adCalls).toBe(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(mockApi.operations).not.toContain('GenerateOutfitPreview')
  })
}

test('광고를 중간에 닫으면 생성 요청을 추가 전송하지 않는다', async ({ page, mockApi }) => {
  let startCalls = 0
  await page.addInitScript(() => {
    window.ClosetRuntimeConfig = { isNativeWebView: true }
    window.ClosetNative = { getAppInfo: async () => ({ capabilities: ['rewarded-ad'] }), showRewardedAd: async (sessionId: string) => ({ status: 'cancelled', sessionId }) } as unknown as ClosetNativeBridge
  })
  await page.route('**/graphql', async (route) => {
    const { query } = route.request().postDataJSON()
    let payload: unknown
    if (query.includes('query PreviewCredits')) payload = { data: { previewCredits: { freeRemaining: 0, rewardRemaining: 0, totalRemaining: 0, ...walletFields(), adRewardsRemaining: null, rewardMode: 'test', resetsAt: new Date(Date.now() + 86_400_000).toISOString(), pendingRewardSessionId: null } } }
    else if (query.includes('mutation StartPreviewReward')) payload = { data: { startPreviewReward: session } }
    else if (query.includes('mutation StartOutfitPreview')) { startCalls += 1; payload = { errors: [{ message: '생성권 소진', extensions: { code: 'PREVIEW_CREDITS_EXHAUSTED' } }] } }
    else { await route.fallback(); return }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) })
  })
  await page.goto('/#/lookbook/new?items=item-1,item-2')
  await page.getByRole('button', { name: '광고 보고 충전', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'AI 사용권이 부족해요', exact: true })
  await dialog.getByRole('button', { name: /광고 보고.*즉시 받기/ }).click()
  await expect(dialog.getByRole('alert')).toContainText('광고 시청을 취소했어요')
  await dialog.getByRole('button', { name: 'AI 사용권 안내 닫기' }).click()
  expect(startCalls).toBe(0)
  expect(mockApi.operations).not.toContain('GenerateOutfitPreview')
})

test('일반 브라우저에서는 광고 보상을 네이티브 앱에서 이용하도록 안내한다', async ({ page, mockApi }) => {
  await page.route('**/graphql', async (route) => {
    const { query } = route.request().postDataJSON()
    if (!query.includes('query PreviewCredits')) { await route.fallback(); return }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { previewCredits: { freeRemaining: 0, rewardRemaining: 0, totalRemaining: 0, ...walletFields(), adRewardsRemaining: null, rewardMode: 'test', resetsAt: new Date(Date.now() + 86_400_000).toISOString(), pendingRewardSessionId: null } } }) })
  })
  await page.goto('/lookbook/new?items=item-1,item-2')
  await page.getByRole('button', { name: 'AI 사용권 안내', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'AI 사용권 안내', exact: true })
  await expect(dialog.getByRole('button', { name: /광고 보고.*즉시 받기/ })).toBeDisabled()
  await expect(dialog.getByText('광고 보상은 광고 기능이 포함된 iOS 앱에서 이용할 수 있어요.')).toBeVisible()
  expect(mockApi.operations).not.toContain('StartPreviewReward')
})
