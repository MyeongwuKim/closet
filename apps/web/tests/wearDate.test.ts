import assert from 'node:assert/strict'
import test from 'node:test'
import { formatRecentWearLabel, isRecentlyWorn } from '../src/utils/wearDate'

const today = '2026-08-26'

test('최근 착용은 오늘과 기간 경계일을 포함하고 더 오래됐거나 유효하지 않은 기록은 제외한다', () => {
  for (const wornDate of [today, '2026-08-23T00:00:00.000Z']) {
    assert.equal(isRecentlyWorn(wornDate, 3, today), true)
  }
  for (const wornDate of ['2026-08-22', '2026-08-27', '2026-02-30', undefined]) {
    assert.equal(isRecentlyWorn(wornDate, 3, today), false)
  }
})

test('오늘부터 일주일까지 최근 착용일을 상대 날짜로 표시한다', () => {
  assert.equal(formatRecentWearLabel('2026-08-26', today), '오늘 착용')
  assert.equal(formatRecentWearLabel('2026-08-25', today), '어제 착용')
  assert.equal(formatRecentWearLabel('2026-08-23', today), '3일 전 착용')
  assert.equal(formatRecentWearLabel('2026-08-19', today), '일주일 전 착용')
})

test('일주일보다 오래된 착용일은 실제 날짜로 표시한다', () => {
  assert.equal(
    formatRecentWearLabel('2026-08-11', today),
    '최근 착용 · 8월 11일',
  )
})

test('ISO 형식의 아이템 착용일도 날짜만 비교한다', () => {
  assert.equal(
    formatRecentWearLabel('2026-08-23T00:00:00.000Z', today),
    '3일 전 착용',
  )
})
