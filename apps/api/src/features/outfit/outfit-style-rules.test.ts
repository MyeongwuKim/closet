import assert from 'node:assert/strict'
import test from 'node:test'
import type { ClothingCategory } from '@prisma/client'
import {
  buildOutfitCombinations,
  excludeOuterItems,
  getColorHarmonyScore,
  getItemStyleScore,
  type StyleRuleItem,
} from './outfit-style-rules.js'

function createItem(
  id: string,
  category: ClothingCategory,
  subcategory: string,
  overrides: Partial<StyleRuleItem> = {},
): StyleRuleItem {
  return {
    id,
    name: subcategory,
    category,
    additionalCategories: [],
    subcategory,
    colorName: '블랙',
    colorHex: '#242424',
    colorMode: 'solid',
    wearCount: 0,
    lastWornAt: null,
    ...overrides,
  }
}

test('colorHex가 있으면 상세 색상명보다 실제 색을 우선한다', () => {
  const blue = createItem('blue', 'bottom', '데님', {
    colorName: '블루',
    colorHex: '#4F78A1',
  })
  const detailedGray = createItem('detailed-gray', 'top', '니트', {
    colorName: '베이지 그레이',
    colorHex: '#858580',
  })
  const canonicalGray = createItem('canonical-gray', 'top', '니트', {
    colorName: '그레이',
    colorHex: '#858580',
  })

  assert.equal(
    getColorHarmonyScore(detailedGray, blue),
    getColorHarmonyScore(canonicalGray, blue),
  )
})

test('colorHex가 없거나 잘못되면 색상명 규칙으로 대체한다', () => {
  const black = createItem('black', 'top', '니트', {
    colorName: '블랙',
    colorHex: null,
  })
  const beige = createItem('beige', 'bottom', '치노 팬츠', {
    colorName: '베이지',
    colorHex: 'invalid',
  })

  assert.equal(getColorHarmonyScore(black, beige), 6)
})

test('세부 중립색도 colorHex로 인식해 색상명 미인식보다 높게 평가한다', () => {
  const blue = createItem('blue', 'bottom', '데님', {
    colorName: '블루',
    colorHex: '#4F78A1',
  })
  const withHex = createItem('with-hex', 'top', '니트', {
    colorName: '베이지 그레이',
    colorHex: '#858580',
  })
  const withoutHex = createItem('without-hex', 'top', '니트', {
    colorName: '베이지 그레이',
    colorHex: null,
  })

  assert.ok(
    getColorHarmonyScore(withHex, blue) >
      getColorHarmonyScore(withoutHex, blue),
  )
})

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

test('코트도 캐주얼 조합 후보에서 제외하지 않는다', () => {
  const combinations = buildOutfitCombinations(
    [
      createItem('top', 'top', '긴팔'),
      createItem('bottom', 'bottom', '데님'),
      createItem('shoes', 'shoes', '스니커즈'),
      createItem('jacket', 'outer', '재킷'),
      createItem('cardigan', 'outer', '가디건'),
      createItem('hoodie-outer', 'outer', '후드'),
      createItem('denim-outer', 'outer', '데님'),
      createItem('coat', 'outer', '코트'),
    ],
    'casual',
    'regular',
    'winter',
  )

  assert.ok(
    combinations.some((combination) =>
      combination.items.some((item) => item.id === 'coat'),
    ),
  )
})

test('캐주얼 요소와 매치한 코트는 겨울 캐주얼 점수를 보완한다', () => {
  const combinations = buildOutfitCombinations(
    [
      createItem('shirt', 'top', '셔츠'),
      createItem('denim', 'bottom', '데님'),
      createItem('sneakers', 'shoes', '스니커즈'),
      createItem('coat', 'outer', '코트'),
    ],
    'casual',
    'regular',
    'winter',
  )
  const withoutCoat = combinations.find(
    (combination) =>
      combination.items.length === 3 &&
      combination.items.every((item) => item.id !== 'coat'),
  )
  const withCoat = combinations.find((combination) =>
    combination.items.some((item) => item.id === 'coat'),
  )

  assert.ok(withoutCoat)
  assert.ok(withCoat)
  assert.ok(withCoat.score > withoutCoat.score)
})

test('다른 추천에서는 직전 아우터만 제외한다', () => {
  const top = createItem('top', 'top', '긴팔')
  const previousOuter = createItem('previous-outer', 'outer', '패딩')
  const nextOuter = createItem('next-outer', 'outer', '코트')

  assert.deepEqual(
    excludeOuterItems(
      [top, previousOuter, nextOuter],
      [previousOuter.id],
    ).map((item) => item.id),
    [top.id, nextOuter.id],
  )
})

test('상위 후보를 이너·하의·아우터·신발에 걸쳐 다양하게 선택한다', () => {
  const tops = [
    createItem('top-gray', 'top', '니트', { colorHex: '#777872' }),
    createItem('top-cream', 'top', '니트', { colorHex: '#E7DDC9' }),
    createItem('top-brown', 'top', '니트', { colorHex: '#775444' }),
    createItem('top-olive', 'top', '니트', { colorHex: '#727158' }),
  ]
  const bottoms = [
    createItem('bottom-blue', 'bottom', '데님', { colorHex: '#4F78A1' }),
    createItem('bottom-black', 'bottom', '데님', { colorHex: '#242424' }),
    createItem('bottom-beige', 'bottom', '치노 팬츠', {
      colorHex: '#C9B28F',
    }),
  ]
  const outers = [
    createItem('outer-black', 'outer', '재킷', { colorHex: '#242424' }),
    createItem('outer-olive', 'outer', '재킷', { colorHex: '#727158' }),
    createItem('outer-brown', 'outer', '재킷', { colorHex: '#775444' }),
  ]
  const shoes = [
    createItem('shoes-black', 'shoes', '구두', { colorHex: '#242424' }),
    createItem('shoes-brown', 'shoes', '구두', { colorHex: '#775444' }),
    createItem('shoes-white', 'shoes', '스니커즈', { colorHex: '#F2F1EC' }),
  ]
  const combinations = buildOutfitCombinations(
    [...tops, ...bottoms, ...outers, ...shoes],
    'casual',
    'regular',
    'autumn',
  )
  const usedIds = (category: ClothingCategory) =>
    new Set(
      combinations.flatMap((combination) =>
        combination.items
          .filter((item) => item.category === category)
          .map((item) => item.id),
      ),
    )

  assert.ok(usedIds('top').size >= 3)
  assert.ok(usedIds('bottom').size >= 2)
  assert.equal(usedIds('outer').size, outers.length)
  assert.ok(usedIds('shoes').size >= 2)
})
