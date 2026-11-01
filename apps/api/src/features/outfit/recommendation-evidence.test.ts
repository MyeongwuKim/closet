import assert from 'node:assert/strict'
import test from 'node:test'
import type { StyleRuleItem } from './outfit-style-rules.js'
import { getObservedRecommendationAttributes, hasGroundedFitDescription } from './recommendation-evidence.js'

const item: StyleRuleItem = { id: 'top', name: '네이비 티셔츠', category: 'top', subcategory: '반팔', colorName: '네이비', colorHex: '#334354', colorMode: 'solid', wearCount: 0, lastWornAt: null }
const attributes = { layerRole: 'base', silhouette: 'regular', pattern: 'solid', material: 'cotton', warmth: 'light', formality: 0.3, confidence: 0.9 }

test('저장된 분석이 없는 옷의 보조 추정 핏을 관찰값으로 AI에 보내지 않는다', () => {
  assert.equal(getObservedRecommendationAttributes(item), null)
  assert.equal(getObservedRecommendationAttributes({ ...item, fashionAttributes: { ...attributes, confidence: 0.35 } }), null)
  assert.equal(hasGroundedFitDescription('어깨와 가슴선에 맞는 기본 핏이에요.', [item]), false)
  assert.equal(hasGroundedFitDescription('네이비와 베이지의 명도 차이가 있어요.', [item]), true)
})

test('확신도 높은 관찰값과 이름에 명시한 핏은 설명 근거로 쓸 수 있다', () => {
  assert.equal(getObservedRecommendationAttributes({ ...item, fashionAttributes: attributes })?.silhouette, 'regular')
  assert.equal(hasGroundedFitDescription('기본 핏을 비교했어요.', [{ ...item, fashionAttributes: attributes }]), true)
  assert.equal(hasGroundedFitDescription('와이드 핏을 연결해요.', [{ ...item, name: '와이드 팬츠' }]), true)
})
