import assert from 'node:assert/strict'
import test from 'node:test'
import type { ClothingCategory } from '@prisma/client'
import {
  buildOutfitCombinations,
  excludeOuterItems,
  getColorHarmonyScore,
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

function createLayerAttributes(
  layerRole: 'mid' | 'outer',
  warmth: 'light' | 'medium' | 'heavy',
) {
  return {
    layerRole,
    silhouette: 'regular' as const,
    pattern: 'solid' as const,
    material: 'cotton' as const,
    texture: 'smooth' as const,
    warmth,
    formality: 0.4,
    confidence: 0.9,
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

test('체감 23도에는 선택하지 않은 아우터와 중간 레이어를 추천하지 않는다', () => {
  const combinations = buildOutfitCombinations(
    [
      createItem('top', 'top', '반팔'),
      createItem('bottom', 'bottom', '데님'),
      createItem('shoes', 'shoes', '스니커즈'),
      createItem('outer', 'outer', '재킷'),
      createItem('midlayer', 'midlayer', '가디건'),
    ],
    'autumn',
    undefined,
    23,
  )

  assert.ok(combinations.length > 0)
  assert.ok(
    combinations.every(({ items }) =>
      items.every((item) => !['outer', 'midlayer'].includes(item.id)),
    ),
  )
})

test('체감 23도에는 울 니트와 보온성 있는 상의를 추천하지 않는다', () => {
  const combinations = buildOutfitCombinations(
    [
      createItem('t-shirt', 'top', '반팔', {
        fashionAttributes: {
          layerRole: 'base',
          silhouette: 'regular',
          pattern: 'solid',
          material: 'cotton',
          texture: 'smooth',
          warmth: 'light',
          formality: 0.2,
          confidence: 0.9,
        },
      }),
      createItem('wool-knit', 'top', '울 니트', {
        fashionAttributes: {
          layerRole: 'base',
          silhouette: 'regular',
          pattern: 'solid',
          material: 'wool',
          texture: 'ribbed',
          warmth: 'medium',
          formality: 0.4,
          confidence: 0.9,
        },
      }),
      createItem('hoodie', 'top', '후드', {
        fashionAttributes: {
          layerRole: 'base',
          silhouette: 'regular',
          pattern: 'solid',
          material: 'cotton',
          texture: 'smooth',
          warmth: 'medium',
          formality: 0.2,
          confidence: 0.9,
        },
      }),
      createItem('bottom', 'bottom', '데님'),
    ],
    'autumn',
    undefined,
    23,
  )

  assert.ok(combinations.length > 0)
  assert.ok(
    combinations.every(({ items }) =>
      items.every((item) => !['wool-knit', 'hoodie'].includes(item.id)),
    ),
  )
})

test('더운 날씨에도 사용자가 기준으로 고른 아우터는 유지한다', () => {
  const baseOuter = createItem('base-outer', 'outer', '재킷')
  const combinations = buildOutfitCombinations(
    [
      baseOuter,
      createItem('top', 'top', '반팔'),
      createItem('bottom', 'bottom', '데님'),
      createItem('shoes', 'shoes', '스니커즈'),
      createItem('other-outer', 'outer', '코트'),
    ],
    'autumn',
    baseOuter.id,
    23,
  )

  assert.ok(combinations.length > 0)
  assert.ok(
    combinations.every(({ items }) =>
      items.some((item) => item.id === baseOuter.id),
    ),
  )
  assert.ok(
    combinations.every(({ items }) =>
      items.every((item) => item.id !== 'other-outer'),
    ),
  )
})

test('체감 18도에는 가벼운 아우터만 추천 후보로 사용한다', () => {
  const combinations = buildOutfitCombinations(
    [
      createItem('top', 'top', '긴팔'),
      createItem('bottom', 'bottom', '긴바지'),
      createItem('light-outer', 'outer', '얇은 재킷', {
        fashionAttributes: createLayerAttributes('outer', 'light'),
      }),
      createItem('heavy-outer', 'outer', '패딩', {
        fashionAttributes: createLayerAttributes('outer', 'heavy'),
      }),
    ],
    'autumn',
    undefined,
    18,
  )

  assert.ok(
    combinations.some(({ items }) =>
      items.some((item) => item.id === 'light-outer'),
    ),
  )
  assert.ok(
    combinations.every(({ items }) =>
      items.every((item) => item.id !== 'heavy-outer'),
    ),
  )
})

test('체감 7도에는 아우터 조합을 아우터 없는 조합보다 높게 평가한다', () => {
  const combinations = buildOutfitCombinations(
    [
      createItem('top', 'top', '니트'),
      createItem('bottom', 'bottom', '긴바지'),
      createItem('outer', 'outer', '코트', {
        fashionAttributes: createLayerAttributes('outer', 'heavy'),
      }),
    ],
    'winter',
    undefined,
    7,
  )
  const layered = combinations.find(({ items }) =>
    items.some((item) => item.id === 'outer'),
  )
  const unlayered = combinations.find(({ items }) =>
    items.every((item) => item.id !== 'outer'),
  )

  assert.ok(layered)
  assert.ok(unlayered)
  assert.ok(layered.score > unlayered.score)
})

test('연속 추천은 같은 하의에 몰리지 않는다', () => {
  const attributes = {
    layerRole: 'single' as const,
    silhouette: 'relaxed' as const,
    pattern: 'solid' as const,
    material: 'cotton' as const,
    texture: 'twill' as const,
    warmth: 'medium' as const,
    formality: 0.2,
    confidence: 0.9,
  }
  const bottoms = [
    createItem('denim-blue', 'bottom', '데님', {
      colorHex: '#4F78A1',
      fashionAttributes: { ...attributes, material: 'denim' },
    }),
    createItem('denim-black', 'bottom', '데님', {
      colorHex: '#242424',
      fashionAttributes: { ...attributes, material: 'denim' },
    }),
    createItem('cotton-olive', 'bottom', '일반 긴바지', {
      colorHex: '#727158',
      fashionAttributes: attributes,
    }),
    createItem('cotton-beige', 'bottom', '치노 팬츠', {
      colorHex: '#C9B28F',
      fashionAttributes: attributes,
    }),
  ]
  const combinations = buildOutfitCombinations(
    [
      createItem('top', 'top', '긴팔', { colorHex: '#E7DDC9' }),
      ...bottoms,
      createItem('shoes', 'shoes', '스니커즈', { colorHex: '#F2F1EC' }),
    ],
    'autumn',
  )
  const firstBottomIds = combinations.slice(0, 4).flatMap((combination) =>
    combination.items
      .filter((item) => item.category === 'bottom')
      .map((item) => item.id),
  )

  assert.ok(new Set(firstBottomIds).size >= 3)
})

test('코트도 조합 후보에서 제외하지 않는다', () => {
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
    'winter',
  )

  assert.ok(
    combinations.some((combination) =>
      combination.items.some((item) => item.id === 'coat'),
    ),
  )
})

test('겨울에는 코트를 포함한 조합의 레이어 점수를 보완한다', () => {
  const combinations = buildOutfitCombinations(
    [
      createItem('shirt', 'top', '셔츠'),
      createItem('denim', 'bottom', '데님'),
      createItem('sneakers', 'shoes', '스니커즈'),
      createItem('coat', 'outer', '코트'),
    ],
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

      const unanchored = buildOutfitCombinations(items, 'autumn')
      assert.ok(unanchored.every(({ items: selected }) =>
        selected.every((item) => item.id !== baseItem.id),
      ))

      const anchored = buildOutfitCombinations(items, 'autumn', baseItem.id)
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
  ], 'autumn', baseOuter.id)

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
  ], 'autumn', baseMidlayer.id)

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
    buildOutfitCombinations([dress], 'autumn', 'missing-item'),
    [],
  )
  assert.deepEqual(
    buildOutfitCombinations([dress, baseMidlayer], 'autumn', baseMidlayer.id),
    [],
  )
})


test('더운 날 입을 수 있는 상의는 보온성 후보가 많아도 후보 제한에서 밀리지 않는다', () => {
  const warmTops = Array.from({ length: 12 }, (_, index) =>
    createItem(`warm-${index}`, 'top', '울 니트', {
      colorName: '화이트', colorHex: '#F2F0E9',
      fashionAttributes: { ...createLayerAttributes('mid', 'heavy'), layerRole: 'base', material: 'wool' },
    }),
  )
  const combinations = buildOutfitCombinations([
    ...warmTops,
    createItem('light-top', 'top', '반팔', {
      colorName: '그린', colorHex: '#00FF00',
      fashionAttributes: { ...createLayerAttributes('mid', 'light'), layerRole: 'base' },
    }),
    createItem('bottom', 'bottom', '데님'),
  ], 'summer', undefined, 25)
  assert.ok(combinations.length > 0)
  assert.ok(combinations.every(({ items }) => items.some((item) => item.id === 'light-top')))
  assert.ok(combinations.every(({ items }) => items.every((item) => !item.id.startsWith('warm-'))))
})

test('분석 속성과 색이 같으면 이름의 스타일 단어는 조합 점수를 바꾸지 않는다', () => {
  const attributes = { ...createLayerAttributes('mid', 'medium'), layerRole: 'base' }
  const top = createItem('top', 'top', '셔츠', { fashionAttributes: attributes })
  const bottom = createItem('bottom', 'bottom', '데님')
  const original = buildOutfitCombinations([top, bottom], 'autumn')
  const renamed = buildOutfitCombinations([
    { ...top, name: '빈티지 스포티 미니멀 셔츠' }, bottom,
  ], 'autumn')
  assert.equal(original[0]?.score, renamed[0]?.score)
  assert.deepEqual(original[0]?.items.map((item) => item.id), renamed[0]?.items.map((item) => item.id))
})

test('같은 옷장에서는 색 궁합과 실제 상하의 볼륨 균형이 점수에 반영된다', () => {
  const top = createItem('top', 'top', '긴팔', {
    colorName: '레드', colorHex: '#D52525',
    fashionAttributes: { ...createLayerAttributes('mid', 'medium'), layerRole: 'base', silhouette: 'relaxed' },
  })
  const compatible = createItem('compatible', 'bottom', '일반 긴바지', {
    fashionAttributes: { ...createLayerAttributes('mid', 'medium'), layerRole: 'single', silhouette: 'slim' },
  })
  const competing = createItem('competing', 'bottom', '일반 긴바지', {
    colorName: '그린', colorHex: '#00CC36',
    fashionAttributes: { ...createLayerAttributes('mid', 'medium'), layerRole: 'single', silhouette: 'oversized' },
  })
  const combinations = buildOutfitCombinations([top, compatible, competing], 'autumn')
  const preferred = combinations.find(({ items }) => items.some((item) => item.id === compatible.id))
  const other = combinations.find(({ items }) => items.some((item) => item.id === competing.id))
  assert.ok(preferred && other)
  assert.ok(preferred.score > other.score)
})
