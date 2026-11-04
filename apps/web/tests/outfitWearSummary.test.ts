import assert from 'node:assert/strict'
import test from 'node:test'
import { createOutfitWearSummary } from '../src/features/lookbook/utils/outfitWearSummary'

const today = '2026-11-03'

function completed(date: string, temperatureC?: number | null) {
  return { date, wornAt: '2026-11-03T03:00:00.000Z', temperatureC }
}

test('착용을 확인한 오늘·지난 날짜만 중복 없이 횟수와 평균 기온 범위에 포함한다', () => {
  const summary = createOutfitWearSummary([
    completed('2026-11-01', 16.2),
    completed('2026-11-02', 20.8),
    completed('2026-11-02', 20.8),
    completed(today),
    completed('2026-11-04', -99),
  ], today)
  assert.equal(summary?.label, '오늘 착용 · 3회')
  assert.equal(summary?.temperatureLabel, '16~21℃에 입었어요')
})

test('지난 배정만 있고 wornAt이 없거나 null이면 착용 기록과 기온을 만들지 않는다', () => {
  assert.equal(createOutfitWearSummary([
    { date: '2026-11-01', temperatureC: 99 },
    { date: '2026-11-02', wornAt: null, temperatureC: -99 },
  ], today), null)
})

test('착용 확인이 없는 배정의 온도와 잘못된 완료 시각은 집계에서 제외한다', () => {
  const summary = createOutfitWearSummary([
    completed('2026-11-01', 16.2),
    { date: '2026-11-02', temperatureC: 99 },
    { date: today, wornAt: 'invalid', temperatureC: -99 },
    { date: today, wornAt: '', temperatureC: 50 },
  ], today)
  assert.equal(summary?.label, '2일 전 착용')
  assert.equal(summary?.temperatureLabel, '16℃에 입었어요')
  assert.equal(summary?.title, '착용 기록: 11월 1일')
})

test('기온이 없던 완료 기록은 범위에서 제외하고 하루만 있으면 단일 온도를 표시한다', () => {
  const summary = createOutfitWearSummary([
    completed('2026-11-01', null),
    completed('2026-11-02', 0),
  ], today)
  assert.equal(summary?.temperatureLabel, '0℃에 입었어요')
  assert.match(summary!.label, /2회/)
})

test('영하 기온과 누락·잘못된 기온을 구분한다', () => {
  const summary = createOutfitWearSummary([
    completed('2026-10-28', -4.2),
    completed('2026-10-29', -0.8),
    completed('2026-10-30', NaN),
    completed('2026-10-31', Infinity),
    completed('2026-11-01'),
  ], today)
  assert.equal(summary?.temperatureLabel, '-4~-1℃에 입었어요')
})

test('온도가 없는 완료 기록과 미래 일정에는 기온을 추정하지 않는다', () => {
  assert.equal(createOutfitWearSummary([completed('2026-11-02')], today)?.temperatureLabel, undefined)
  assert.equal(createOutfitWearSummary([{ date: '2026-11-04', temperatureC: 18 }], today)?.temperatureLabel, undefined)
  assert.equal(createOutfitWearSummary([], today), null)
})

test('착용 완료를 취소하면 남은 완료 날짜만으로 횟수와 온도 범위가 바뀐다', () => {
  const first = completed('2026-11-01', 8)
  const second = completed('2026-11-02', 19)
  assert.equal(createOutfitWearSummary([first, second], today)?.temperatureLabel, '8~19℃에 입었어요')
  const summary = createOutfitWearSummary([{ ...first, wornAt: null }, second], today)
  assert.equal(summary?.temperatureLabel, '19℃에 입었어요')
  assert.equal(summary?.label, '어제 착용')
  assert.equal(createOutfitWearSummary([{ ...first, wornAt: null }, { ...second, wornAt: null }], today), null)
})

test('오늘 배정은 예정으로 표시하고 날짜가 지나도 자동으로 착용에 포함하지 않는다', () => {
  const records = [{ date: today, temperatureC: null }]
  const planned = createOutfitWearSummary(records, today)
  assert.equal(planned?.label, '착용 예정 · 11월 3일')
  assert.equal(planned?.temperatureLabel, undefined)
  assert.equal(createOutfitWearSummary(records, '2026-11-04'), null)
})

test('확인하지 않은 지난 배정은 건너뛰고 다음 오늘·미래 일정을 표시한다', () => {
  const records = [{ date: '2026-11-02' }, { date: today }, { date: '2026-11-04' }]
  const summary = createOutfitWearSummary(records, today)
  assert.equal(summary?.label, '착용 예정 · 11월 3일')
  assert.equal(summary?.temperatureLabel, undefined)
})

test('미래에 잘못된 착용 확인이 남아 있어도 현재 횟수에는 포함하지 않는다', () => {
  const summary = createOutfitWearSummary([completed('2026-11-04', 99)], today)
  assert.equal(summary?.label, '착용 예정 · 11월 4일')
  assert.equal(summary?.temperatureLabel, undefined)
})
