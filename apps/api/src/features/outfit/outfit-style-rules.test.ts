import assert from 'node:assert/strict'
import test from 'node:test'
import type { ClothingCategory } from '@prisma/client'
import {
  buildOutfitCombinations,
  getItemStyleScore,
  type StyleRuleItem,
} from './outfit-style-rules.js'

function createItem(
  id: string,
  category: ClothingCategory,
  subcategory: string,
): StyleRuleItem {
  return {
    id,
    name: subcategory,
    category,
    additionalCategories: [],
    subcategory,
    colorName: '블랙',
    colorMode: 'solid',
    wearCount: 0,
    lastWornAt: null,
  }
}

test('아우터와 하의만으로는 완성 코디 후보를 만들지 않는다', () => {
  const combinations = buildOutfitCombinations(
    [
      createItem('outer', 'outer', '재킷'),
      createItem('bottom', 'bottom', '데님'),
      createItem('shoes', 'shoes', '스니커즈'),
    ],
    'casual',
    'regular',
    'autumn',
  )

  assert.equal(combinations.length, 0)
})

test('아우터가 들어간 모든 후보에 이너 상의가 포함된다', () => {
  const combinations = buildOutfitCombinations(
    [
      createItem('top', 'top', '긴팔'),
      createItem('outer', 'outer', '재킷'),
      createItem('bottom', 'bottom', '데님'),
      createItem('shoes', 'shoes', '스니커즈'),
    ],
    'casual',
    'regular',
    'autumn',
  )
  const layeredCombinations = combinations.filter((combination) =>
    combination.items.some((item) => item.id === 'outer'),
  )

  assert.ok(layeredCombinations.length > 0)
  assert.ok(
    layeredCombinations.every((combination) =>
      combination.items.some((item) => item.id === 'top'),
    ),
  )
})

test('선택한 목표 스타일 하나만 아이템 점수에 반영한다', () => {
  const hoodie = createItem('hoodie', 'top', '후드')
  const blazer = createItem('blazer', 'outer', '블레이저')

  assert.ok(
    getItemStyleScore(hoodie, 'casual', 'regular') >
      getItemStyleScore(blazer, 'casual', 'regular'),
  )
  assert.ok(
    getItemStyleScore(blazer, 'classic', 'regular') >
      getItemStyleScore(hoodie, 'classic', 'regular'),
  )
})

