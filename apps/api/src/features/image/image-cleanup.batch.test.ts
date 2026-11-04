import assert from 'node:assert/strict'
import test from 'node:test'
import { createImageCleanupBatch } from './image-cleanup.batch.js'

const now = new Date('2026-11-05T03:00:00.000Z')
const candidate = (id: string, date: string) => ({ id, createdAt: new Date(date) })
const result = (count: number) => ({ candidateCount: count, deletedCount: count, failedAssetIds: [] as string[] })

function fixture(generated: ReturnType<typeof candidate>[], wardrobe: ReturnType<typeof candidate>[]) {
  const calls: Array<{ kind: string; limit: number }> = []
  const batch = createImageCleanupBatch({
    findGeneratedCandidates: async (_now, limit) => generated.slice(0, limit),
    findWardrobeCandidates: async (_now, limit) => wardrobe.slice(0, limit),
    cleanupGenerated: async (options) => { calls.push({ kind: 'generated', limit: options.limit }); return result(options.limit) },
    cleanupWardrobe: async (options) => { calls.push({ kind: 'wardrobe', limit: options.limit }); return result(options.limit) },
  })
  return { batch, calls }
}

test('limit 1에서도 더 오래된 삭제 옷 사진이 생성 이미지 적체에 밀리지 않는다', async () => {
  const f = fixture(Array.from({ length: 100 }, (_, index) => candidate(`g-${index}`, '2026-11-03')), [candidate('old-wardrobe', '2026-10-01')])
  const actual = await f.batch.cleanup({ execute: true, limit: 1, now })
  assert.deepEqual(f.calls, [{ kind: 'wardrobe', limit: 1 }])
  assert.equal(actual.candidateCount, 1)
  assert.equal(actual.generated.candidateCount, 0)
})

test('두 종류를 합한 후보 한도 안에서 날짜와 ID순으로 처리 예산을 나눈다', async () => {
  const f = fixture([candidate('b', '2026-10-01'), candidate('d', '2026-10-02')], [candidate('a', '2026-10-01'), candidate('c', '2026-10-02')])
  const actual = await f.batch.cleanup({ execute: true, limit: 3, now })
  assert.deepEqual(f.calls, [{ kind: 'generated', limit: 1 }, { kind: 'wardrobe', limit: 2 }])
  assert.equal(actual.candidateCount, 3)
  assert.equal(actual.deletedCount, 3)
})

test('한 종류가 없으면 다른 종류에 전체 한도를 배정한다', async () => {
  for (const kind of ['generated', 'wardrobe']) {
    const photos = Array.from({ length: 5 }, (_, index) => candidate(`photo-${index}`, '2026-10-01'))
    const f = fixture(kind === 'generated' ? photos : [], kind === 'wardrobe' ? photos : [])
    const actual = await f.batch.cleanup({ execute: true, limit: 4, now })
    assert.deepEqual(f.calls, [{ kind, limit: 4 }])
    assert.equal(actual.candidateCount, 4)
  }
})

test('dry-run은 같은 전역 선택 결과만 보고하고 삭제 서비스는 호출하지 않는다', async () => {
  const f = fixture([candidate('generated', '2026-10-01')], [candidate('wardrobe', '2026-10-02')])
  const actual = await f.batch.cleanup({ execute: false, limit: 2, now })
  assert.deepEqual(actual, {
    generated: { candidateCount: 1, deletedCount: 0, failedAssetIds: [] },
    wardrobe: { candidateCount: 1, deletedCount: 0, failedAssetIds: [] },
    candidateCount: 2, deletedCount: 0, failedAssetIds: [],
  })
  assert.deepEqual(f.calls, [])
})

test('조회 후 참조가 바뀌어 실제 처리 수가 줄어도 다른 종류에 초과 예산을 배정하지 않는다', async () => {
  const budgets: number[] = []
  const batch = createImageCleanupBatch({
    findGeneratedCandidates: async () => [candidate('g', '2026-10-01')],
    findWardrobeCandidates: async () => [candidate('w', '2026-10-01')],
    cleanupGenerated: async ({ limit }) => { budgets.push(limit); return result(0) },
    cleanupWardrobe: async ({ limit }) => { budgets.push(limit); return { ...result(limit), failedAssetIds: ['failed'] } },
  })
  const actual = await batch.cleanup({ execute: true, limit: 2, now })
  assert.deepEqual(budgets, [1, 1])
  assert.equal(actual.candidateCount, 1)
  assert.deepEqual(actual.failedAssetIds, ['failed'])
})
