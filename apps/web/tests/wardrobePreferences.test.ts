import assert from 'node:assert/strict'
import test from 'node:test'
import { canReuseWardrobeRecommendation, getKoreaDate, isWardrobeRecommendationPaused } from '@closet/types/wardrobe-preferences'

test('보류 설정은 한국 날짜의 재개일부터 자동으로 해제되고 사이즈 문제는 계속 보류한다', () => {
  const item = { wearAvoidanceReason: 'temporarily_unused', recommendationResumeOn: '2026-11-15' }
  assert.equal(isWardrobeRecommendationPaused(item, '2026-11-14'), true)
  assert.equal(isWardrobeRecommendationPaused(item, '2026-11-15'), false)
  assert.equal(isWardrobeRecommendationPaused({ wearAvoidanceReason: 'fit_issue' }, '2027-01-01'), true)
  assert.equal(getKoreaDate(new Date('2026-11-14T15:00:00Z')), '2026-11-15')
})

test('과거 추천 안의 복사본 대신 현재 옷장의 보류 상태로 복원을 판단한다', () => {
  const history = [{ id: 'shirt' }, { id: 'pants' }]
  const current = [{ id: 'shirt', wearAvoidanceReason: 'fit_issue' }, { id: 'pants' }]
  assert.equal(canReuseWardrobeRecommendation(history, current, '2026-11-14'), false)
  assert.equal(canReuseWardrobeRecommendation(history, current, '2026-11-14', ['shirt']), true)
  assert.equal(canReuseWardrobeRecommendation(history, current.slice(0, 1), '2026-11-14', ['shirt']), false)
  assert.deepEqual(history, [{ id: 'shirt' }, { id: 'pants' }])
})
