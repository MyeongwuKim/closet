import type { Page } from '@playwright/test'
import type { OutfitPreviewJob } from '../packages/types/src/index'
import { readFileSync } from 'node:fs'
import { createOutfit, createWardrobeItem, expect, test, type MockApi } from './support/fixture'

const date = '2026-11-02'
const imageUrl = `data:image/png;base64,${readFileSync('tests/support/mock-shirt.png').toString('base64')}`

function plannerEntry(plannerOnly = false, selectedIds = ['item-1', 'item-2'], entryDate = date) {
  const outfit = createOutfit({ id: entryDate === date ? '507f1f77bcf86cd799439011' : '507f1f77bcf86cd799439012', name: '진행 확인 코디' })
  return {
    date: entryDate, title: outfit.name, occasion: null, weatherSummary: null, temperatureC: null, wornAt: null,
    outfit: { id: outfit.id, name: outfit.name, style: outfit.style, plannerOnly, items: selectedIds.map((wardrobeItemId) => ({ wardrobeItemId })), generations: [] },
  }
}

/** 이미지·계정·광고는 호출하지 않고 서버 작업 상태와 요청 횟수만 테스트 응답으로 제어한다. */
async function installPreviewJobs(page: Page, mockApi: MockApi) {
  mockApi.previewImages['planner-preview-asset'] = imageUrl
  const createdAt = new Date().toISOString()
  const state = { status: 'processing' as OutfitPreviewJob['status'], previewStyle: 'casual' as string | null, listedStatus: null as OutfitPreviewJob['status'] | null, statusOnStart: null as OutfitPreviewJob['status'] | null, acknowledged: false, assetErrorCode: null as string | null, credits: 5, started: false, startCalls: 0, assetCalls: 0, requestIds: [] as string[], savedAssets: [] as string[] }
  const job = (): OutfitPreviewJob => ({
    id: `planner-preview-job-${state.startCalls}`, status: state.status, selectedItemIds: ['item-1', 'item-2'], style: state.previewStyle,
    imageAssetId: state.status === 'completed' ? 'planner-preview-asset' : null,
    model: state.status === 'completed' ? 'fixture-model' : null,
    errorCode: state.status === 'failed' ? 'AI_FAILED' : null,
    errorMessage: state.status === 'failed' ? '테스트 이미지 생성 실패' : null,
    createdAt,
    path: '/lookbook/new?items=item-1,item-2&preview=open&previewAssetId=planner-preview-asset',
  })
  await page.route('**/graphql', async (route) => {
    const { query, variables = {} } = route.request().postDataJSON()
    let data: unknown
    if (query.includes('mutation StartOutfitPreview')) {
      state.started = true
      state.startCalls += 1
      if (state.statusOnStart) state.status = state.statusOnStart
      state.requestIds.push(variables.input.requestId)
      data = { startOutfitPreview: job() }
    } else if (query.includes('query OutfitPreviewJobs')) {
      const status = state.listedStatus ?? state.status
      data = { outfitPreviewJobs: state.started && !state.acknowledged && ['queued', 'processing', 'completed'].includes(status) ? [{ ...job(), status }] : [] }
    } else if (query.includes('query OutfitPreviewForItems')) {
      const matches = [...new Set(variables.selectedItemIds)].sort().join(',') === 'item-1,item-2' && (variables.style?.trim() || null) === state.previewStyle
      const unavailable = state.assetErrorCode && ['OUTFIT_PREVIEW_NOT_FOUND', 'OUTFIT_PREVIEW_EXPIRED'].includes(state.assetErrorCode)
      if (state.assetErrorCode && !unavailable && matches && state.status === 'completed') {
        await route.fulfill({ json: { errors: [{ message: '테스트 이미지 조회 실패', extensions: { code: state.assetErrorCode } }] } })
        return
      }
      data = { outfitPreviewForItems: state.started && state.status === 'completed' && matches && !unavailable ? {
        assetId: 'planner-preview-asset', imageUrl, mimeType: 'image/png', model: 'fixture-model', jobId: job().id, createdAt,
      } : null }
    } else if (query.includes('query OutfitPreviewJob(')) data = { outfitPreviewJob: job() }
    else if (query.includes('query OutfitPreviewAsset')) {
      state.assetCalls += 1
      if (state.assetErrorCode) {
        await route.fulfill({ json: { errors: [{ message: '테스트 이미지 조회 실패', extensions: { code: state.assetErrorCode } }] } })
        return
      }
      data = { outfitPreviewAsset: { assetId: 'planner-preview-asset', imageUrl, mimeType: 'image/png', model: 'fixture-model' } }
    } else if (query.includes('mutation AcknowledgeOutfitPreviewJob')) {
      state.acknowledged = true
      data = { acknowledgeOutfitPreviewJob: true }
    } else if (query.includes('mutation SetDirectPlannerEntry')) {
      expect(Object.keys(variables.input.previewImage).sort()).toEqual(['assetId', 'mimeType', 'model'])
      state.savedAssets.push(variables.input.previewImage.assetId)
      await route.fallback()
      return
    } else if (query.includes('query PreviewCredits')) {
      data = { previewCredits: { freeRemaining: state.credits, rewardRemaining: 0, totalRemaining: state.credits, capacity: 5, nextRefillAt: null, serverNow: new Date().toISOString(), adRewardsRemaining: null, rewardMode: 'test', resetsAt: new Date(Date.now() + 86_400_000).toISOString(), pendingRewardSessionId: null } }
    } else { await route.fallback(); return }
    await route.fulfill({ json: { data } })
  })
  return state
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px: 플래너 룩북 생성 과정과 완료 팝업을 표시하고 기존 저장 흐름으로 연결한다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize(viewport)
    mockApi.plannerEntries = [plannerEntry(true)]
    const state = await installPreviewJobs(page, mockApi)
    await page.goto(`/plan/${date}`)
    await page.getByRole('button', { name: 'AI 착장 이미지 만들기', exact: true }).click()
    const progress = page.getByRole('dialog', { name: 'AI가 룩북을 만들고 있어요', exact: true })
    await expect(progress).toBeVisible()
    await expect(progress).toHaveAttribute('aria-busy', 'true')
    await expect.poll(() => state.startCalls).toBe(1)
    await page.screenshot({ path: testInfo.outputPath(`planner-preview-loading-${viewport.width}.png`), animations: 'disabled' })
    state.status = 'completed'
    const result = page.getByRole('dialog', { name: 'AI 룩 미리보기', exact: true })
    await expect(result).toBeVisible()
    await expect(result.getByRole('img', { name: '선택한 옷으로 생성한 AI 룩 미리보기' })).toBeVisible()
    await result.getByRole('button', { name: '이 날짜에 저장', exact: true }).click()
    await expect(result).toHaveCount(0)
    expect(state.savedAssets).toEqual(['planner-preview-asset'])
    expect(state.startCalls).toBe(1)
    expect(mockApi.operations).not.toContain('GenerateOutfitPreview')
  })
}

test('진행 팝업을 닫고 다시 열거나 완료 이미지를 다시 봐도 새 작업을 접수하지 않는다', async ({ page, mockApi }) => {
  mockApi.plannerEntries = [plannerEntry()]
  const state = await installPreviewJobs(page, mockApi)
  await page.goto(`/plan/${date}`)
  await page.getByRole('button', { name: 'AI 착장 이미지 만들기', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'AI가 룩북을 만들고 있어요', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'AI 룩 미리보기 닫기', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'AI가 룩북을 만들고 있어요', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '생성 과정 보기', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'AI가 룩북을 만들고 있어요', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'AI 룩 미리보기 닫기', exact: true }).click()
  state.status = 'completed'
  await expect.poll(() => state.assetCalls).toBe(1)
  await expect(page.getByRole('dialog', { name: 'AI 룩 미리보기', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'AI 룩북 보기', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'AI 룩 미리보기', exact: true })).toBeVisible()
  expect(state.startCalls).toBe(1)
})

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px: 완료 뒤 화면 복귀·새로고침에서도 AI 룩북 보기로 같은 이미지를 바로 연다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize(viewport)
    mockApi.plannerEntries = [plannerEntry(true)]
    const state = await installPreviewJobs(page, mockApi)
    await page.goto(`/plan/${date}`)
    await page.getByRole('button', { name: 'AI 착장 이미지 만들기', exact: true }).click()
    await expect.poll(() => state.startCalls).toBe(1)
    state.status = 'completed'
    const result = page.getByRole('dialog', { name: 'AI 룩 미리보기', exact: true })
    await expect(result).toBeVisible()
    await page.getByRole('button', { name: 'AI 룩 미리보기 닫기', exact: true }).click()
    // 완료 알림을 이미 확인한 뒤에도 로컬 완료 포인터로 복원해야 한다.
    state.acknowledged = true
    await page.clock.setFixedTime(new Date(Date.now() + 2 * 60 * 60_000))
    await page.goto('/closet')
    await page.goto(`/plan/${date}`)
    const view = page.getByRole('button', { name: 'AI 룩북 보기', exact: true })
    await expect(view).toBeEnabled()
    await expect(result).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath(`completed-preview-button-${viewport.width}.png`), animations: 'disabled' })
    await view.click()
    await expect(result.getByRole('img', { name: '선택한 옷으로 생성한 AI 룩 미리보기' })).toHaveAttribute('src', imageUrl)
    await expect(page.getByRole('dialog', { name: 'AI가 룩북을 만들고 있어요', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'AI 룩 미리보기 닫기', exact: true }).click()
    await page.reload()
    await expect(view).toBeEnabled()
    await view.click()
    await expect(result).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`completed-preview-result-${viewport.width}.png`), animations: 'disabled' })
    await result.getByRole('button', { name: '이 날짜에 저장', exact: true }).click()
    expect(state.savedAssets).toEqual(['planner-preview-asset'])
    expect(state.startCalls).toBe(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('화면 밖에서 생성이 완료되어도 돌아오면 완료 이미지 보기로 전환한다', async ({ page, mockApi }) => {
  mockApi.plannerEntries = [plannerEntry()]
  const state = await installPreviewJobs(page, mockApi)
  await page.goto(`/plan/${date}`)
  await page.getByRole('button', { name: 'AI 착장 이미지 만들기', exact: true }).click()
  await expect.poll(() => state.startCalls).toBe(1)
  await page.goto('/closet')
  state.status = 'completed'
  await page.goto(`/plan/${date}`)
  await page.getByRole('button', { name: 'AI 룩북 보기', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'AI 룩 미리보기', exact: true }).getByRole('img', { name: '선택한 옷으로 생성한 AI 룩 미리보기' })).toHaveAttribute('src', imageUrl)
  expect(state.startCalls).toBe(1)
})

test('서버에만 있는 완료 결과를 복원한 뒤 다른 조합에는 붙이지 않는다', async ({ page, mockApi }) => {
  mockApi.wardrobeItems.push(createWardrobeItem({ id: 'item-3', name: '다른 바지', category: 'bottom' }))
  mockApi.plannerEntries = [plannerEntry(), plannerEntry(false, ['item-1', 'item-3'], '2026-11-03')]
  const state = await installPreviewJobs(page, mockApi)
  state.started = true
  state.status = 'completed'
  await page.goto(`/plan/${date}`)
  await page.getByRole('button', { name: 'AI 룩북 보기', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'AI 룩 미리보기', exact: true })).toBeVisible()
  state.acknowledged = true
  await page.goto('/plan/2026-11-03')
  await expect(page.getByRole('button', { name: 'AI 착장 이미지 만들기', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'AI 룩북 보기', exact: true })).toHaveCount(0)
  await page.goto(`/plan/${date}`)
  await page.getByRole('button', { name: 'AI 룩북 보기', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'AI 룩 미리보기', exact: true })).toBeVisible()
  expect(state.startCalls).toBe(0)
})

test('완료 이미지 조회가 일시 실패하면 같은 보기 버튼으로 재시도하며 새 작업은 만들지 않는다', async ({ page, mockApi }) => {
  mockApi.plannerEntries = [plannerEntry()]
  const state = await installPreviewJobs(page, mockApi)
  state.started = true
  state.status = 'completed'
  await page.goto(`/plan/${date}`)
  const view = page.getByRole('button', { name: 'AI 룩북 보기', exact: true })
  await expect(view).toBeEnabled()
  state.acknowledged = true
  state.assetErrorCode = 'INTERNAL_SERVER_ERROR'
  await page.reload()
  await expect(view).toBeEnabled()
  await view.click()
  await expect(page.getByText('테스트 이미지 조회 실패', { exact: true })).toBeVisible()
  await expect(view).toBeEnabled()
  state.assetErrorCode = null
  await view.click()
  await expect(page.getByRole('dialog', { name: 'AI 룩 미리보기', exact: true })).toBeVisible()
  expect(state.startCalls).toBe(0)
})

test('삭제된 완료 이미지는 복원 기록을 해제하고 자동 재생성하지 않는다', async ({ page, mockApi }) => {
  mockApi.plannerEntries = [plannerEntry()]
  const state = await installPreviewJobs(page, mockApi)
  await page.goto(`/plan/${date}`)
  await page.getByRole('button', { name: 'AI 착장 이미지 만들기', exact: true }).click()
  await expect.poll(() => state.startCalls).toBe(1)
  await page.goto('/closet')
  state.status = 'completed'
  state.acknowledged = true
  state.assetErrorCode = 'OUTFIT_PREVIEW_NOT_FOUND'
  await page.goto(`/plan/${date}`)
  await expect(page.getByRole('button', { name: 'AI 착장 이미지 만들기', exact: true })).toBeEnabled()
  expect(state.startCalls).toBe(1)
})

test('2시간 뒤 로컬 기록과 알림 목록이 없어도 미저장 이미지를 새 생성 없이 찾는다', async ({ page, mockApi }) => {
  mockApi.plannerEntries = [plannerEntry()]
  const state = await installPreviewJobs(page, mockApi)
  await page.goto(`/plan/${date}`)
  await page.getByRole('button', { name: 'AI 착장 이미지 만들기', exact: true }).click()
  await expect.poll(() => state.startCalls).toBe(1)
  state.status = 'completed'
  const result = page.getByRole('dialog', { name: 'AI 룩 미리보기', exact: true })
  await expect(result).toBeVisible()
  await page.getByRole('button', { name: 'AI 룩 미리보기 닫기', exact: true }).click()
  state.acknowledged = true
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('closet:completed-preview:') || key.startsWith('closet:pending-preview:')) localStorage.removeItem(key)
    }
  })
  await page.clock.setFixedTime(new Date(Date.now() + 2 * 60 * 60_000))
  await page.goto('/closet')
  await page.goto(`/plan/${date}`)
  await page.getByRole('button', { name: 'AI 룩북 보기', exact: true }).click()
  await expect(result.getByRole('img', { name: '선택한 옷으로 생성한 AI 룩 미리보기' })).toHaveAttribute('src', imageUrl)
  expect(state.startCalls).toBe(1)
})

test('24시간 뒤 고아 배치가 삭제한 결과는 예전 포인터나 URL 캐시로 다시 표시하지 않는다', async ({ page, mockApi }) => {
  mockApi.plannerEntries = [plannerEntry()]
  const state = await installPreviewJobs(page, mockApi)
  state.started = true
  state.status = 'completed'
  state.acknowledged = true
  await page.goto(`/plan/${date}`)
  const view = page.getByRole('button', { name: 'AI 룩북 보기', exact: true })
  await expect(view).toBeEnabled()
  await view.click()
  await expect(page.getByRole('dialog', { name: 'AI 룩 미리보기', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'AI 룩 미리보기 닫기', exact: true }).click()
  await page.clock.setFixedTime(new Date(Date.now() + 25 * 60 * 60_000))
  state.assetErrorCode = 'OUTFIT_PREVIEW_NOT_FOUND'
  await page.reload()
  await expect(page.getByRole('button', { name: 'AI 착장 이미지 만들기', exact: true })).toBeEnabled()
  await expect(view).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'AI 룩 미리보기', exact: true })).toHaveCount(0)
  expect(state.startCalls).toBe(0)
})

test('새 룩북으로 저장한 뒤 목록·새로고침에서도 교체한 이미지만 표시한다', async ({ page, mockApi }) => {
  const oldImageUrl = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3Crect width="8" height="8" fill="red"/%3E%3C/svg%3E'
  mockApi.outfits[0].generations = [{ status: 'completed', imageAsset: { deliveryUrl: oldImageUrl } }]
  const state = await installPreviewJobs(page, mockApi)
  const savedAssets: string[] = []
  let releaseNotifications!: () => void
  let waitingNotificationLists = 0
  const notificationGate = new Promise<void>((resolve) => { releaseNotifications = resolve })
  await page.route('**/graphql', async (route) => {
    const { query, variables } = route.request().postDataJSON()
    if (query.includes('query OutfitPreviewJobs') && state.status === 'completed') {
      waitingNotificationLists += 1
      await notificationGate
    }
    if (!query.includes('mutation UpdateOutfit')) { await route.fallback(); return }
    expect(Object.keys(variables.input.previewImage).sort()).toEqual(['assetId', 'mimeType', 'model'])
    savedAssets.push(variables.input.previewImage.assetId)
    const previous = mockApi.outfits.find((outfit) => outfit.id === variables.id)!
    const updated = { ...previous, ...variables.input, generations: [{ status: 'completed' as const, imageAsset: { deliveryUrl: imageUrl } }] }
    mockApi.outfits = mockApi.outfits.map((outfit) => outfit.id === variables.id ? updated : outfit)
    await route.fulfill({ json: { data: { updateOutfit: updated } } })
  })
  try {
    await page.goto('/lookbook')
    await expect(page.getByRole('img', { name: '기본 코디 AI 룩북 이미지', exact: true })).toHaveAttribute('src', oldImageUrl)
    await page.getByRole('button', { name: '기본 코디 코디 상세 보기', exact: true }).click()
    await page.getByRole('button', { name: 'AI 룩북 보기', exact: true }).click()
    const saved = page.getByRole('dialog', { name: 'AI 룩북', exact: true })
    await expect(saved.getByRole('img', { name: '기본 코디 AI 룩북 이미지', exact: true })).toHaveAttribute('src', oldImageUrl)
    await saved.getByRole('button', { name: '현재 프로필로 다시 만들기', exact: true }).click()
    await expect.poll(() => state.startCalls).toBe(1)
    await expect(page.getByRole('dialog', { name: 'AI가 룩북을 만들고 있어요', exact: true })).toBeVisible()
    expect(mockApi.outfits[0].generations[0].imageAsset?.deliveryUrl).toBe(oldImageUrl)
    state.status = 'completed'
    const result = page.getByRole('dialog', { name: 'AI 룩 미리보기', exact: true })
    await expect(result.getByRole('img', { name: '선택한 옷으로 생성한 AI 룩 미리보기' })).toHaveAttribute('src', imageUrl)
    await expect.poll(() => waitingNotificationLists).toBeGreaterThan(0)
    await result.getByRole('button', { name: '새 룩북으로 저장', exact: true }).click()
    await expect(result).toHaveCount(0)
    // 미리보기가 이미 닫힌 뒤 완료 목록이 도착해도 같은 결과를 다시 알리지 않는다.
    releaseNotifications()
    await expect.poll(() => state.acknowledged).toBe(true)
    await expect(page.getByRole('button', { name: 'AI 룩 완료 안내 닫기', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: '코디북으로 돌아가기', exact: true }).click()
    await expect(page.getByRole('img', { name: '기본 코디 AI 룩북 이미지', exact: true })).toHaveAttribute('src', imageUrl)
    await page.reload()
    await expect(page.getByRole('img', { name: '기본 코디 AI 룩북 이미지', exact: true })).toHaveAttribute('src', imageUrl)
    expect(savedAssets).toEqual(['planner-preview-asset'])
    expect(state.startCalls).toBe(1)
  } finally {
    releaseNotifications()
  }
})

test('로컬 기록 없이 영속 조회가 일시 실패하면 조회만 다시 시도한다', async ({ page, mockApi }) => {
  mockApi.plannerEntries = [plannerEntry()]
  const state = await installPreviewJobs(page, mockApi)
  state.started = true
  state.status = 'completed'
  state.acknowledged = true
  state.credits = 0
  state.assetErrorCode = 'INTERNAL_SERVER_ERROR'
  await page.goto(`/plan/${date}`)
  const retry = page.getByRole('button', { name: '이미지 다시 불러오기', exact: true })
  await expect(retry).toBeEnabled()
  expect(state.startCalls).toBe(0)
  state.assetErrorCode = null
  await retry.click()
  await expect(page.getByRole('dialog', { name: 'AI 룩 미리보기', exact: true })).toBeVisible()
  expect(state.startCalls).toBe(0)
})

for (const entryPoint of ['composer', 'detail', 'recommendation'] as const) {
  test(`${entryPoint}: 영구 생성 결과를 기존 보기 버튼으로 열며 새 이미지를 만들지 않는다`, async ({ page, mockApi }) => {
    const state = await installPreviewJobs(page, mockApi)
    state.started = true
    state.status = 'completed'
    state.acknowledged = true
    state.credits = 5
    if (entryPoint === 'recommendation') state.previewStyle = null
    if (entryPoint === 'composer') {
      await page.goto('/lookbook/new?items=item-1,item-2&style=casual')
      await page.getByRole('button', { name: 'AI 룩 보기', exact: true }).click()
    } else if (entryPoint === 'detail') {
      await page.goto('/lookbook')
      await page.getByRole('button', { name: '기본 코디 코디 상세 보기', exact: true }).click()
      await page.getByRole('button', { name: 'AI 룩북 보기', exact: true }).click()
    } else {
      await page.route('**/graphql', async (route) => {
        const { query, variables } = route.request().postDataJSON()
        if (!query.includes('query TodayOutfitRecommendation')) { await route.fallback(); return }
        await route.fulfill({ json: { data: { todayOutfitRecommendation: {
          date: variables.input.date, season: variables.input.season, ready: true, headline: '영구 이미지 확인 코디', summary: '이미 만든 이미지를 확인해요.',
          style: 'casual', colorScheme: variables.input.colorScheme, colorSchemeApplied: true, items: mockApi.wardrobeItems, reasons: [], profileSummary: [], model: 'e2e-mock', source: 'fallback', weather: null,
        } } } })
      })
      await page.goto('/plan')
      await page.getByRole('button', { name: 'AI 코디 추천', exact: true }).click()
      const sheet = page.getByRole('dialog', { name: '오늘의 AI 코디 추천' })
      await sheet.getByRole('button', { name: '조건 바꾸기', exact: true }).click()
      await sheet.getByRole('button', { name: '봄', exact: true }).click()
      await sheet.getByRole('button', { name: /자동/ }).click()
      await expect(sheet.getByText('영구 이미지 확인 코디', { exact: true })).toBeVisible()
      await sheet.getByRole('button', { name: '추천 코디 구성 변경하기', exact: true }).click()
      await page.getByRole('dialog', { name: '오늘의 추천 코디 상세', exact: true }).getByRole('button', { name: 'AI 룩북 보기', exact: true }).click()
    }
    const result = page.getByRole('dialog', { name: 'AI 룩 미리보기', exact: true })
    await expect(result.getByRole('img', { name: '선택한 옷으로 생성한 AI 룩 미리보기' })).toHaveAttribute('src', imageUrl)
    expect(state.startCalls).toBe(0)
    state.statusOnStart = 'processing'
    await result.getByRole('button', { name: '다시 만들기', exact: true }).click()
    await expect.poll(() => state.startCalls).toBe(1)
    await expect(page.getByRole('dialog', { name: 'AI가 룩북을 만들고 있어요', exact: true })).toBeVisible()
    state.status = 'completed'
    await expect(result).toBeVisible()
  })
}

test('화면 복귀와 새로고침 후 생성 과정 보기로 기존 팝업을 다시 열고 실패 상태도 이어받는다', async ({ page, mockApi }, testInfo) => {
  mockApi.wardrobeItems.push(createWardrobeItem({ id: 'item-3', name: '다른 바지', category: 'bottom' }))
  mockApi.plannerEntries = [plannerEntry(), plannerEntry(false, ['item-1', 'item-3'], '2026-11-03')]
  const state = await installPreviewJobs(page, mockApi)
  await page.goto(`/plan/${date}`)
  await page.getByRole('button', { name: 'AI 착장 이미지 만들기', exact: true }).click()
  await expect.poll(() => state.startCalls).toBe(1)
  await page.goto('/closet')
  await page.goto(`/plan/${date}`)
  const viewProgress = page.getByRole('button', { name: '생성 과정 보기', exact: true })
  const progress = page.getByRole('dialog', { name: 'AI가 룩북을 만들고 있어요', exact: true })
  await expect(viewProgress).toBeEnabled()
  await expect(progress).toHaveCount(0)
  await viewProgress.click()
  await expect(progress).toBeVisible()
  await page.getByRole('button', { name: 'AI 룩 미리보기 닫기', exact: true }).click()
  await page.reload()
  await expect(viewProgress).toBeEnabled()
  await expect(progress).toHaveCount(0)
  await viewProgress.click()
  await expect(progress).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('restored-preview-progress.png'), animations: 'disabled' })
  await page.getByRole('button', { name: 'AI 룩 미리보기 닫기', exact: true }).click()
  expect(state.startCalls).toBe(1)
  await page.goto('/plan/2026-11-03')
  await expect(page.getByRole('button', { name: 'AI 착장 이미지 만들기', exact: true })).toBeEnabled()
  await page.goto(`/plan/${date}`)
  await viewProgress.click()
  await expect(progress).toBeVisible()
  state.status = 'failed'
  await expect(page.getByRole('dialog', { name: '미리보기를 만들지 못했어요', exact: true }).getByText('테스트 이미지 생성 실패')).toBeVisible()
  await page.getByRole('button', { name: 'AI 룩 미리보기 닫기', exact: true }).click()
  await expect(page.getByRole('button', { name: 'AI 착장 이미지 만들기', exact: true })).toBeEnabled()
  expect(state.startCalls).toBe(1)
})

test('로컬 기록이 없어도 서버 진행 작업을 사용권 없이 열고 완료 결과를 다시 본다', async ({ page, mockApi }) => {
  mockApi.plannerEntries = [plannerEntry()]
  const state = await installPreviewJobs(page, mockApi)
  state.started = true
  state.credits = 0
  await page.goto(`/plan/${date}`)
  await page.getByRole('button', { name: '생성 과정 보기', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'AI가 룩북을 만들고 있어요', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'AI 룩 미리보기 닫기', exact: true }).click()
  state.status = 'completed'
  await expect.poll(() => state.assetCalls).toBe(1)
  await expect(page.getByRole('dialog', { name: 'AI 룩 미리보기', exact: true })).toHaveCount(0)
  const notification = page.getByRole('dialog', { name: 'AI 룩이 완성됐어요', exact: true })
  await expect(notification).toBeVisible()
  await notification.getByRole('button', { name: '나중에 보기', exact: true }).click()
  await page.getByRole('button', { name: 'AI 룩북 보기', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'AI 룩 미리보기', exact: true })).toBeVisible()
  expect(state.startCalls).toBe(0)
  expect(mockApi.operations).not.toContain('CreatePreviewRewardSession')
})

for (const status of ['completed', 'failed'] as const) {
  test(`복원 버튼 클릭 직전 ${status} 상태가 되어도 새 생성 요청을 보내지 않는다`, async ({ page, mockApi }) => {
    mockApi.plannerEntries = [plannerEntry()]
    const state = await installPreviewJobs(page, mockApi)
    state.started = true
    state.listedStatus = 'processing'
    await page.goto(`/plan/${date}`)
    const viewProgress = page.getByRole('button', { name: '생성 과정 보기', exact: true })
    await expect(viewProgress).toBeEnabled()
    state.status = status
    await viewProgress.click()
    await expect(page.getByRole('dialog', { name: status === 'completed' ? 'AI 룩 미리보기' : '미리보기를 만들지 못했어요', exact: true })).toBeVisible()
    expect(state.startCalls).toBe(0)
  })
}

test('생성 실패는 오류 팝업으로 안내하고 사용자가 다시 만들기를 누를 때만 새 요청을 보낸다', async ({ page, mockApi }) => {
  mockApi.plannerEntries = [plannerEntry()]
  const state = await installPreviewJobs(page, mockApi)
  state.status = 'failed'
  await page.goto(`/plan/${date}`)
  await page.getByRole('button', { name: 'AI 착장 이미지 만들기', exact: true }).click()
  const failure = page.getByRole('dialog', { name: '미리보기를 만들지 못했어요', exact: true })
  await expect(failure.getByText('테스트 이미지 생성 실패')).toBeVisible()
  expect(state.startCalls).toBe(1)
  state.statusOnStart = 'processing'
  await failure.getByRole('button', { name: '다시 만들기', exact: true }).click()
  await expect.poll(() => state.startCalls).toBe(2)
  await expect(page.getByRole('dialog', { name: 'AI가 룩북을 만들고 있어요', exact: true })).toBeVisible()
  expect(new Set(state.requestIds).size).toBe(2)
  state.status = 'completed'
  await expect(page.getByRole('dialog', { name: 'AI 룩 미리보기', exact: true })).toBeVisible()
})
