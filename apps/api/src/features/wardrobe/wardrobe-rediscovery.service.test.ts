import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { buildApp } from '../../app.js'
import { wardrobeRepository } from './wardrobe.repository.js'
import { wardrobeRediscoveryRepository as repository } from './wardrobe-rediscovery.repository.js'
import { wardrobeRediscoveryService as service } from './wardrobe-rediscovery.service.js'

const userId = '100000000000000000000000'
const ids = Array.from({ length: 6 }, (_, index) => String(index + 1).padStart(24, '0'))

/** DB 없이 저장소 경계를 대체한다. 노출 버전 충돌과 날짜 이동은 실제 서비스 흐름으로 확인한다. */
function setup(t: TestContext) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-04T14:59:00Z') })
  let state: Awaited<ReturnType<typeof repository.findState>> = null
  const candidates = ids.map((id) => ({ id, createdAt: new Date('2025-01-01'), seasons: ['autumn' as const], category: 'top' as const, classificationStatus: 'classified' as const }))
  const metadata = t.mock.method(repository, 'findCandidates', async (owner: string) => { assert.equal(owner, userId); return candidates })
  t.mock.method(repository, 'findState', async (owner: string) => { assert.equal(owner, userId); return state ? structuredClone(state) : null })
  t.mock.method(repository, 'createState', async (_owner: string, day: string, itemIds: string[]) => {
    if (state) return false
    state = { userId, day, itemIds, impressions: {}, version: 0 }
    return true
  })
  const update = t.mock.method(repository, 'updateState', async (_owner: string, version: number, data: Parameters<typeof repository.updateState>[2]) => {
    if (!state || state.version !== version) return false
    state = { ...state, ...data, version: version + 1 }
    return true
  })
  const records: Awaited<ReturnType<typeof wardrobeRepository.findWearHistory>> = []
  t.mock.method(wardrobeRepository, 'findWearHistory', async (_owner: string, throughDate: Date) => {
    assert.equal(throughDate.getUTCHours(), 0)
    return records
  })
  t.mock.method(wardrobeRepository, 'findManyOwnedWithImagesByIds', async (owner: string, selected: string[]) => {
    assert.equal(owner, userId)
    return selected.map((id) => ({ ...candidates.find((item) => item.id === id), id, userId, name: id })) as Awaited<ReturnType<typeof wardrobeRepository.findManyOwnedWithImagesByIds>>
  })
  t.mock.method(wardrobeRepository, 'findManyOwnedByIds', async (_owner: string, selected: string[]) =>
    selected.map((id) => ({ id, userId })) as Awaited<ReturnType<typeof wardrobeRepository.findManyOwnedByIds>>)
  return { metadata, update, records, candidates, state: () => state }
}

test('전체 옷장에서 선정하고 실제 노출을 저장해도 같은 날 선택은 유지한다', async (t) => {
  const fixture = setup(t)
  const first = await service.get(userId)
  assert.equal(first.day, '2026-11-04')
  assert.deepEqual(first.items.map((entry) => entry.item.id), ids.slice(0, 3))
  assert.deepEqual(fixture.state()?.impressions, {})
  await service.markSeen(userId, first.day, ids.slice(0, 3))
  assert.deepEqual((await service.get(userId)).items.map((entry) => entry.item.id), ids.slice(0, 3))
  assert.equal(fixture.metadata.mock.calls[0].arguments.length, 1)
})

test('한국 자정 이후에는 실제 노출된 옷을 뒤로 보내고 다음 세 벌을 고른다', async (t) => {
  setup(t)
  const first = await service.get(userId)
  await service.markSeen(userId, first.day, ids.slice(0, 3))
  t.mock.timers.tick(2 * 60_000)
  const next = await service.get(userId)
  assert.equal(next.day, '2026-11-05')
  assert.deepEqual(next.items.map((entry) => entry.item.id), ids.slice(3))
})

test('첫 조회가 여러 탭에서 동시에 와도 하나의 당일 선택을 공유한다', async (t) => {
  setup(t)
  const batches = await Promise.all([service.get(userId), service.get(userId), service.get(userId)])
  assert.deepEqual(batches.map((batch) => batch.items.map((entry) => entry.item.id)), Array(3).fill(ids.slice(0, 3)))
})

test('보지 않은 옷은 노출로 처리하지 않고 다음날 다시 발견할 기회를 유지한다', async (t) => {
  setup(t)
  const first = await service.get(userId)
  await service.markSeen(userId, first.day, [ids[0]])
  t.mock.timers.tick(2 * 60_000)
  const next = await service.get(userId)
  assert.deepEqual(next.items.map((entry) => entry.item.id), ids.slice(1, 4))
})

test('선정하지 않은 ID·다른 날짜·중복·과다 입력은 저장 전에 거절한다', async (t) => {
  const fixture = setup(t)
  const { day } = await service.get(userId)
  const before = fixture.update.mock.callCount()
  for (const [date, itemIds] of [[day, [ids[5]]], ['2026-11-03', [ids[0]]], [day, []], [day, [ids[0], ids[0]]], [day, ids]] as Array<[string, string[]]>) {
    await assert.rejects(service.markSeen(userId, date, itemIds), { code: 'INVALID_WARDROBE_REDISCOVERY' })
  }
  assert.equal(fixture.update.mock.callCount(), before)
})

test('여러 탭의 동시 노출도 모두 보존하며 중복 확인은 다시 쓰지 않는다', async (t) => {
  const fixture = setup(t)
  const { day } = await service.get(userId)
  await Promise.all(ids.slice(0, 3).map((id) => service.markSeen(userId, day, [id])))
  assert.deepEqual(fixture.state()?.impressions, Object.fromEntries(ids.slice(0, 3).map((id) => [id, day])))
  const writes = fixture.update.mock.callCount()
  await service.markSeen(userId, day, ids.slice(0, 3))
  assert.equal(fixture.update.mock.callCount(), writes)
})

test('당일 선정 이후 최근 착용한 옷과 보관된 옷은 다시 표시하지 않는다', async (t) => {
  const fixture = setup(t)
  await service.get(userId)
  fixture.candidates.splice(0, 1)
  fixture.records.push({ wornAt: new Date('2026-11-04T10:00:00Z'), date: new Date('2026-11-04'), outfit: { items: [{ wardrobeItemId: ids[1] }] } })
  assert.deepEqual((await service.get(userId)).items.map((entry) => entry.item.id), [ids[2]])
})

test('하이라이트 조회와 노출 저장은 로그인 없이는 실행되지 않는다', async (t) => {
  const app = await buildApp()
  t.after(() => app.close())
  for (const query of ['query { wardrobeRediscovery { day items { reason item { id } } } }', 'mutation { markWardrobeRediscoverySeen(day: "2026-11-04", itemIds: ["000000000000000000000001"]) }']) {
    const response = await app.inject({ method: 'POST', url: '/graphql', payload: { query } })
    assert.equal(response.json().errors?.[0]?.extensions?.code, 'UNAUTHENTICATED')
  }
})
