import assert from 'node:assert/strict'
import test from 'node:test'
import type { ClothingCategory, WardrobeItem } from '@closet/types'
import { getRefreshExcludedOuterItemIds } from '../src/features/plan/utils/todayOutfitRecommendation'

function createItem(
  id: string,
  category: ClothingCategory,
  additionalCategories: ClothingCategory[] = [],
): WardrobeItem {
  return {
    id,
    name: id,
    createdAt: '2026-08-28T00:00:00.000Z',
    category,
    additionalCategories,
    subcategory: '',
    classificationStatus: 'classified',
    colorName: '블랙',
    colorHex: '#111111',
    seasons: ['autumn'],
    tags: [],
    wearCount: 0,
  }
}

test('일반 추천을 새로 받을 때 주분류 또는 추가분류가 외투인 옷만 제외한다', () => {
  const items = [
    createItem('jacket', 'outer'),
    createItem('shirt-jacket', 'top', ['outer']),
    createItem('shirt', 'top'),
    createItem('pants', 'bottom'),
  ]

  assert.deepEqual(getRefreshExcludedOuterItemIds(items), [
    'jacket',
    'shirt-jacket',
  ])
})

for (const baseCategory of ['outer', 'top'] as const) {
  test(`기준 옷의 주분류가 ${baseCategory}여도 새 추천에서 기준 옷을 제외하지 않는다`, () => {
    const items = [
      createItem('base', baseCategory, baseCategory === 'top' ? ['outer'] : []),
      createItem('other-jacket', 'outer'),
      createItem('pants', 'bottom'),
    ]

    assert.deepEqual(getRefreshExcludedOuterItemIds(items, 'base'), [
      'other-jacket',
    ])
  })
}
