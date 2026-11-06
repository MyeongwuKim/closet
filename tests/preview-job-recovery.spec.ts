import type { OutfitPreviewJob } from '../packages/types/src/index'
import { test, expect } from './support/fixture'
import { readFileSync } from 'node:fs'

const imageUrl = `data:image/png;base64,${readFileSync('tests/support/mock-shirt.png').toString('base64')}`
function makeJob(status: OutfitPreviewJob['status']): OutfitPreviewJob {
  return { id: 'preview-job-one', status, selectedItemIds: ['item-1', 'item-2'], style: null,
    imageAssetId: status === 'completed' ? 'preview-asset-one' : null, model: status === 'completed' ? 'fixture-model' : null,
    errorCode: status === 'interrupted' ? 'AI_INTERRUPTED' : null,
    errorMessage: status === 'interrupted' ? '이전 생성 결과를 확인하지 못해 자동으로 다시 만들지 않았습니다.' : null,
    createdAt: '2026-10-30T00:00:00Z',
    path: status === 'completed' ? '/lookbook/new?items=item-1,item-2&preview=open&previewAssetId=preview-asset-one' : status === 'interrupted' ? '/lookbook/new?items=item-1,item-2&preview=failed' : '/lookbook/new?items=item-1,item-2&previewJobId=preview-job-one',
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
    await page.getByRole('button', { name: 'AI 착장 이미지 만들기', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'AI가 룩북을 만들고 있어요' })).toBeVisible()
    await expect.poll(() => startCalls).toBe(1)
    await page.goto('/plan')
    await page.reload()
    const notice = page.getByRole('complementary', { name: 'AI 이미지 생성 상태' })
    await expect(notice).toHaveCount(0)
    const plannerY = await page.getByRole('heading', { name: '플래너', exact: true }).evaluate((element) => element.getBoundingClientRect().y)
    await testInfo.attach(`preview-job-progress-${viewport.width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })
    state = makeJob('completed')
    const notification = page.getByRole('dialog', { name: 'AI 룩이 완성됐어요', exact: true })
    await expect(notification).toBeVisible()
    expect(await page.getByRole('heading', { name: '플래너', exact: true }).evaluate((element) => element.getBoundingClientRect().y)).toBe(plannerY)
    await testInfo.attach(`preview-job-popup-${viewport.width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })
    await notification.getByRole('button', { name: '보러 가기', exact: true }).click()
    await expect(page).toHaveURL(/previewAssetId=preview-asset-one/)
    await expect(page.getByRole('heading', { name: 'AI 룩 미리보기', exact: true })).toBeVisible()
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
  await expect(page.getByText(state.errorMessage!)).toBeVisible()
  await page.getByRole('dialog', { name: 'AI 룩을 만들지 못했어요', exact: true }).getByRole('button', { name: '결과 확인', exact: true }).click()
  await expect(page.getByRole('heading', { name: '미리보기를 만들지 못했어요' })).toBeVisible()
  expect(startCalls).toBe(0)
  expect(mockApi.operations).not.toContain('GenerateOutfitPreview')
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
  const popup = page.getByRole('dialog', { name: 'AI 룩이 완성됐어요', exact: true })
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
  await expect(page.getByRole('heading', { name: 'AI 룩 미리보기', exact: true })).toBeVisible()
  await expect.poll(() => acknowledged).toBe(true)
  await expect(page.getByRole('dialog', { name: 'AI 룩이 완성됐어요', exact: true })).toHaveCount(0)
  expect(mockApi.operations).not.toContain('StartOutfitPreview')
})
