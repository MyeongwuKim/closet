import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateThermalRecommendationContext as calculate, type ThermalRecommendationEvidence } from './thermal-recommendation.rules.js'

const today = new Date('2026-11-04')
const target = new Date('2026-11-05')
const dayAgo = (days: number) => new Date(today.getTime() - days * 86_400_000)
function record(id: string, overrides: Partial<ThermalRecommendationEvidence> = {}): ThermalRecommendationEvidence {
  return { id, date: dayAgo(1), wornAt: new Date('2026-11-03T12:00:00Z'), wearFeeling: 'cold', wearTemperatureC: 15, ...overrides }
}

test('비슷한 평균 기온에 추웠던 기록은 따뜻하게, 더웠던 기록은 가볍게 보정한다', () => {
  const cold = calculate(target, 15, [record('cold')], today)
  const hot = calculate(target, 15, [record('hot', { wearFeeling: 'hot' })], today)
  assert.equal(cold.direction, 'warmer')
  assert.equal(hot.direction, 'cooler')
  assert.equal(cold.strength, hot.strength)
  assert.ok(cold.strength > 0.1 && cold.strength < 0.6)
  assert.equal(cold.sampleCount, 1)
})

test('적당했던 기록과 상반된 체감이 균형을 이루면 중립이다', () => {
  assert.equal(calculate(target, 15, [record('ok', { wearFeeling: 'comfortable' })], today).direction, 'neutral')
  const balanced = calculate(target, 15, [record('cold'), record('hot', { wearFeeling: 'hot' })], today)
  assert.equal(balanced.direction, 'neutral')
  assert.equal(balanced.strength, 0)
  assert.equal(balanced.sampleCount, 2)
})

test('먼 기온과 오래된 기록의 영향은 작고 약한 근거는 중립으로 둔다', () => {
  const recent = calculate(target, 15, [record('recent')], today)
  const distant = calculate(target, 15, [record('distant', { wearTemperatureC: 19 })], today)
  const old = calculate(target, 15, [record('old', { date: dayAgo(180) })], today)
  assert.ok(recent.strength > distant.strength)
  assert.ok(recent.strength > old.strength)
  assert.equal(distant.direction, 'neutral')
})

test('미확인·체감 없음·실제 평균 없음·오늘 이후·추천일 이후·180일 밖 기록은 제외한다', () => {
  const earlierTarget = dayAgo(2)
  const evidence = [record('valid', { date: dayAgo(3) }),
    record('unconfirmed', { wornAt: null }), record('no-feeling', { wearFeeling: null }),
    record('no-mean', { wearTemperatureC: null }), record('nan', { wearTemperatureC: NaN }),
    record('today', { date: today }), record('future', { date: dayAgo(-1) }),
    record('target', { date: earlierTarget }), record('too-old', { date: dayAgo(181) }),
    record('different-weather', { wearTemperatureC: 19.1 }), record('bad-date', { date: new Date(NaN) }),
  ]
  const context = calculate(earlierTarget, 15, evidence, today)
  assert.equal(context.sampleCount, 1)
  assert.equal(context.revision, calculate(earlierTarget, 15, [evidence[0]], today).revision)
})

test('실제 기온 영하·0도와 ±4도 경계도 유효한 기온으로 계산한다', () => {
  const zero = calculate(target, 0, [record('zero', { wearTemperatureC: 0 })], today)
  assert.equal(zero.direction, 'warmer')
  assert.equal(calculate(target, -2, [record('negative', { wearTemperatureC: -2 })], today).sampleCount, 1)
  assert.equal(calculate(target, 0, [record('minus', { wearTemperatureC: -4 }), record('plus', { wearTemperatureC: 4 })], today).sampleCount, 2)
})

test('최신 30건만 사용하며 누적 근거가 많아도 보정 강도는 0.6을 넘지 않는다', () => {
  const evidence = Array.from({ length: 40 }, (_, index) => record(`entry-${String(index).padStart(2, '0')}`, { date: dayAgo(index + 1) }))
  const context = calculate(target, 15, evidence, today)
  assert.equal(context.sampleCount, 30)
  assert.equal(context.strength, 0.6)
  const changedOldest = evidence.map((entry, index) => index === 39 ? { ...entry, wearFeeling: 'hot' as const } : entry)
  assert.equal(calculate(target, 15, changedOldest, today).revision, context.revision)
})

test('revision은 순서와 무관하고 유효 근거·기온·날짜·확인 시각이 바뀌면 달라진다', () => {
  const evidence = [record('private-entry-a'), record('private-entry-b')]
  const initial = calculate(target, 15, evidence, today)
  assert.match(initial.revision, /^[a-f\d]{64}$/)
  assert.ok(!initial.revision.includes('private-entry'))
  assert.equal(calculate(target, 15, [...evidence].reverse(), today).revision, initial.revision)
  for (const changed of [
    evidence.slice(1),
    [record('private-entry-a', { wearFeeling: 'hot' }), evidence[1]],
    [record('private-entry-a', { wearTemperatureC: 15.1 }), evidence[1]],
    [record('private-entry-a', { wornAt: new Date('2026-11-03T12:01:00Z') }), evidence[1]],
  ]) assert.notEqual(calculate(target, 15, changed, today).revision, initial.revision)
  assert.notEqual(calculate(target, 15.1, evidence, today).revision, initial.revision)
  assert.notEqual(calculate(new Date('2026-11-06'), 15, evidence, today).revision, initial.revision)
  assert.notEqual(calculate(target, 15, evidence, new Date('2026-11-05')).revision, initial.revision)
})

test('평균 기온이 없으면 전달받은 근거도 사용하지 않고 결정적인 중립값을 만든다', () => {
  const context = calculate(target, null, [record('unused')], today)
  assert.equal(context.direction, 'neutral')
  assert.equal(context.strength, 0)
  assert.equal(context.sampleCount, 0)
  assert.equal(context.revision, calculate(target, null, [], today).revision)
})
