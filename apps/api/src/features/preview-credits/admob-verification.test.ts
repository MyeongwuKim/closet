import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import test from 'node:test'
import { verifyAdmobReward } from './admob-verification.js'

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const keys = async () => [{ keyId: 123, pem: publicKey.export({ type: 'spki', format: 'pem' }).toString() }]
const now = Date.now()
const session = 'session-test-123'
const content = `ad_network=network&ad_unit=unit&custom_data=${session}&reward_amount=1&reward_item=preview&timestamp=${now}&transaction_id=transaction-123&user_id=${session}`
function callback(value = content) {
  return `/ads/admob/reward?${value}&signature=${sign('sha256', Buffer.from(value), privateKey).toString('base64url')}&key_id=123`
}

test('Google 방식의 원본 바이트와 ECDSA 서명이 일치할 때만 광고 번호를 반환한다', async () => {
  const reward = await verifyAdmobReward(callback(), keys, now)
  assert.equal(reward.sessionId, session)
  assert.equal(reward.transactionId, 'transaction-123')
  assert.equal(reward.eventAt.getTime(), now)
})

test('서명 뒤 광고 단위·지급량·계정 번호를 바꾸거나 필드를 중복하면 거절한다', async () => {
  for (const url of [callback().replace('ad_unit=unit', 'ad_unit=other'), callback(content.replace('reward_amount=1', 'reward_amount=9')), callback(`${content}&custom_data=other-session`), callback(content.replace(`user_id=${session}`, 'user_id=other-session')), callback().replace('key_id=123', 'key_id=999')]) {
    await assert.rejects(verifyAdmobReward(url, keys, now), { code: 'INVALID_AD_REWARD' })
  }
})

test('재생 공격을 줄이기 위해 24시간 전·미래 이벤트와 서명 뒤 추가 필드를 거절한다', async () => {
  for (const url of [callback(content.replace(`timestamp=${now}`, `timestamp=${now - 86_400_001}`)), callback(content.replace(`timestamp=${now}`, `timestamp=${now + 300_001}`)), `${callback()}&extra=value`]) {
    await assert.rejects(verifyAdmobReward(url, keys, now), { code: 'INVALID_AD_REWARD' })
  }
})
