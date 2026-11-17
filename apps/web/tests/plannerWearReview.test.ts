import assert from 'node:assert/strict'
import test from 'node:test'
import type { PlanEntry } from '../src/features/plan/data/weeklyPlan'
import { findWearReviewEntry, parseWearReviewState, wearReviewEntryKey, wearReviewRange } from '../src/features/plan/utils/plannerWearReview'

const today = '2026-01-02'
const entry = (date: string, outfitId = 'outfit', wornAt: string | null = null) => ({ date, outfitId, wornAt }) as PlanEntry

test('확인 범위는 한국 날짜의 이전 7일이며 연도를 넘어도 오늘·미래는 포함하지 않는다', () => {
  assert.deepEqual(wearReviewRange(today), { from: '2025-12-26', to: '2026-01-01' })
  const records = [entry(today), entry('2026-01-03'), entry('2025-12-25'), entry('2026-01-01', 'confirmed', '2026-01-01T00:00:00Z'), entry('2025-12-31')]
  assert.equal(findWearReviewEntry(records, today, [])?.date, '2025-12-31')
  assert.equal(findWearReviewEntry(records, today, ['2025-12-31:outfit']), undefined)
})

test('같은 날짜의 교체 코디는 이전 코디의 넘김 기록으로 숨기지 않는다', () => {
  const previous = entry('2026-01-01', 'previous')
  const replacement = entry('2026-01-01', 'replacement')
  assert.equal(findWearReviewEntry([replacement], today, [wearReviewEntryKey(previous)]), replacement)
})

test('넘김 기록은 지난 후보만 보관하고 손상·만료된 값은 버린다', () => {
  assert.deepEqual(parseWearReviewState('broken', today), { day: null, dismissed: [] })
  assert.deepEqual(parseWearReviewState(JSON.stringify({ day: today, dismissed: ['2026-01-01:outfit', '2025-12-01:old', '2026-01-03:future', null] }), today), {
    day: today, dismissed: ['2026-01-01:outfit'],
  })
  assert.equal(parseWearReviewState(JSON.stringify({ day: today, dismissed: [] }), '2026-01-03').day, null)
})
