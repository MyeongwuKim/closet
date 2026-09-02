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

test('기준 아이템은 모든 카테고리의 후보 제한과 조합 제한 전에 고정한다', async (t) => {
  const categories = ['top', 'bottom', 'outer', 'midlayer', 'dress', 'shoes', 'accessory'] as const

  for (const category of categories) {
    await t.test(category, () => {
      const baseItem = createItem('base-item', category, '선택한 아이템', {
        fashionAttributes: {
          layerRole: category === 'top' ? 'base' : 'single',
          silhouette: 'oversized',
          pattern: 'floral',
          material: 'synthetic',
          warmth: 'medium',
          formality: 1,
          confidence: 0.9,
        },
        wearCount: 100,
        lastWornAt: new Date(),
      })
      const higherRankedItems = Array.from({ length: 9 }, (_, index) =>
        createItem(`candidate-${index}`, category, '기본 아이템', {
          fashionAttributes: {
            layerRole: category === 'top' ? 'base' : 'single',
            silhouette: 'regular',
            pattern: 'solid',
            material: 'cotton',
            warmth: 'medium',
            formality: 0.2,
            confidence: 0.9,
          },
        }),
      )
      const items = [
        createItem('top', 'top', '긴팔'),
        createItem('bottom', 'bottom', '데님'),
        createItem('dress', 'dress', '원피스'),
        createItem('shoes', 'shoes', '스니커즈'),
        ...higherRankedItems,
        baseItem,
      ]

      const unanchored = buildOutfitCombinations(items, 'casual', 'regular', 'autumn')
      assert.ok(unanchored.every(({ items: selected }) =>
        selected.every((item) => item.id !== baseItem.id),
      ))

      const anchored = buildOutfitCombinations(items, 'casual', 'regular', 'autumn', baseItem.id)
      assert.ok(anchored.length > 0)
      assert.ok(anchored.every(({ items: selected }) =>
        selected.filter((item) => item.id === baseItem.id).length === 1 && selected.length <= 5,
      ))
    })
  }
})

test('다른 추천의 아우터 제외 목록에 있어도 기준 아우터는 유지한다', () => {
  const baseOuter = createItem('base-outer', 'outer', '재킷')
  const previousOuter = createItem('previous-outer', 'outer', '코트')
  const top = createItem('top', 'top', '긴팔')

  assert.deepEqual(
    excludeOuterItems([baseOuter, previousOuter, top], [baseOuter.id, previousOuter.id], baseOuter.id),
    [baseOuter, top],
  )
})

test('기준 아우터는 원피스 또는 이너와 하의에 조합하고 단독 상의로 쓰지 않는다', () => {
  const baseOuter = createItem('base-outer', 'outer', '집업', {
    additionalCategories: ['top'],
  })
  const combinations = buildOutfitCombinations([
    baseOuter,
    createItem('top', 'top', '긴팔'),
    createItem('bottom', 'bottom', '데님'),
    createItem('dress', 'dress', '원피스'),
  ], 'casual', 'regular', 'autumn', baseOuter.id)

  assert.ok(combinations.some(({ items }) => items.some((item) => item.id === 'dress')))
  assert.ok(combinations.every(({ items }) => {
    const ids = items.map((item) => item.id)
    return ids.includes(baseOuter.id) &&
      (ids.includes('dress') || (ids.includes('top') && ids.includes('bottom')))
  }))
})

test('중간 레이어 역할인 기준 상의에는 별도의 이너 상의를 함께 고른다', () => {
  const baseMidlayer = createItem('base-midlayer', 'top', '니트 베스트', {
    fashionAttributes: {
      layerRole: 'mid',
      silhouette: 'regular',
      pattern: 'solid',
      material: 'knit',
      warmth: 'medium',
      formality: 0.4,
      confidence: 0.9,
    },
  })
  const combinations = buildOutfitCombinations([
    baseMidlayer,
    createItem('top', 'top', '긴팔'),
    createItem('bottom', 'bottom', '데님'),
  ], 'casual', 'regular', 'autumn', baseMidlayer.id)

  assert.ok(combinations.length > 0)
  assert.ok(combinations.every(({ items }) =>
    items.some((item) => item.id === baseMidlayer.id) &&
    items.some((item) => item.id === 'top'),
  ))
})

test('기준 아이템이 없거나 함께 입을 이너가 없으면 다른 완성 코디로 대체하지 않는다', () => {
  const dress = createItem('dress', 'dress', '원피스')
  const baseMidlayer = createItem('base-midlayer', 'midlayer', '가디건')
  assert.deepEqual(
    buildOutfitCombinations([dress], 'casual', 'regular', 'autumn', 'missing-item'),
    [],
  )
  assert.deepEqual(
    buildOutfitCombinations([dress, baseMidlayer], 'casual', 'regular', 'autumn', baseMidlayer.id),
    [],
  )
})
