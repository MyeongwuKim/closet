import assert from 'node:assert/strict'
import test from 'node:test'
import type { ClothingCategory, WardrobeItem } from '@closet/types'
import { getWardrobeColorOptions } from '../src/features/closet/utils/color'
import { wardrobeItemMatchesCategoryFilter } from '../src/features/closet/utils/wardrobeCategories'

function createItem(
  id: string,
  category: ClothingCategory,
  subcategory: string,
  colorName: string,
  colorHex: string,
  additionalCategories: ClothingCategory[] = [],
): WardrobeItem {
  return {
    id,
    name: `${colorName} ${subcategory}`,
    createdAt: '2026-08-26T00:00:00.000Z',
    category,
    additionalCategories,
    subcategory,
    classificationStatus: 'classified',
    colorName,
    colorHex,
    colorMode: 'solid',
    seasons: ['fall'],
    tags: [],
    wearCount: 0,
  }
}

const items = [
  createItem('olive-jacket', 'outer', '재킷', '올리브', '#48503F'),
  createItem('navy-coat', 'outer', '코트', '네이비', '#202B3C'),
  createItem('gray-knit', 'top', '니트', '그레이', '#8A8A86'),
  createItem('beige-cardigan', 'top', '가디건', '베이지', '#C3AD8B', [
    'midlayer',
  ]),
]

test('선택한 카테고리에 존재하는 색상만 색상 필터에 노출한다', () => {
  const outerColors = getWardrobeColorOptions(
    items.filter((item) =>
      wardrobeItemMatchesCategoryFilter(item, 'outer', null),
    ),
  )

  assert.deepEqual(
    outerColors.map((option) => option.name),
    ['네이비', '올리브'],
  )
})

test('소분류를 선택하면 해당 소분류의 색상만 남긴다', () => {
  const jacketColors = getWardrobeColorOptions(
    items.filter((item) =>
      wardrobeItemMatchesCategoryFilter(item, 'outer', '재킷'),
    ),
  )

  assert.deepEqual(jacketColors.map((option) => option.name), ['올리브'])
})

test('추가 카테고리에 속한 옷도 해당 카테고리의 색상으로 포함한다', () => {
  const midlayerColors = getWardrobeColorOptions(
    items.filter((item) =>
      wardrobeItemMatchesCategoryFilter(item, 'midlayer', null),
    ),
  )

  assert.deepEqual(midlayerColors.map((option) => option.name), ['베이지'])
})
