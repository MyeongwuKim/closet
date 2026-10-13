import assert from 'node:assert/strict'
import test from 'node:test'
import type { ClothingCategory } from '@prisma/client'
import type { FashionItemAttributes } from '@closet/types'
import {
  rankOutfitMatchCandidates,
} from './outfit-recommendation-matching.js'
import type { StyleRuleItem } from './outfit-style-rules.js'

function createItem(
  id: string,
  category: ClothingCategory,
  overrides: Partial<StyleRuleItem> = {},
): StyleRuleItem {
  return {
    id,
    name: id,
    category,
    subcategory: null,
    colorName: '블랙',
    colorHex: '#242424',
    colorMode: 'solid',
    fashionAttributes: null,
    wearCount: 0,
    lastWornAt: null,
    ...overrides,
  }
}

function attributes(
  layerRole: FashionItemAttributes['layerRole'],
  overrides: Partial<FashionItemAttributes> = {},
): FashionItemAttributes {
  return {
    layerRole,
    silhouette: 'regular',
    pattern: 'solid',
    material: 'cotton',
    texture: 'smooth',
    warmth: 'medium',
    formality: 0.3,
    confidence: 0.9,
    ...overrides,
  }
}

test('같은 색이어도 실루엣과 격식감이 맞는 하의를 먼저 추천한다', () => {
  const selected = createItem('selected-top', 'top', {
    fashionAttributes: attributes('base', { silhouette: 'oversized', formality: 0.2 }),
  })
  const mismatched = createItem('mismatched', 'bottom', {
    fashionAttributes: attributes('single', { silhouette: 'oversized', formality: 0.9 }),
  })
  const balanced = createItem('balanced', 'bottom', {
    fashionAttributes: attributes('single', { silhouette: 'slim', formality: 0.25 }),
  })

  const ranked = rankOutfitMatchCandidates(
    [selected], [mismatched, balanced], ['화이트', '블랙'],
  )

  assert.deepEqual(ranked.map(({ item }) => item.id), ['balanced', 'mismatched'])
  assert.match(ranked[0].reason, /실루엣/)
  assert.equal(ranked[0].relation, 'design-balance')
})

test('무늬가 있는 기준 옷에는 단색 후보를 먼저 추천한다', () => {
  const selected = createItem('striped-top', 'top', {
    fashionAttributes: attributes('base', { pattern: 'stripe' }),
  })
  const patterned = createItem('patterned-bottom', 'bottom', {
    fashionAttributes: attributes('single', { pattern: 'check' }),
  })
  const solid = createItem('solid-bottom', 'bottom', {
    fashionAttributes: attributes('single', { pattern: 'solid' }),
  })

  const ranked = rankOutfitMatchCandidates([selected], [patterned, solid], ['블랙'])

  assert.deepEqual(ranked.map(({ item }) => item.id), ['solid-bottom', 'patterned-bottom'])
  assert.match(ranked[0].reason, /무늬.*단색/)
  assert.equal(ranked[0].relation, 'design-balance')
})

test('여유로운 핏끼리의 조합을 선호 정보 없이 감점하지 않는다', () => {
  const selected = createItem('loose-top', 'top', {
    fashionAttributes: attributes('base', { silhouette: 'oversized' }),
  })
  const loose = createItem('loose-bottom', 'bottom', {
    fashionAttributes: attributes('single', { silhouette: 'relaxed' }),
  })
  const unknown = createItem('unknown-bottom', 'bottom', {
    fashionAttributes: attributes('single', { silhouette: 'unknown' }),
  })

  const ranked = rankOutfitMatchCandidates([selected], [loose, unknown], ['블랙'])

  assert.deepEqual(ranked.map(({ item }) => item.id), ['loose-bottom', 'unknown-bottom'])
})

test('속성이 없거나 확신도가 낮으면 디자인을 단정하지 않고 색과 후보 순서를 따른다', () => {
  const selected = createItem('selected-top', 'top', {
    fashionAttributes: attributes('base', { silhouette: 'oversized' }),
  })
  const lowConfidence = createItem('low-confidence', 'bottom', {
    fashionAttributes: attributes('single', { silhouette: 'slim', confidence: 0.35 }),
  })
  const missingAttributes = createItem('missing-attributes', 'bottom')

  const ranked = rankOutfitMatchCandidates(
    [selected], [missingAttributes, lowConfidence], ['블랙'],
  )

  assert.deepEqual(ranked.map(({ item }) => item.id), ['missing-attributes', 'low-confidence'])
  assert.ok(ranked.every(({ reason }) => !/실루엣|격식감|무늬/.test(reason)))
  assert.ok(ranked.every(({ relation }) => relation !== 'design-balance'))
})

test('추천 색상 밖의 후보에 디자인 근거가 없으면 포인트 색으로 단정하지 않는다', () => {
  const selected = createItem('selected-top', 'top')
  const unmatched = createItem('unmatched-bottom', 'bottom', { colorName: '오렌지' })

  const ranked = rankOutfitMatchCandidates([selected], [unmatched], ['화이트'])

  assert.equal(ranked[0].relation, 'soft-balance')
  assert.doesNotMatch(ranked[0].reason, /조화를 이뤄요/)
})

test('선택한 ID를 제외하고 기본 5개와 지정한 개수만 반환하며 동점 순서를 지킨다', () => {
  const selected = createItem('selected-top', 'top')
  const candidates = [
    { ...selected, displayImageId: 'excluded-image' },
    ...Array.from({ length: 8 }, (_, index) => ({
      ...createItem(`candidate-${index}`, 'bottom'),
      displayImageId: `image-${index}`,
    })),
  ]

  const defaultRanked = rankOutfitMatchCandidates([selected], candidates, ['블랙'])
  const expandedRanked = rankOutfitMatchCandidates([selected], candidates, ['블랙'], 7)

  assert.deepEqual(defaultRanked.map(({ item }) => item.id),
    ['candidate-0', 'candidate-1', 'candidate-2', 'candidate-3', 'candidate-4'])
  assert.deepEqual(expandedRanked.map(({ item }) => item.id),
    ['candidate-0', 'candidate-1', 'candidate-2', 'candidate-3', 'candidate-4', 'candidate-5', 'candidate-6'])
  assert.equal(expandedRanked[0]?.item.displayImageId, 'image-0')
})
