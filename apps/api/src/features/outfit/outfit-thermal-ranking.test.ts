import assert from 'node:assert/strict'
import test from 'node:test'
import type { ThermalRecommendationContext } from '@closet/types'
import { buildOutfitCombinations, type StyleRuleItem } from './outfit-style-rules.js'

const context = (direction: ThermalRecommendationContext['direction']): ThermalRecommendationContext => ({
  revision: 'test-thermal', direction, strength: 0.6, sampleCount: 8,
})

function item(id: string, category: 'top' | 'bottom' | 'outer', warmth: 'light' | 'medium' | 'heavy', colorHex = '#334455'): StyleRuleItem {
  return {
    id, name: id, category, subcategory: '기본 옷', colorName: '블루', colorHex, colorMode: 'solid', wearCount: 0, lastWornAt: null,
    fashionAttributes: {
      layerRole: category === 'top' ? 'base' : category === 'outer' ? 'outer' : 'single',
      silhouette: 'regular', pattern: 'solid', material: 'cotton', texture: 'smooth', warmth, formality: 0.5, confidence: 0.95,
    },
  }
}

test('같은 날씨·색감에서 추웠던 기록은 보온감 있는 옷을, 더웠던 기록은 가벼운 옷을 우선한다', () => {
  const items = [item('light-top', 'top', 'light'), item('medium-top', 'top', 'medium'), item('bottom', 'bottom', 'light')]
  const baseline = buildOutfitCombinations(items, 'spring', undefined, 23)
  const warmer = buildOutfitCombinations(items, 'spring', undefined, 23, 'auto', context('warmer'))
  const cooler = buildOutfitCombinations(items, 'spring', undefined, 23, 'auto', context('cooler'))
  assert.ok(baseline[0].items.some((entry) => entry.id === 'light-top'))
  assert.ok(warmer[0].items.some((entry) => entry.id === 'medium-top'))
  assert.ok(cooler[0].items.some((entry) => entry.id === 'light-top'))
})

test('후보가 많아도 체감에 맞는 옷이 역할별 후보 제한에서 먼저 밀리지 않는다', () => {
  const items = [
    ...Array.from({ length: 12 }, (_, index) => item(`light-${index}`, 'top', 'light')),
    item('warm-choice', 'top', 'medium'), item('bottom', 'bottom', 'light'),
  ]
  const result = buildOutfitCombinations(items, 'spring', undefined, 23, 'auto', context('warmer'))
  assert.ok(result[0].items.some((entry) => entry.id === 'warm-choice'))
})

test('개인 체감으로 덥고 무거운 옷의 기존 날씨 제외 조건을 우회하지 않는다', () => {
  const items = [item('light-top', 'top', 'light'), item('heavy-top', 'top', 'heavy'), item('bottom', 'bottom', 'light'), item('coat', 'outer', 'heavy')]
  const result = buildOutfitCombinations(items, 'summer', undefined, 30, 'auto', context('warmer'))
  assert.ok(result.length > 0)
  assert.ok(result.every((combination) => combination.items.every((entry) => !['heavy-top', 'coat'].includes(entry.id))))
})

test('중립·근거 없는 추천은 기존 순위를 그대로 유지하고 기준 옷도 빠지지 않는다', () => {
  const items = [item('light-top', 'top', 'light'), item('medium-top', 'top', 'medium'), item('bottom', 'bottom', 'light')]
  assert.deepEqual(buildOutfitCombinations(items, 'spring', undefined, 23, 'auto', context('neutral')), buildOutfitCombinations(items, 'spring', undefined, 23))
  const withBase = buildOutfitCombinations(items, 'spring', 'light-top', 23, 'auto', context('warmer'))
  assert.ok(withBase.every((combination) => combination.items.some((entry) => entry.id === 'light-top')))
})

test('선택한 색감 조합이 없어 기본 추천으로 돌아가도 개인 체감은 유지한다', () => {
  const items = [item('light-blue', 'top', 'light', '#1269CB'), item('medium-blue', 'top', 'medium', '#1269CB'), item('red-bottom', 'bottom', 'light', '#D22A2A')]
  const result = buildOutfitCombinations(items, 'spring', undefined, 23, 'achromatic', context('warmer'))
  assert.ok(result[0].items.some((entry) => entry.id === 'medium-blue'))
})
