import assert from 'node:assert/strict'
import test from 'node:test'
import { getKoreaTodayUtc } from '../wardrobe/wardrobe.service.js'
import { weatherService } from './weather.service.js'

function daysAgo(days: number) { return new Date(getKoreaTodayUtc().getTime() - days * 86_400_000).toISOString().slice(0, 10) }

test('어제 기온은 현재 기온과 분리해 하루 평균값을 읽는다', async (t) => {
  const date = daysAgo(1)
  t.mock.method(globalThis, 'fetch', async (input: URL) => {
    assert.equal(input.searchParams.get('start_date'), date)
    assert.equal(input.searchParams.get('end_date'), date)
    assert.equal(input.searchParams.get('timezone'), 'Asia/Seoul')
    assert.equal(input.searchParams.has('current'), false)
    return Response.json({ current: { temperature_2m: 999 }, daily: { time: [date], temperature_2m_mean: [0] } })
  })
  assert.equal(await weatherService.getPastDailyTemperature({ latitude: 37.5, longitude: 127, date }), 0)
})

test('오래된 착용일은 과거 날씨 API를 조회한다', async (t) => {
  const date = daysAgo(30)
  t.mock.method(globalThis, 'fetch', async (input: URL) => {
    assert.match(input.pathname, /archive/)
    return Response.json({ daily: { time: [date], temperature_2m_mean: [-2.3] } })
  })
  assert.equal(await weatherService.getPastDailyTemperature({ latitude: 37.5, longitude: 127, date }), -2.3)
})

test('오늘·미래와 날짜 누락·빈 기온·제공자 오류를 저장 가능한 값으로 취급하지 않는다', async (t) => {
  const input = { latitude: 37.5, longitude: 127, date: daysAgo(0) }
  await assert.rejects(weatherService.getPastDailyTemperature(input))
  await assert.rejects(weatherService.getPastDailyTemperature({ ...input, date: daysAgo(-1) }))
  t.mock.method(globalThis, 'fetch', async () => Response.json({ daily: { time: [daysAgo(1)], temperature_2m_mean: [null] } }))
  await assert.rejects(weatherService.getPastDailyTemperature({ ...input, date: daysAgo(1) }))
  await assert.rejects(weatherService.getPastDailyTemperature({ ...input, date: daysAgo(2) }))
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }))
  await assert.rejects(weatherService.getPastDailyTemperature({ ...input, date: daysAgo(1) }))
})
