import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { queryKeys } from '../src/lib/queryKeys'
import { advanceOutfitRecommendationRevision } from '../src/features/lookbook/api/outfitRecommendationCache'
import { useOutfitRecommendationQuery } from '../src/features/lookbook/api/outfitRecommendationQueries'

test('옷장 변경 전 진행 응답은 새 결과에 붙지 않고 새 클릭만 조회하며 같은 결과 재열기는 무료다', async (t) => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, staleTime: Infinity } } })
  const originalWindow = globalThis.window
  let calls = 0
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  let markStarted!: () => void
  const started = new Promise<void>((resolve) => { markStarted = resolve })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: { getItem: () => 'test-session' }, ClosetNative: { requestGraphql: async () => {
      const call = ++calls
      if (call === 1) { markStarted(); await gate }
      return { ok: true, payload: { data: { outfitRecommendation: {
        targetCategory: 'bottom', headline: '추천', summary: '설명', model: 'test', source: 'ai', recommendedColors: [],
        candidates: [{ reason: '색감', relation: 'tone-on-tone', item: {
          id: 'pants', name: call === 1 ? '수정 전 바지' : '수정 후 바지', createdAt: '2026-01-01T00:00:00Z',
          category: 'bottom', additionalCategories: [], subcategory: '슬랙스', colorName: '네이비', colorHex: '#24364a',
          seasons: ['spring'], tags: [], classificationStatus: 'classified', wearCount: 0,
        } }],
      } } } }
    } } },
  })
  t.after(() => {
    release(); client.clear()
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
  })
  client.setQueryData(queryKeys.me, { id: 'viewer' })
  const renderQuery = () => {
    let query!: ReturnType<typeof useOutfitRecommendationQuery>
    function Capture() { query = useOutfitRecommendationQuery(['shirt'], 'bottom'); return null }
    renderToString(createElement(QueryClientProvider, { client }, createElement(Capture)))
    return query
  }
  const waitForResult = (revision: number) => {
    const key = [...queryKeys.outfits.recommendation('viewer', ['shirt'], 'bottom'), revision]
    if (client.getQueryData(key)) return Promise.resolve()
    return new Promise<void>((resolve) => {
      const unsubscribe = client.getQueryCache().subscribe(() => {
        if (client.getQueryData(key)) { unsubscribe(); resolve() }
      })
    })
  }
  const original = renderQuery()
  original.loadRecommendation()
  await started
  advanceOutfitRecommendationRevision(client)
  assert.equal(original.loadRecommendation(), false)
  const changed = renderQuery()
  assert.equal(changed.data, undefined)
  assert.equal(calls, 1)
  const oldCompleted = waitForResult(0)
  release()
  await oldCompleted
  assert.equal(renderQuery().data, undefined)
  assert.equal(calls, 1)
  const freshCompleted = waitForResult(1)
  renderQuery().loadRecommendation()
  await freshCompleted
  const reopened = renderQuery()
  assert.equal(reopened.data?.candidates[0].item.name, '수정 후 바지')
  reopened.loadRecommendation()
  await client.invalidateQueries({ queryKey: ['outfits'] })
  assert.equal(calls, 2)
  assert.equal(renderQuery().data?.candidates[0].item.name, '수정 후 바지')
})
