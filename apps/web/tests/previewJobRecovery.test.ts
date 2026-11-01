import assert from 'node:assert/strict'
import test from 'node:test'
import type { OutfitPreviewJob } from '@closet/types'
import { clearPendingPreview, previewRequestKey, readPendingPreview, writePendingPreview } from '../src/features/lookbook/utils/pendingPreviewRequest'
import { waitForPreviewJob } from '../src/features/lookbook/utils/waitForPreviewJob'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}
const job: OutfitPreviewJob = { id: 'job-one', status: 'queued', selectedItemIds: ['top', 'bottom'], style: null, imageAssetId: null, model: null, errorCode: null, errorMessage: null, createdAt: '2026-10-30T00:00:00Z', path: '/lookbook/new?previewJobId=job-one' }

test('같은 옷의 순서를 바꿔도 요청 번호를 복원하며 사용자·스타일은 구분한다', () => {
  const storage = new MemoryStorage()
  const key = previewRequestKey('viewer', ['top', 'bottom'])
  writePendingPreview(key, { requestId: 'same-request', jobId: job.id, createdAt: 100 }, storage)
  assert.equal(readPendingPreview(previewRequestKey('viewer', ['bottom', 'top']), storage, 200)?.requestId, 'same-request')
  assert.equal(readPendingPreview(previewRequestKey('other-viewer', ['top', 'bottom']), storage, 200), null)
  assert.equal(readPendingPreview(previewRequestKey('viewer', ['top', 'bottom'], 'casual'), storage, 200), null)
  clearPendingPreview(key, storage)
  assert.equal(readPendingPreview(key, storage, 200), null)
})

test('만료·손상·미래 시각의 요청 기록은 재사용하지 않고 저장소 제한도 허용한다', () => {
  const storage = new MemoryStorage()
  for (const value of ['{bad', JSON.stringify({ requestId: 'request', createdAt: 500 }), JSON.stringify({ requestId: 'request', createdAt: -86_400_000 })]) {
    storage.setItem('key', value)
    assert.equal(readPendingPreview('key', storage, 100), null)
  }
  assert.equal(readPendingPreview('key', null), null)
  assert.doesNotThrow(() => writePendingPreview('key', { requestId: 'request', createdAt: 0 }, null))
})

test('접수된 작업만 조회해 완료를 복원하고 이미지 생성 요청을 추가하지 않는다', async () => {
  let reads = 0
  const result = await waitForPreviewJob(job, async (id) => {
    reads += 1
    assert.equal(id, job.id)
    return { ...job, status: reads === 1 ? 'processing' : 'completed', imageAssetId: reads === 1 ? null : 'asset-one' }
  }, { wait: async () => undefined })
  assert.equal(reads, 2)
  assert.equal(result.imageAssetId, 'asset-one')
})

test('전송 후 중단이나 대기 기한 초과는 자동 생성 없이 호출자에게 전달한다', async () => {
  await assert.rejects(waitForPreviewJob({ ...job, status: 'interrupted', errorCode: 'AI_INTERRUPTED', errorMessage: '이전 결과 확인 필요' }, async () => job), { code: 'AI_INTERRUPTED' })
  let now = 0
  let reads = 0
  await assert.rejects(waitForPreviewJob(job, async () => { reads += 1; return job }, { now: () => now, wait: async () => { now += 10 }, timeoutMs: 20 }), { code: 'AI_JOB_PENDING' })
  assert.equal(reads, 2)
})
