import assert from 'node:assert/strict'
import test from 'node:test'
import { getRediscoveryReason, parseRediscoveryImpressions, rankRediscoveryCandidates, type RediscoveryCandidate } from './wardrobe-rediscovery.rules.js'

const today = new Date('2026-11-04T00:00:00Z')
const id = (number: number) => number.toString(16).padStart(24, '0')
function item(number: number, overrides: Partial<RediscoveryCandidate> = {}): RediscoveryCandidate {
  return { id: id(number), category: 'top', seasons: ['autumn'], classificationStatus: 'classified', createdAt: new Date('2025-01-01'), ...overrides }
}

test('새 옷·최근 착용·분석 중·계절 미지정·추천 불가 카테고리를 제외한다', () => {
  const candidates = [item(1), item(2, { createdAt: new Date('2026-11-01') }), item(3),
    item(4, { classificationStatus: 'pending' }), item(5, { seasons: [] }), item(6, { category: 'other' }), item(7, { category: null })]
  const wear = new Map([[id(3), { wearCount: 1, lastWornAt: new Date('2026-11-03') }]])
  assert.deepEqual(rankRediscoveryCandidates(candidates, wear, {}, today).map((entry) => entry.id), [id(1)])
})

test('노출 이력이 없는 옷은 현재 계절과 오래된 등록일을 우선한다', () => {
  const candidates = [item(1, { seasons: ['summer'] }), item(2, { createdAt: new Date('2025-03-01') }), item(3)]
  assert.deepEqual(rankRediscoveryCandidates(candidates, new Map(), {}, today).map((entry) => entry.id), [id(3), id(2), id(1)])
  assert.deepEqual(candidates.map((entry) => entry.id), [id(1), id(2), id(3)])
})

test('노출된 옷을 뒤로 보내 전체 후보가 먼저 한 번씩 돌아가게 한다', () => {
  const candidates = Array.from({ length: 9 }, (_, index) => item(index + 1))
  const impressions: Record<string, string> = {}
  const shown = new Set<string>()
  for (let day = 4; day <= 6; day += 1) {
    const date = new Date(`2026-11-0${day}`)
    const batch = rankRediscoveryCandidates(candidates, new Map(), impressions, date).slice(0, 3)
    for (const entry of batch) {
      assert.ok(!shown.has(entry.id))
      shown.add(entry.id)
      impressions[entry.id] = date.toISOString().slice(0, 10)
    }
  }
  assert.equal(shown.size, 9)
})

test('모든 옷을 보여준 뒤에는 가장 오래전에 보여준 옷부터 다시 고른다', () => {
  const impressions = { [id(1)]: '2026-11-03', [id(2)]: '2026-11-01', [id(3)]: '2026-11-02' }
  assert.deepEqual(rankRediscoveryCandidates([item(1), item(2), item(3)], new Map(), impressions, today).map((entry) => entry.id), [id(2), id(3), id(1)])
})

test('착용 기록이 없다는 설명과 실제 마지막 기록의 경과일을 구분한다', () => {
  assert.deepEqual(getRediscoveryReason(undefined, today), { reason: 'no_wear_record', daysSinceLastWorn: null })
  assert.deepEqual(getRediscoveryReason({ wearCount: 2, lastWornAt: new Date('2026-09-05') }, today), { reason: 'long_unworn', daysSinceLastWorn: 60 })
})

test('손상된 노출 이력은 무시하고 유효한 다른 옷의 기록은 보존한다', () => {
  assert.deepEqual(parseRediscoveryImpressions({ [id(1)]: '2026-11-03', [id(2)]: 1, unexpected: '2026-11-01' }), { [id(1)]: '2026-11-03' })
  assert.deepEqual(parseRediscoveryImpressions(null), {})
})
