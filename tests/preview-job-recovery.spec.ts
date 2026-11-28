import type { OutfitPreviewJob } from '../packages/types/src/index'
import type { ClosetNativeBridge } from '../apps/web/src/native-bridge/types'
import { createOutfit, test, expect } from './support/fixture'
import { readFileSync } from 'node:fs'
import { createWebViewNavigationQueue, createWebViewNavigationScript, WEB_VIEW_NAVIGATION_DELIVERED } from '../apps/native/src/navigation/webViewNavigation'
import { getNotificationWebPath } from '../apps/native/src/notifications/notificationNavigation'

const imageUrl = `data:image/png;base64,${readFileSync('tests/support/mock-shirt.png').toString('base64')}`
const savedPreviewPath = '/lookbook?outfit=outfit-1&preview=open&previewAssetId=preview-asset-one&previewItems=item-1%2Citem-2&previewStyle=casual'
function makeJob(status: OutfitPreviewJob['status']): OutfitPreviewJob {
  return { id: 'preview-job-one', status, selectedItemIds: ['item-1', 'item-2'], style: null,
    imageAssetId: status === 'completed' ? 'preview-asset-one' : null, model: status === 'completed' ? 'fixture-model' : null,
    errorCode: status === 'interrupted' ? 'AI_INTERRUPTED' : null,
    errorMessage: status === 'interrupted' ? '이전 생성 결과를 확인하지 못해 자동으로 다시 만들지 않았습니다.' : null,
    createdAt: '2026-10-30T00:00:00Z',
    path: status === 'completed' ? '/lookbook/new?items=item-1,item-2&preview=open&previewAssetId=preview-asset-one' : status === 'failed' || status === 'interrupted' ? '/lookbook/new?items=item-1,item-2&preview=failed' : '/lookbook/new?items=item-1,item-2&previewJobId=preview-job-one',
  }
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px: 새로고침 후 진행 작업과 완료 이미지를 새 생성 없이 복원한다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize(viewport)
    let state = makeJob('processing')
    let started = false
    let startCalls = 0
    await page.route('**/graphql', async (route) => {
      const request = route.request().postDataJSON()
      let data: unknown
      if (request.query.includes('mutation StartOutfitPreview')) { started = true; startCalls += 1; data = { startOutfitPreview: state } }
      else if (request.query.includes('query OutfitPreviewJobs')) data = { outfitPreviewJobs: started ? [state] : [] }
      else if (request.query.includes('query OutfitPreviewJob(')) data = { outfitPreviewJob: state }
      else if (request.query.includes('query OutfitPreviewAsset')) data = { outfitPreviewAsset: { assetId: 'preview-asset-one', imageUrl, mimeType: 'image/png', model: 'fixture-model' } }
      else { await route.fallback(); return }
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ data }) })
    })
    await page.goto('/lookbook/new?items=item-1,item-2')
    await page.getByRole('button', { name: 'AI 룩북 만들기', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'AI가 룩북을 만들고 있어요' })).toBeVisible()
    await expect.poll(() => startCalls).toBe(1)
    await page.goto('/plan')
    await page.reload()
    const notice = page.getByRole('complementary', { name: 'AI 이미지 생성 상태' })
    await expect(notice).toHaveCount(0)
    const plannerY = await page.getByRole('heading', { name: '플래너', exact: true }).evaluate((element) => element.getBoundingClientRect().y)
    await testInfo.attach(`preview-job-progress-${viewport.width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })
    state = makeJob('completed')
    const notification = page.getByRole('dialog', { name: 'AI 룩북이 완성됐어요', exact: true })
    await expect(notification).toBeVisible()
    expect(await page.getByRole('heading', { name: '플래너', exact: true }).evaluate((element) => element.getBoundingClientRect().y)).toBe(plannerY)
    await testInfo.attach(`preview-job-popup-${viewport.width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })
    await notification.getByRole('button', { name: '보러 가기', exact: true }).click()
    await expect(page).toHaveURL(/previewAssetId=preview-asset-one/)
    await expect(page.getByRole('heading', { name: 'AI 룩북 미리보기', exact: true })).toBeVisible()
    expect(startCalls).toBe(1)
    expect(mockApi.operations).not.toContain('GenerateOutfitPreview')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await testInfo.attach(`preview-job-completed-${viewport.width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })
  })
}

test('전송 후 중단된 작업은 안내를 표시하고 자동으로 새 생성을 요청하지 않는다', async ({ page, mockApi }) => {
  const state = makeJob('interrupted')
  let startCalls = 0
  await page.route('**/graphql', async (route) => {
    const request = route.request().postDataJSON()
    if (request.query.includes('mutation StartOutfitPreview')) startCalls += 1
    if (!request.query.includes('query OutfitPreviewJobs')) { await route.fallback(); return }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ data: { outfitPreviewJobs: [state] } }) })
  })
  await page.goto('/plan')
  const popup = page.getByRole('dialog', { name: 'AI 룩북을 만들지 못했어요', exact: true })
  await expect(popup.getByText('AI 사용권을 돌려드렸어요. 코디를 열어 다시 만들 수 있어요.')).toBeVisible()
  await popup.getByRole('button', { name: '코디 열기', exact: true }).click()
  await expect(page.getByRole('heading', { name: '미리보기를 만들지 못했어요' })).toBeVisible()
  await page.getByRole('button', { name: 'AI 룩북 미리보기 닫기' }).click()
  await expect(page).not.toHaveURL(/[?&]preview=/)
  expect(startCalls).toBe(0)
  expect(mockApi.operations).not.toContain('GenerateOutfitPreview')
})

test('iOS에서는 새 룩북 버튼을 누르면 추가 조회 없이 백그라운드 접수로 바로 넘긴다', async ({ page, mockApi }) => {
  await page.addInitScript(() => {
    const request = async (query: string, variables?: object, signal?: AbortSignal, backgroundSubmission = false) => {
      if (backgroundSubmission) window.dispatchEvent(new CustomEvent('closet:native-app-state', { detail: { isActive: false } }))
      const response = await fetch('http://127.0.0.1:49999/graphql', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables, backgroundSubmission }), signal,
      })
      return { ok: response.ok, status: response.status, payload: await response.json() }
    }
    window.ClosetNative = {
      requestGraphql: request,
      requestPreviewStart: (query: string, variables?: object, signal?: AbortSignal) => request(query, variables, signal, true),
    } as ClosetNativeBridge
  })

  let clicking = false
  let job: OutfitPreviewJob | undefined
  let acceptBackgroundSubmission!: () => void
  const backgroundSubmission = new Promise<void>((resolve) => { acceptBackgroundSubmission = resolve })
  await page.route('**/graphql', async (route) => {
    const { query, variables, backgroundSubmission } = route.request().postDataJSON()
    if (query.includes('mutation StartOutfitPreview')) {
      expect(backgroundSubmission).toBe(true)
      expect(variables.input).toMatchObject({ selectedItemIds: ['item-1', 'item-2'], requestId: expect.any(String) })
      job = makeJob('completed')
      acceptBackgroundSubmission()
      await route.fulfill({ json: { data: { startOutfitPreview: makeJob('queued') } } })
    } else if (query.includes('query OutfitPreviewJobs')) {
      expect(!clicking || job).toBeTruthy()
      await route.fulfill({ json: { data: { outfitPreviewJobs: job ? [job] : [] } } })
    } else if (query.includes('query OutfitPreviewJob(')) {
      await route.fulfill({ json: { data: { outfitPreviewJob: job } } })
    } else if (query.includes('query OutfitPreviewAsset')) {
      await route.fulfill({ json: { data: { outfitPreviewAsset: { assetId: 'preview-asset-one', imageUrl, mimeType: 'image/png', model: 'fixture-model' } } } })
    } else {
      if (query.includes('query PreviewCredits')) expect(!clicking || job).toBeTruthy()
      await route.fallback()
    }
  })

  await page.goto('/lookbook/new?items=item-1,item-2')
  const button = page.getByRole('button', { name: 'AI 룩북 만들기', exact: true })
  await expect(button).toBeEnabled()
  clicking = true
  await button.click()
  await backgroundSubmission
  await page.evaluate(() => window.dispatchEvent(new Event('closet:native-app-active')))
  await expect(page.getByRole('heading', { name: 'AI 룩북 미리보기', exact: true })).toBeVisible()
  expect(mockApi.operations).not.toContain('GenerateOutfitPreview')
})

for (const acceptedBeforeDisconnect of [false, true]) {
  test(`백그라운드 전환으로 접수 응답이 끊겨도 같은 생성 요청을 이어간다 (${acceptedBeforeDisconnect ? '서버에 접수됨' : '서버에 도달하지 않음'})`, async ({ page, mockApi }) => {
    const requestIds: string[] = []
    let job: OutfitPreviewJob | undefined
    let acceptedCount = 0
    await page.addInitScript(() => {
      window.ClosetNative = {
        requestGraphql: async (query, variables) => {
          const response = await fetch('http://127.0.0.1:49999/graphql', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }),
          })
          if (response.headers.has('x-test-native-disconnect')) {
            window.dispatchEvent(new CustomEvent('closet:native-app-state', { detail: { isActive: false } }))
            throw new Error('API 서버에 연결하지 못했어요.')
          }
          return { ok: response.ok, status: response.status, payload: await response.json() }
        },
      } as ClosetNativeBridge
    })
    await page.route('**/graphql', async (route) => {
      const { query, variables } = route.request().postDataJSON()
      if (query.includes('mutation StartOutfitPreview')) {
        const requestId = variables.input.requestId as string
        requestIds.push(requestId)
        if (requestIds.length === 1) {
          if (acceptedBeforeDisconnect) {
            acceptedCount += 1
            job = makeJob('processing')
          }
          await route.fulfill({ headers: { 'access-control-expose-headers': 'x-test-native-disconnect', 'x-test-native-disconnect': '1' }, json: { data: null } })
          return
        }
        if (!job || requestId !== requestIds[0]) acceptedCount += 1
        job = makeJob('completed')
        await route.fulfill({ json: { data: { startOutfitPreview: job } } })
      } else if (query.includes('query OutfitPreviewJobs')) {
        await route.fulfill({ json: { data: { outfitPreviewJobs: job ? [job] : [] } } })
      } else if (query.includes('query OutfitPreviewJob(')) {
        await route.fulfill({ json: { data: { outfitPreviewJob: job } } })
      } else if (query.includes('query OutfitPreviewAsset')) {
        await route.fulfill({ json: { data: { outfitPreviewAsset: { assetId: 'preview-asset-one', imageUrl, mimeType: 'image/png', model: 'fixture-model' } } } })
      } else await route.fallback()
    })

    await page.goto('/lookbook/new?items=item-1,item-2')
    await page.evaluate(() => {
      window.addEventListener('closet:native-app-state', () => document.documentElement.setAttribute('data-test-backgrounded', ''), { once: true })
    })
    await page.getByRole('button', { name: 'AI 룩북 만들기', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-test-backgrounded', '')
    await expect(page.getByRole('heading', { name: 'AI가 룩북을 만들고 있어요' })).toBeVisible()
    expect(requestIds).toHaveLength(1)
    await page.evaluate(() => window.dispatchEvent(new Event('closet:native-app-active')))
    await expect(page.getByRole('heading', { name: 'AI 룩북 미리보기', exact: true })).toBeVisible()
    expect(requestIds).toEqual([requestIds[0], requestIds[0]])
    expect(acceptedCount).toBe(1)
    expect(mockApi.operations).not.toContain('GenerateOutfitPreview')
  })
}

test('백그라운드에서 생성이 실패하면 복귀 시 잔액을 갱신하고 코디를 열 수 있다', async ({ page, mockApi }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let failed = false
  let acknowledged = false
  await page.route('**/graphql', async (route) => {
    const { query } = route.request().postDataJSON()
    const remaining = failed ? 5 : 4
    if (query.includes('query OutfitPreviewJobs')) {
      const job = makeJob(failed ? 'failed' : 'processing')
      await route.fulfill({ json: { data: { outfitPreviewJobs: acknowledged ? [] : [job] } } })
    } else if (query.includes('query PreviewCredits')) {
      await route.fulfill({ json: { data: { previewCredits: { freeRemaining: remaining, rewardRemaining: 0, totalRemaining: remaining, capacity: 5, nextRefillAt: null, serverNow: new Date().toISOString(), rewardMode: 'test', resetsAt: new Date(Date.now() + 86_400_000).toISOString(), pendingRewardSessionId: null } } } })
    } else if (query.includes('mutation AcknowledgeOutfitPreviewJob')) {
      acknowledged = true
      await route.fulfill({ json: { data: { acknowledgeOutfitPreviewJob: true } } })
    } else await route.fallback()
  })
  await page.goto('/lookbook/new?items=item-1,item-2')
  await expect(page.getByText('AI 사용권 4/5', { exact: true })).toBeVisible()
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('closet:native-app-state', { detail: { isActive: false } })))
  failed = true
  const popup = page.getByRole('dialog', { name: 'AI 룩북을 만들지 못했어요', exact: true })
  await expect(popup).toHaveCount(0)
  await page.evaluate(() => window.dispatchEvent(new Event('closet:native-app-active')))
  await expect(popup.getByText('AI 사용권을 돌려드렸어요. 코디를 열어 다시 만들 수 있어요.')).toBeVisible()
  await expect(page.getByText('AI 사용권 5/5', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('preview-job-failure-mobile.png'), animations: 'disabled' })
  await popup.getByRole('button', { name: '코디 열기' }).click()
  await expect(page.getByRole('heading', { name: '미리보기를 만들지 못했어요' })).toBeVisible()
  expect(mockApi.operations).not.toContain('StartOutfitPreview')
})


test('백그라운드에서는 완료 팝업을 숨기고 복귀한 뒤 사용자가 보러 가기를 선택한다', async ({ page, mockApi }) => {
  let state = makeJob('processing')
  await page.route('**/graphql', async (route) => {
    const { query } = route.request().postDataJSON()
    if (!query.includes('query OutfitPreviewJobs')) { await route.fallback(); return }
    await route.fulfill({ json: { data: { outfitPreviewJobs: [state] } } })
  })
  await page.goto('/plan')
  await expect(page.getByRole('heading', { name: '플래너', exact: true })).toBeVisible()
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('closet:native-app-state', { detail: { isActive: false } })))
  state = makeJob('completed')
  const popup = page.getByRole('dialog', { name: 'AI 룩북이 완성됐어요', exact: true })
  await expect(popup).toHaveCount(0)
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('closet:native-app-state', { detail: { isActive: true } }))
    window.dispatchEvent(new Event('closet:native-app-active'))
  })
  await expect(popup).toBeVisible()
  await expect(page).toHaveURL(/\/plan$/)
  await popup.getByRole('button', { name: '나중에 보기', exact: true }).click()
  await expect(popup).toHaveCount(0)
  await page.evaluate(() => window.dispatchEvent(new Event('closet:native-app-active')))
  await expect(popup).toHaveCount(0)
  await expect.poll(() => mockApi.operations).toContain('AcknowledgeOutfitPreviewJob')
  expect(mockApi.operations).not.toContain('StartOutfitPreview')
})

test('완료 팝업은 기존 실패 화면을 즉시 바꾸고 이미지 조회 실패는 생성 없이 다시 읽는다', async ({ page, mockApi }) => {
  const earlier = { ...makeJob('interrupted'), id: 'earlier-job' }
  const completed = { ...makeJob('completed'), createdAt: '2026-10-31T00:00:00Z' }
  let jobs = [earlier]
  const acknowledged: string[] = []
  let canLoad = false
  let releaseLookup!: () => void
  const pendingLookup = new Promise<void>((resolve) => { releaseLookup = resolve })
  await page.route('**/graphql', async (route) => {
    const { query, variables } = route.request().postDataJSON()
    if (query.includes('query OutfitPreviewJobs')) {
      await route.fulfill({ json: { data: { outfitPreviewJobs: jobs.filter((job) => !acknowledged.includes(job.id)) } } })
    } else if (query.includes('query OutfitPreviewAsset')) {
      await pendingLookup
      if (!canLoad) {
        await route.fulfill({ json: { errors: [{ message: '이미지 조회 실패', extensions: { code: 'OUTFIT_PREVIEW_LOAD_FAILED' } }] } })
        return
      }
      await route.fulfill({ json: { data: { outfitPreviewAsset: { assetId: completed.imageAssetId, imageUrl, mimeType: 'image/png', model: 'fixture-model' } } } })
    } else if (query.includes('mutation AcknowledgeOutfitPreviewJob')) {
      acknowledged.push(variables.id)
      await route.fulfill({ json: { data: { acknowledgeOutfitPreviewJob: true } } })
    } else await route.fallback()
  })
  await page.goto(earlier.path)
  await expect(page.getByRole('heading', { name: '미리보기를 만들지 못했어요' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'AI 룩북을 만들지 못했어요' })).toBeVisible()
  jobs = [completed, earlier]
  await page.evaluate(() => window.dispatchEvent(new Event('closet:native-app-active')))
  await page.getByRole('dialog', { name: 'AI 룩북이 완성됐어요' }).getByRole('button', { name: '보러 가기' }).click()
  await expect(page.getByRole('heading', { name: '완성된 AI 룩북을 불러오고 있어요' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '미리보기를 만들지 못했어요' })).toHaveCount(0)
  releaseLookup()
  const loadError = page.getByRole('dialog', { name: '완성된 AI 룩북을 불러오지 못했어요' })
  await expect(loadError).toBeVisible()
  expect(acknowledged).toEqual([])
  canLoad = true
  await loadError.getByRole('button', { name: '다시 불러오기' }).click()
  await expect(page.getByRole('heading', { name: 'AI 룩북 미리보기', exact: true })).toBeVisible()
  await expect.poll(() => acknowledged.sort()).toEqual([earlier.id, completed.id].sort())
  expect(mockApi.operations).not.toContain('StartOutfitPreview')
})

test('푸시의 결과 경로로 이미 진입했으면 완료 팝업을 겹쳐 띄우지 않는다', async ({ page, mockApi }) => {
  const completed = makeJob('completed')
  let acknowledged = false
  await page.route('**/graphql', async (route) => {
    const { query } = route.request().postDataJSON()
    let data: unknown
    if (query.includes('query OutfitPreviewJobs')) data = { outfitPreviewJobs: acknowledged ? [] : [completed] }
    else if (query.includes('query OutfitPreviewAsset')) data = { outfitPreviewAsset: { assetId: 'preview-asset-one', imageUrl, mimeType: 'image/png', model: 'fixture-model' } }
    else if (query.includes('mutation AcknowledgeOutfitPreviewJob')) { acknowledged = true; data = { acknowledgeOutfitPreviewJob: true } }
    else { await route.fallback(); return }
    await route.fulfill({ json: { data } })
  })
  await page.goto(completed.path)
  await expect(page.getByRole('heading', { name: 'AI 룩북 미리보기', exact: true })).toBeVisible()
  await expect.poll(() => acknowledged).toBe(true)
  await expect(page.getByRole('dialog', { name: 'AI 룩북이 완성됐어요', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'AI 룩북 미리보기 닫기' }).click()
  await expect(page).not.toHaveURL(/[?&]preview=/)
  await expect(page).toHaveURL(/[?&]previewAssetId=preview-asset-one/)
  expect(mockApi.operations).not.toContain('StartOutfitPreview')
})

for (const status of ['completed', 'failed'] as const) {
  test(`닫은 AI 룩북 결과 안내는 앱이 복귀해도 다시 열리지 않는다 (${status})`, async ({ page, mockApi }) => {
    const completed = status === 'completed'
    const job = makeJob(status)
    const jobs = [job]
    let acknowledged = false
    await page.route('**/graphql', async (route) => {
      const { query, variables } = route.request().postDataJSON()
      if (query.includes('query OutfitPreviewJobs')) {
        await route.fulfill({ json: { data: { outfitPreviewJobs: acknowledged ? jobs.filter((item) => item.id !== job.id) : jobs } } })
      } else if (query.includes('mutation AcknowledgeOutfitPreviewJob')) {
        acknowledged = variables.id === job.id
        await route.fulfill({ json: { data: { acknowledgeOutfitPreviewJob: acknowledged } } })
      } else await route.fallback()
    })

    await page.addInitScript(() => { window.ClosetRuntimeConfig = { isNativeWebView: true, routerMode: 'hash' } })
    await page.goto('/#/plan')
    const popup = page.getByRole('dialog', { name: completed ? 'AI 룩북이 완성됐어요' : 'AI 룩북을 만들지 못했어요' })
    await expect(popup).toBeVisible()
    await popup.getByRole('button', { name: 'AI 룩북 안내 닫기' }).click()
    await expect(popup).toHaveCount(0)
    await expect(page).toHaveURL(/#\/plan$/)

    // WebView를 다시 로드하면 닫은 작업은 건너뛰고 새로운 결과를 알린다.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('closet:native-app-state', { detail: { isActive: false } })))
    jobs.push({ ...makeJob(completed ? 'failed' : 'completed'), id: 'preview-job-two' })
    await page.reload()
    await page.evaluate(() => window.dispatchEvent(new Event('closet:native-app-active')))
    await expect(page.getByRole('dialog', { name: completed ? 'AI 룩북을 만들지 못했어요' : 'AI 룩북이 완성됐어요' })).toBeVisible()
    await expect(popup).toHaveCount(0)
    expect(acknowledged).toBe(true)
    await expect(page).toHaveURL(/#\/plan$/)
    expect(mockApi.operations).not.toContain('StartOutfitPreview')
  })
}

for (const buttonName of ['나중에 보기', 'AI 룩북 안내 닫기']) {
  test(`확인 전송이 끊겨도 앱을 다시 켜면 닫은 실패 안내를 건너뛴다 (${buttonName})`, async ({ page, mockApi }) => {
    const failed = makeJob('interrupted')
    const jobs = [failed]
    const acknowledgementAttempts: string[] = []
    let canAcknowledge = false
    await page.route('**/restart-fixture', async (route) => {
      await route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>WebView closed</title>' })
    })
    await page.route('**/graphql', async (route) => {
      const { query, variables } = route.request().postDataJSON()
      if (query.includes('query OutfitPreviewJobs')) {
        await route.fulfill({ json: { data: { outfitPreviewJobs: jobs } } })
      } else if (query.includes('mutation AcknowledgeOutfitPreviewJob')) {
        acknowledgementAttempts.push(variables.id)
        if (!canAcknowledge) {
          await route.fulfill({ json: { errors: [{ message: 'AI 결과 확인을 저장하지 못했어요.', extensions: { code: 'INTERNAL_SERVER_ERROR' } }] } })
          return
        }
        const index = jobs.findIndex((job) => job.id === variables.id)
        if (index >= 0) jobs.splice(index, 1)
        await route.fulfill({ json: { data: { acknowledgeOutfitPreviewJob: index >= 0 } } })
      } else await route.fallback()
    })

    await page.addInitScript(() => { window.ClosetRuntimeConfig = { isNativeWebView: true, routerMode: 'hash' } })
    await page.goto('/#/plan')
    const popup = page.getByRole('dialog', { name: 'AI 룩북을 만들지 못했어요' })
    await expect(popup).toBeVisible()
    await popup.getByRole('button', { name: buttonName, exact: true }).click()
    await expect(popup).toHaveCount(0)
    await expect.poll(() => acknowledgementAttempts).toEqual([failed.id])

    // 새 문서에서 앱을 다시 시작한다. 서버는 이전 실패를 여전히 미확인으로 반환한다.
    await page.goto('/restart-fixture')
    jobs.push({ ...makeJob('completed'), id: 'next-preview-job' })
    canAcknowledge = true
    await page.goto('/#/plan')
    await expect(page.getByRole('dialog', { name: 'AI 룩북이 완성됐어요' })).toBeVisible()
    await expect(popup).toHaveCount(0)
    await expect.poll(() => acknowledgementAttempts).toEqual([failed.id, failed.id])
    await expect(page).toHaveURL(/#\/plan$/)
    expect(mockApi.operations).not.toContain('StartOutfitPreview')
  })
}

test('백그라운드에서 누른 완료 푸시는 복귀 직후 기존 생성 화면을 같은 작업의 결과로 바꾼다', async ({ page, mockApi }) => {
  const processing = makeJob('processing')
  const completed = makeJob('completed')
  let job: OutfitPreviewJob | undefined
  let startCalls = 0
  let releaseAssetResponse!: () => void
  const assetResponse = new Promise<void>((resolve) => { releaseAssetResponse = resolve })
  await page.route('**/graphql', async (route) => {
    const { query, variables } = route.request().postDataJSON()
    if (query.includes('mutation StartOutfitPreview')) {
      startCalls += 1
      job = processing
      await route.fulfill({ json: { data: { startOutfitPreview: processing } } })
    } else if (query.includes('query OutfitPreviewJobs')) {
      await route.fulfill({ json: { data: { outfitPreviewJobs: job ? [job] : [] } } })
    } else if (query.includes('query OutfitPreviewJob(')) {
      // 백그라운드에 가기 전 시작한 상태 조회가 계속 예전 진행 상태를 반환해도 푸시 결과를 열어야 한다.
      await route.fulfill({ json: { data: { outfitPreviewJob: processing } } })
    } else if (query.includes('query OutfitPreviewAsset')) {
      expect(variables.id).toBe(completed.imageAssetId)
      await assetResponse
      await route.fulfill({ json: { data: { outfitPreviewAsset: { assetId: completed.imageAssetId, imageUrl, mimeType: 'image/png', model: 'fixture-model' } } } })
    } else await route.fallback()
  })

  await page.addInitScript(() => { window.ClosetRuntimeConfig = { isNativeWebView: true, routerMode: 'hash' } })
  await page.goto('/#/lookbook/new?items=item-1,item-2')
  await page.getByRole('button', { name: 'AI 룩북 만들기', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'AI가 룩북을 만들고 있어요' })).toBeVisible()
  await expect.poll(() => startCalls).toBe(1)
  await page.evaluate((deliveryType) => {
    Reflect.set(window, '__closetBundleLoadKey', 'current-webview')
    window.ReactNativeWebView = {
      postMessage(raw) {
        const data = JSON.parse(raw)
        if (data.type === deliveryType) document.documentElement.setAttribute('data-test-navigation-delivery', JSON.stringify(data))
      },
    }
    window.dispatchEvent(new CustomEvent('closet:native-app-state', { detail: { isActive: false } }))
  }, WEB_VIEW_NAVIGATION_DELIVERED)
  job = completed

  const path = getNotificationWebPath({ type: 'ai-completion', kind: 'outfit-preview', path: completed.path, previewAssetId: completed.imageAssetId })
  expect(path).toBe(completed.path)
  const queue = createWebViewNavigationQueue()
  queue.enqueue(path!)
  let script: string | undefined
  const prepareDelivery = (path: string, id: number) => { script = createWebViewNavigationScript(path, id) }
  queue.flush({ isReady: true, isActive: false }, prepareDelivery)
  expect(script).toBeUndefined()
  queue.flush({ isReady: true, isActive: true }, prepareDelivery)
  await page.evaluate((script) => {
    window.eval(script!)
    window.dispatchEvent(new Event('closet:native-app-active'))
  }, script)
  await expect(page.locator('html')).toHaveAttribute('data-test-navigation-delivery', JSON.stringify({ type: WEB_VIEW_NAVIGATION_DELIVERED, id: 1, loadKey: 'current-webview' }))
  await expect(page.getByRole('heading', { name: '완성된 AI 룩북을 불러오고 있어요' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'AI가 룩북을 만들고 있어요' })).toHaveCount(0)
  releaseAssetResponse()
  await expect(page.getByRole('heading', { name: 'AI 룩북 미리보기', exact: true })).toBeVisible()
  expect(startCalls).toBe(1)
  expect(mockApi.operations).not.toContain('GenerateOutfitPreview')
})

test('저장된 룩북 재생성 화면에서 진행 중 작업을 이어받고 푸시 경로에서 완료 이미지를 연다', async ({ page, mockApi }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  mockApi.outfits = [createOutfit({ generations: [{ status: 'completed', imageAsset: { deliveryUrl: imageUrl } }] })]
  let state = { ...makeJob('processing'), style: 'casual' }
  let reads = 0
  let starts = 0
  await page.route('**/graphql', async route => {
    const { query } = route.request().postDataJSON()
    if (query.includes('query OutfitPreviewJobs')) {
      await route.fulfill({ json: { data: { outfitPreviewJobs: [state] } } })
    } else if (query.includes('query OutfitPreviewJob(')) {
      reads++
      await route.fulfill({ json: { data: { outfitPreviewJob: state } } })
    } else if (query.includes('mutation StartOutfitPreview')) {
      starts++
      await route.fulfill({ json: { data: { startOutfitPreview: state } } })
    } else if (query.includes('query OutfitPreviewAsset')) {
      await route.fulfill({ json: { data: { outfitPreviewAsset: { assetId: 'preview-asset-one', imageUrl, mimeType: 'image/png', model: 'fixture-model' } } } })
    } else await route.fallback()
  })

  await page.addInitScript(() => { window.ClosetRuntimeConfig = { isNativeWebView: true, routerMode: 'hash' } })
  await page.goto('/#/lookbook')
  await page.getByRole('button', { name: '기본 코디 코디 상세 보기' }).click()
  await page.getByRole('button', { name: 'AI 룩북 보기', exact: true }).click()
  await page.getByRole('button', { name: 'AI 룩북 다시 만들기' }).click()
  await expect(page.getByRole('dialog', { name: 'AI가 룩북을 만들고 있어요' })).toBeVisible()
  await expect.poll(() => reads).toBeGreaterThan(0)
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('closet:native-app-state', { detail: { isActive: false } })))
  state = { ...makeJob('completed'), style: 'casual', path: savedPreviewPath }
  const previousUrl = page.url()
  const history = await page.evaluate((script) => {
    const previousEntry = window.history.state
    window.addEventListener('hashchange', () => document.documentElement.setAttribute('data-hash-change', ''), { once: true })
    window.eval(script)
    window.dispatchEvent(new Event('closet:native-app-active'))
    return { previousEntry, pushedEntry: window.history.state }
  }, createWebViewNavigationScript(state.path))
  expect(history.pushedEntry.idx).toBe(history.previousEntry.idx + 1)
  expect(history.pushedEntry.key).toEqual(expect.any(String))
  expect(history.pushedEntry.key).not.toBe(history.previousEntry.key)
  await expect(page.getByRole('dialog', { name: 'AI 룩북 미리보기', exact: true })).toBeVisible()
  await expect(page.locator('html')).not.toHaveAttribute('data-hash-change')
  await expect(page.getByRole('button', { name: '새 AI 룩북으로 저장' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'AI가 룩북을 만들고 있어요' })).toHaveCount(0)
  const resultUrl = page.url()
  await page.goBack()
  await expect(page).toHaveURL(previousUrl)
  await expect(page.getByRole('dialog', { name: 'AI 룩북 미리보기', exact: true })).toHaveCount(0)
  await page.goForward()
  await expect(page).toHaveURL(resultUrl)
  await expect(page.getByRole('dialog', { name: 'AI 룩북 미리보기', exact: true })).toBeVisible()
  expect(starts).toBe(0)
})

for (const regenerate of [false, true]) {
  test(`저장된 코디의 AI 룩북 ${regenerate ? '재생성' : '생성'} 완료 팝업에서 원래 코디를 연다`, async ({ page, mockApi }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    mockApi.outfits = [createOutfit({
      generations: regenerate ? [{ status: 'completed', imageAsset: { deliveryUrl: imageUrl } }] : [],
    })]
    mockApi.previewImages['preview-asset-one'] = imageUrl
    let state: OutfitPreviewJob | undefined
    let sourceOutfitId: string | undefined
    let acknowledged = false
    let starts = 0
    await page.route('**/graphql', async (route) => {
      const { query, variables } = route.request().postDataJSON()
      let data: unknown
      if (query.includes('mutation StartOutfitPreview')) {
        starts += 1
        sourceOutfitId = variables.input.sourceOutfitId
        state = { ...makeJob('processing'), style: 'casual' }
        data = { startOutfitPreview: state }
      } else if (query.includes('query OutfitPreviewJobs')) {
        data = { outfitPreviewJobs: state && !acknowledged ? [state] : [] }
      } else if (query.includes('query OutfitPreviewJob(')) {
        data = { outfitPreviewJob: state }
      } else if (query.includes('query OutfitPreviewAsset')) {
        data = { outfitPreviewAsset: { assetId: 'preview-asset-one', imageUrl, mimeType: 'image/png', model: 'fixture-model' } }
      } else if (query.includes('mutation AcknowledgeOutfitPreviewJob')) {
        acknowledged = true
        data = { acknowledgeOutfitPreviewJob: true }
      } else {
        await route.fallback()
        return
      }
      await route.fulfill({ json: { data } })
    })

    await page.goto('/lookbook?outfit=outfit-1')
    if (regenerate) {
      await page.getByRole('button', { name: 'AI 룩북 보기', exact: true }).click()
      await page.getByRole('button', { name: 'AI 룩북 다시 만들기' }).click()
    } else {
      await page.getByRole('button', { name: 'AI 룩북 만들기', exact: true }).click()
    }
    await expect.poll(() => starts).toBe(1)
    await page.goto('/plan')
    const completed = { ...makeJob('completed'), style: 'casual' }
    state = sourceOutfitId ? { ...completed, path: savedPreviewPath } : completed
    const notice = page.getByRole('dialog', { name: 'AI 룩북이 완성됐어요', exact: true })
    await notice.getByRole('button', { name: '보러 가기', exact: true }).click()
    await expect(page).toHaveURL(/\/lookbook\?outfit=outfit-1/)
    const preview = page.getByRole('dialog', { name: 'AI 룩북 미리보기', exact: true })
    await expect(preview.getByRole('button', { name: '새 AI 룩북으로 저장' })).toBeVisible()
    await expect.poll(() => acknowledged).toBe(true)
    if (regenerate) {
      await preview.getByRole('button', { name: '새 AI 룩북으로 저장' }).click()
      await expect.poll(() => mockApi.outfits.map((outfit) => [outfit.id, outfit.generations[0]?.imageAsset?.id]))
        .toEqual([['outfit-1', 'preview-asset-one']])
      expect(mockApi.operations).not.toContain('CreateOutfit')
    } else {
      await preview.getByRole('button', { name: 'AI 룩북 미리보기 닫기', exact: true }).click()
    }
    await expect(page).toHaveURL(/\/lookbook\?outfit=outfit-1$/)
    await expect(page.getByRole('dialog', { name: '기본 코디 코디 상세', exact: true })).toBeVisible()
    expect(sourceOutfitId).toBe('outfit-1')
    expect(starts).toBe(1)
  })
}
