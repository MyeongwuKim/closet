import assert from 'node:assert/strict'
import test from 'node:test'
import { previewRequestKey, readPendingPreview, writePendingPreview } from '../src/features/lookbook/utils/pendingPreviewRequest'
import { clearCompletedPendingPreview, clearCompletedPreviewPointer, getCompletedPreviewSnapshot, isCompletedPreviewUnavailable, parseCompletedPreviewPointer, readCompletedPreviewPointer, writeCompletedPreviewPointer } from '../src/features/lookbook/utils/completedPreviewPointer'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

const key = previewRequestKey('viewer-one', ['top', 'bottom'], 'casual')
const pointer = () => ({ jobId: 'job-one', assetId: 'asset-one', recordedAt: Date.now() - 1000, jobCreatedAt: '2026-11-03T00:00:00.000Z' })

test('완료 포인터는 계정·정규화된 조합·스타일별로 복원한다', () => {
  const storage = new MemoryStorage()
  const value = pointer()
  writeCompletedPreviewPointer(key, value, storage)
  assert.deepEqual(readCompletedPreviewPointer(previewRequestKey('viewer-one', ['bottom', 'top', 'top'], ' casual '), storage), value)
  assert.equal(readCompletedPreviewPointer(previewRequestKey('viewer-two', ['top', 'bottom'], 'casual'), storage), null)
  assert.equal(readCompletedPreviewPointer(previewRequestKey('viewer-one', ['top', 'bottom'], 'formal'), storage), null)
  assert.equal(readCompletedPreviewPointer(previewRequestKey('viewer-one', ['other', 'bottom'], 'casual'), storage), null)
})

test('이미지 URL·본문을 전달해도 로컬에는 작업과 asset 번호·시각만 저장한다', () => {
  const storage = new MemoryStorage()
  const value = { ...pointer(), imageUrl: 'https://example.test/signed-image?secret=one', imageBase64: 'private-image' }
  writeCompletedPreviewPointer(key, value, storage)
  const snapshot = getCompletedPreviewSnapshot(key, storage)!
  assert.doesNotMatch(snapshot, /imageUrl|signed-image|secret|imageBase64|private-image/)
  assert.deepEqual(Object.keys(JSON.parse(snapshot)).sort(), ['assetId', 'jobCreatedAt', 'jobId', 'recordedAt'])
})

test('같은 완료 결과를 다시 기록해도 보관 시작 시각을 연장하지 않는다', () => {
  const storage = new MemoryStorage()
  const first = pointer()
  writeCompletedPreviewPointer(key, first, storage)
  writeCompletedPreviewPointer(key, { ...first, recordedAt: Date.now() }, storage)
  assert.equal(readCompletedPreviewPointer(key, storage)?.recordedAt, first.recordedAt)
  const newer = { ...first, jobId: 'job-two', assetId: 'asset-two', recordedAt: Date.now() }
  writeCompletedPreviewPointer(key, newer, storage)
  assert.deepEqual(readCompletedPreviewPointer(key, storage), newer)
})

test('완료 포인터는 하루·한 달이 지나도 기간만으로 지우지 않는다', () => {
  const storage = new MemoryStorage()
  const value = { ...pointer(), recordedAt: 100 }
  writeCompletedPreviewPointer(key, value, storage)
  assert.deepEqual(readCompletedPreviewPointer(key, storage, 100 + 86_400_000), value)
  assert.deepEqual(readCompletedPreviewPointer(key, storage, 100 + 31 * 86_400_000), value)
  assert.ok(getCompletedPreviewSnapshot(key, storage))
})

test('손상·미래 시각·비정상 번호 포인터는 사용하지 않는다', () => {
  for (const snapshot of ['{bad', '[]', 'null', JSON.stringify({ jobId: '', assetId: 'asset', recordedAt: 10 }), JSON.stringify({ jobId: 'job', assetId: 'asset', recordedAt: 1000 }), JSON.stringify({ jobId: 'job', assetId: 'asset', recordedAt: 10, jobCreatedAt: 'invalid' })]) {
    assert.equal(parseCompletedPreviewPointer(snapshot, 100), null)
  }
})

test('만료·소유권 거절을 정리해도 다른 조합의 완료 기록은 남긴다', () => {
  const storage = new MemoryStorage()
  const otherKey = previewRequestKey('viewer-one', ['other', 'bottom'], 'casual')
  writeCompletedPreviewPointer(key, pointer(), storage)
  writeCompletedPreviewPointer(otherKey, { ...pointer(), assetId: 'asset-other' }, storage)
  clearCompletedPreviewPointer(key, storage)
  assert.equal(readCompletedPreviewPointer(key, storage), null)
  assert.equal(readCompletedPreviewPointer(otherKey, storage)?.assetId, 'asset-other')
})

test('일시 통신 오류와 서버가 확정한 이미지 부재·만료·거절을 구분한다', () => {
  assert.equal(isCompletedPreviewUnavailable(new Error('네트워크 오류')), false)
  assert.equal(isCompletedPreviewUnavailable({ code: 'INTERNAL_SERVER_ERROR' }), false)
  for (const code of ['OUTFIT_PREVIEW_NOT_FOUND', 'OUTFIT_PREVIEW_EXPIRED', 'FORBIDDEN', 'UNAUTHENTICATED']) {
    assert.equal(isCompletedPreviewUnavailable({ code }), true)
  }
})

test('저장소를 사용할 수 없어도 완료 기록 처리는 예외를 던지지 않는다', () => {
  assert.equal(readCompletedPreviewPointer(key, null), null)
  assert.doesNotThrow(() => writeCompletedPreviewPointer(key, pointer(), null))
  assert.doesNotThrow(() => clearCompletedPreviewPointer(key, null))
})

test('완료 이미지 확인·폐기 후에는 그 작업의 pending만 정리한다', () => {
  const storage = new MemoryStorage()
  writePendingPreview(key, { requestId: 'request-one', jobId: 'job-one', createdAt: Date.now() }, storage)
  clearCompletedPendingPreview(key, 'job-one', storage)
  assert.equal(readPendingPreview(key, storage), null)
  writePendingPreview(key, { requestId: 'request-two', jobId: 'job-two', createdAt: Date.now() }, storage)
  clearCompletedPendingPreview(key, 'job-one', storage)
  assert.equal(readPendingPreview(key, storage)?.jobId, 'job-two')
  writePendingPreview(key, { requestId: 'not-yet-accepted', createdAt: Date.now() }, storage)
  clearCompletedPendingPreview(key, 'job-one', storage)
  assert.equal(readPendingPreview(key, storage)?.requestId, 'not-yet-accepted')
})

test('작업 번호가 없는 영속 이미지도 asset 번호와 생성 시각으로 보관한다', () => {
  const storage = new MemoryStorage()
  const value = { assetId: 'legacy-asset', recordedAt: Date.now(), createdAt: '2026-01-01T00:00:00.000Z' }
  writeCompletedPreviewPointer(key, value, storage)
  assert.deepEqual(readCompletedPreviewPointer(key, storage), value)
  assert.deepEqual(parseCompletedPreviewPointer(JSON.stringify({ ...value, jobId: null })), value)
  assert.equal(parseCompletedPreviewPointer(JSON.stringify({ ...value, createdAt: 'invalid' })), null)
})

test('같은 asset의 영속 조회에 작업 번호가 없으면 이미 아는 작업 번호를 보존한다', () => {
  const storage = new MemoryStorage()
  const first = pointer()
  writeCompletedPreviewPointer(key, first, storage)
  writeCompletedPreviewPointer(key, { assetId: first.assetId, recordedAt: Date.now(), createdAt: '2026-11-03T01:00:00.000Z' }, storage)
  const value = readCompletedPreviewPointer(key, storage)
  assert.equal(value?.jobId, first.jobId)
  assert.equal(value?.recordedAt, first.recordedAt)
  assert.equal(value?.createdAt, '2026-11-03T01:00:00.000Z')
})

test('다른 asset의 영속 결과에 이전 작업 번호를 붙이거나 진행 요청을 정리하지 않는다', () => {
  const storage = new MemoryStorage()
  writeCompletedPreviewPointer(key, pointer(), storage)
  writeCompletedPreviewPointer(key, { assetId: 'different-asset', recordedAt: Date.now() }, storage)
  assert.equal(readCompletedPreviewPointer(key, storage)?.jobId, undefined)
  writePendingPreview(key, { requestId: 'current-request', jobId: 'current-job', createdAt: Date.now() }, storage)
  clearCompletedPendingPreview(key, undefined, storage)
  assert.equal(readPendingPreview(key, storage)?.jobId, 'current-job')
})
