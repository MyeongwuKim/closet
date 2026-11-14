import assert from 'node:assert/strict'
import test from 'node:test'
import { createWearHistoryPath, formatTemperatureWearDate, formatWearTemperature, readTemperatureFilter, readWearHistoryDate } from '../src/features/wear-history/utils/temperatureHistory'

test('기온 미기록과 0℃를 구분하며 음수·소수도 표시한다', () => {
  assert.equal(formatWearTemperature(null), '기온 미기록')
  assert.equal(formatWearTemperature(0), '평균 0℃')
  assert.equal(formatWearTemperature(-3.25), '평균 -3.2℃')
  assert.equal(formatTemperatureWearDate('2024-11-03'), '2024년 11월 3일')
})

test('기준 예보가 없거나 잘못됐으면 임의의 기온으로 조회하지 않는다', () => {
  for (const value of ['', 'invalid', 'Infinity', '1000']) {
    const filter = readTemperatureFilter(new URLSearchParams({ range: 'near', temperature: value }))
    assert.equal(filter.value, 'all')
    assert.deepEqual(filter.input, {})
  }
  assert.deepEqual(readTemperatureFilter(new URLSearchParams({ range: 'near', temperature: '16' })).input, { minTemperatureC: 13, maxTemperatureC: 19 })
  assert.deepEqual(readTemperatureFilter(new URLSearchParams({ range: 'unknown' })).input, { unrecordedOnly: true })
})

test('복귀 경로·선택 날짜를 보존하고 외부 경로와 존재하지 않는 날짜를 거절한다', () => {
  const url = new URL(createWearHistoryPath('/plan?view=today&date=2026-11-14', '2026-11-14', 0), 'https://closet.test')
  assert.equal(url.searchParams.get('from'), '/plan?view=today&date=2026-11-14')
  assert.equal(url.searchParams.get('date'), '2026-11-14')
  assert.equal(url.searchParams.get('temperature'), '0')
  assert.equal(new URL(createWearHistoryPath('//external.test'), 'https://closet.test').searchParams.get('from'), '/lookbook')
  assert.equal(readWearHistoryDate('2026-02-31', '2026-11-13'), '2026-11-13')
  assert.equal(readWearHistoryDate('2024-02-29', '2026-11-13'), '2024-02-29')
})
