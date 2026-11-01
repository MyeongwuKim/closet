import assert from 'node:assert/strict'
import test from 'node:test'
import { getPreviewCreditDay, getPreviewRewardConfig } from './preview-credit-policy.js'

test('이전 예약·추천 캐시의 날짜 키는 한국 시간 자정을 기준으로 구분한다', () => {
  const before = getPreviewCreditDay('user', new Date('2026-10-30T14:59:59Z'))
  const after = getPreviewCreditDay('user', new Date('2026-10-30T15:00:00Z'))
  assert.equal(before.day, '2026-10-30')
  assert.equal(after.day, '2026-10-31')
  assert.equal(before.resetsAt.toISOString(), '2026-10-30T15:00:00.000Z')
  assert.notEqual(before.id, after.id)
  assert.notEqual(before.id, getPreviewCreditDay('other', new Date('2026-10-30T14:59:59Z')).id)
})

test('운영은 테스트 보상을 차단하며 실제 광고 단위가 없으면 비활성화한다', (t) => {
  const before = { NODE_ENV: process.env.NODE_ENV, ADMOB_REWARD_MODE: process.env.ADMOB_REWARD_MODE, ADMOB_REWARDED_AD_UNIT_ID: process.env.ADMOB_REWARDED_AD_UNIT_ID }
  t.after(() => { for (const [key, value] of Object.entries(before)) { if (value === undefined) delete process.env[key]; else process.env[key] = value } })
  delete process.env.ADMOB_REWARD_MODE
  process.env.NODE_ENV = 'development'
  assert.equal(getPreviewRewardConfig().mode, 'test')
  process.env.NODE_ENV = 'production'
  assert.equal(getPreviewRewardConfig().mode, 'disabled')
  process.env.ADMOB_REWARD_MODE = 'test'
  assert.equal(getPreviewRewardConfig().mode, 'disabled')
  process.env.ADMOB_REWARD_MODE = 'production'
  process.env.ADMOB_REWARDED_AD_UNIT_ID = 'ca-app-pub-3940256099942544/1712485313'
  assert.equal(getPreviewRewardConfig().mode, 'disabled')
  process.env.ADMOB_REWARDED_AD_UNIT_ID = 'ca-app-pub-1234567890123456/1234567890'
  assert.equal(getPreviewRewardConfig().mode, 'production')
})

