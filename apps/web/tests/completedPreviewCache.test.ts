import assert from 'node:assert/strict'
import test from 'node:test'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import type { CompletedOutfitPreview } from '@closet/types'
import { queryKeys } from '../src/lib/queryKeys'
import { completedPreviewKeys, discardCompletedOutfitPreview, invalidateCompletedOutfitPreviews } from '../src/features/lookbook/utils/completedPreviewCache'
import { readCompletedPreviewPointer, writeCompletedPreviewPointer } from '../src/features/lookbook/utils/completedPreviewPointer'
import { previewRequestKey, readPendingPreview, writePendingPreview } from '../src/features/lookbook/utils/pendingPreviewRequest'
import { cacheOutfitPreview, readCachedOutfitPreview } from '../src/features/lookbook/utils/outfitPreviewCache'
import { cacheRecommendationPreview, getRecommendationPreviewKey, readRecommendationPreview } from '../src/features/plan/utils/recommendationPreviewCache'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

const image: CompletedOutfitPreview = { assetId: 'old-asset', imageUrl: 'https://example.test/old', mimeType: 'image/png', model: 'test', jobId: 'old-job', createdAt: '2026-11-01T00:00:00.000Z' }
const viewerId = 'viewer-one'
const requestKey = previewRequestKey(viewerId, ['top', 'bottom'], 'casual')

test('저장 후 현재 완료 조회만 재확인하고 비활성 URL 캐시는 제거한다', async () => {
  const client = new QueryClient()
  client.setQueryData(queryKeys.me, { id: viewerId })
  const activeKey = completedPreviewKeys.lookup(viewerId, requestKey)
  client.setQueryData(activeKey, image)
  let reads = 0
  const observer = new QueryObserver(client, { queryKey: activeKey, staleTime: Infinity, queryFn: async () => { reads++; return null } })
  const unsubscribe = observer.subscribe(() => undefined)
  const inactiveKey = completedPreviewKeys.result(viewerId, requestKey, image.assetId)
  const otherAccountKey = completedPreviewKeys.lookup('viewer-two', requestKey)
  const pendingJobKey = ['outfit-preview-job', 'running-job']
  const creditsKey = ['preview-credits', viewerId]
  client.setQueryData(inactiveKey, image)
  client.setQueryData(otherAccountKey, image)
  client.setQueryData(queryKeys.outfits.previewAsset(image.assetId), image)
  client.setQueryData(pendingJobKey, { status: 'processing' })
  client.setQueryData(creditsKey, { preview: 2 })

  await invalidateCompletedOutfitPreviews(client)

  assert.equal(reads, 1)
  assert.equal(client.getQueryData(activeKey), null)
  assert.equal(client.getQueryState(inactiveKey), undefined)
  assert.equal(client.getQueryState(queryKeys.outfits.previewAsset(image.assetId)), undefined)
  assert.deepEqual(client.getQueryData(otherAccountKey), image)
  assert.deepEqual(client.getQueryData(pendingJobKey), { status: 'processing' })
  assert.deepEqual(client.getQueryData(creditsKey), { preview: 2 })
  unsubscribe()
  client.clear()
})

test('삭제 확인은 같은 asset의 완료 번호와 이전 URL만 폐기한다', () => {
  const client = new QueryClient()
  const storage = new MemoryStorage()
  const recommendationKey = getRecommendationPreviewKey(viewerId, 'casual', ['top', 'bottom'])
  const otherRecommendationKey = getRecommendationPreviewKey('viewer-two', 'casual', ['top', 'bottom'])
  writeCompletedPreviewPointer(requestKey, { jobId: 'old-job', assetId: image.assetId, recordedAt: Date.now() }, storage)
  writePendingPreview(requestKey, { requestId: 'old-request', jobId: 'old-job', createdAt: Date.now() }, storage)
  client.setQueryData(completedPreviewKeys.result(viewerId, requestKey, image.assetId), image)
  client.setQueryData(completedPreviewKeys.lookup(viewerId, requestKey), image)
  cacheOutfitPreview(viewerId, 'old-composition', image, { storage })
  cacheOutfitPreview('viewer-two', 'old-composition', image, { storage })
  cacheRecommendationPreview(recommendationKey, { ...image, imageBase64: '' })
  cacheRecommendationPreview(otherRecommendationKey, { ...image, imageBase64: '' })

  discardCompletedOutfitPreview(client, viewerId, requestKey, image.assetId, 'old-job', storage)

  assert.equal(readCompletedPreviewPointer(requestKey, storage), null)
  assert.equal(readPendingPreview(requestKey, storage), null)
  assert.equal(client.getQueryData(completedPreviewKeys.result(viewerId, requestKey, image.assetId)), null)
  assert.equal(client.getQueryData(completedPreviewKeys.lookup(viewerId, requestKey)), null)
  assert.equal(readCachedOutfitPreview(viewerId, 'old-composition', { storage }), undefined)
  assert.deepEqual(readCachedOutfitPreview('viewer-two', 'old-composition', { storage }), image)
  assert.equal(readRecommendationPreview(recommendationKey), undefined)
  assert.equal(readRecommendationPreview(otherRecommendationKey)?.assetId, image.assetId)
  client.clear()
})

test('과거 asset의 늦은 삭제 응답은 같은 조합의 새 이미지와 새 진행 요청을 보존한다', () => {
  const client = new QueryClient()
  const storage = new MemoryStorage()
  const fresh = { ...image, assetId: 'fresh-asset', jobId: 'fresh-job' }
  writeCompletedPreviewPointer(requestKey, { jobId: 'fresh-job', assetId: fresh.assetId, recordedAt: Date.now() }, storage)
  writePendingPreview(requestKey, { requestId: 'new-request', jobId: 'fresh-job', createdAt: Date.now() }, storage)
  client.setQueryData(completedPreviewKeys.lookup(viewerId, requestKey), fresh)
  client.setQueryData(completedPreviewKeys.result(viewerId, requestKey, fresh.assetId), fresh)
  cacheOutfitPreview(viewerId, 'fresh-composition', fresh, { storage })

  discardCompletedOutfitPreview(client, viewerId, requestKey, image.assetId, 'old-job', storage)

  assert.equal(readCompletedPreviewPointer(requestKey, storage)?.assetId, fresh.assetId)
  assert.equal(readPendingPreview(requestKey, storage)?.jobId, 'fresh-job')
  assert.deepEqual(client.getQueryData(completedPreviewKeys.lookup(viewerId, requestKey)), fresh)
  assert.deepEqual(client.getQueryData(completedPreviewKeys.result(viewerId, requestKey, fresh.assetId)), fresh)
  assert.deepEqual(readCachedOutfitPreview(viewerId, 'fresh-composition', { storage }), fresh)
  client.clear()
})

test('첫 완료 조회가 실패한 뒤 이미지 삭제가 확정되면 조회 오류도 빈 결과로 정리한다', async () => {
  const client = new QueryClient()
  const storage = new MemoryStorage()
  const key = completedPreviewKeys.lookup(viewerId, requestKey)
  await assert.rejects(client.fetchQuery({
    queryKey: key, retry: false,
    queryFn: async () => { throw new Error('조회 도중 완료 포인터가 바뀜') },
  }))
  assert.equal(client.getQueryState(key)?.status, 'error')
  assert.equal(client.getQueryData(key), undefined)

  discardCompletedOutfitPreview(client, viewerId, requestKey, image.assetId, image.jobId ?? undefined, storage)

  assert.equal(client.getQueryState(key)?.status, 'success')
  assert.equal(client.getQueryData(key), null)
  client.clear()
})
