import assert from 'node:assert/strict'
import test from 'node:test'
import type { FashionItemAttributes, WardrobeItem } from '@closet/types'
import {
  areColorNamesCompatible,
  findSimilarWardrobeItems,
} from '../src/features/closet/utils/similarWardrobeItems'

function createCoat(
  id: string,
  colorName: string,
  colorHex: string,
  fashionAttributes?: FashionItemAttributes,
): WardrobeItem {
  return {
    id,
    name: `${colorName} 코트`,
    createdAt: '2026-08-24T00:00:00.000Z',
    category: 'outer',
    additionalCategories: [],
    subcategory: '코트',
    classificationStatus: 'classified',
    colorName,
    colorHex,
    colorMode: 'solid',
    fashionAttributes,
    seasons: ['winter'],
    tags: [],
    wearCount: 0,
  }
}

function createAttributes(
  overrides: Partial<FashionItemAttributes> = {},
): FashionItemAttributes {
  return {
    layerRole: 'outer',
    silhouette: 'regular',
    pattern: 'solid',
    material: 'wool',
    texture: 'smooth',
    necklineStyle: 'collar',
    frontOpeningStyle: 'buttons',
    pocketStyle: 'welt',
    warmth: 'heavy',
    formality: 0.7,
    confidence: 0.9,
    ...overrides,
  }
}

test('브라운과 네이비는 어두운 HEX가 가까워도 같은 색감으로 보지 않는다', () => {
  const matches = findSimilarWardrobeItems(
    {
      category: 'outer',
      subcategory: '코트',
      colorName: '브라운',
      colorHex: '#5A4F45',
      colorMode: 'solid',
      fashionAttributes: null,
    },
    [createCoat('navy-coat', '네이비', '#27313D')],
  )

  assert.equal(matches.length, 0)
})

test('다크 브라운처럼 같은 계열인 코트는 기존 거리 비교를 적용한다', () => {
  const matches = findSimilarWardrobeItems(
    {
      category: 'outer',
      subcategory: '코트',
      colorName: '헤링본 짙은 브라운(토프빛)',
      colorHex: '#5A4F45',
      colorMode: 'solid',
      fashionAttributes: null,
    },
    [createCoat('brown-coat', '다크 브라운', '#4A4038')],
  )

  assert.equal(matches.length, 1)
  assert.equal(matches[0]?.item.id, 'brown-coat')
})

test('차콜과 블랙, 네이비와 블루처럼 인접 계열은 허용한다', () => {
  assert.equal(areColorNamesCompatible('차콜', '블랙'), true)
  assert.equal(areColorNamesCompatible('네이비', '블루'), true)
  assert.equal(areColorNamesCompatible('차콜', '브라운'), false)
})

test('색상명이 같게 분류돼도 올리브 HEX와 차콜 HEX를 비슷한 색으로 보지 않는다', () => {
  const matches = findSimilarWardrobeItems(
    {
      category: 'bottom',
      subcategory: '와이드 팬츠',
      colorName: '그레이',
      colorHex: '#48503F',
      colorMode: 'solid',
      fashionAttributes: null,
    },
    [
      {
        ...createCoat('charcoal-pants', '그레이', '#3A3A3C'),
        category: 'bottom',
        subcategory: '와이드 팬츠',
      },
    ],
  )

  assert.equal(matches.length, 0)
})

test('디자인이 같으면 색상이 달라도 비슷한 디자인으로 찾는다', () => {
  const attributes = createAttributes()
  const matches = findSimilarWardrobeItems(
    {
      category: 'outer',
      subcategory: '코트',
      colorName: '브라운',
      colorHex: '#775444',
      colorMode: 'solid',
      fashionAttributes: attributes,
    },
    [createCoat('navy-coat', '네이비', '#27394A', attributes)],
  )

  assert.equal(matches.length, 1)
  assert.equal(matches[0]?.kind, 'similar-design')
  assert.equal(matches[0]?.designSimilarityPercent, 100)
})

test('색상만 같고 소재·실루엣·패턴이 다르면 비슷한 색감으로 구분한다', () => {
  const targetAttributes = createAttributes()
  const differentAttributes = createAttributes({
    silhouette: 'oversized',
    pattern: 'graphic',
    material: 'synthetic',
    texture: 'quilted',
    necklineStyle: 'hood',
    frontOpeningStyle: 'zipper',
    pocketStyle: 'patch',
    warmth: 'light',
    formality: 0.1,
  })
  const matches = findSimilarWardrobeItems(
    {
      category: 'outer',
      subcategory: '코트',
      colorName: '네이비',
      colorHex: '#27394A',
      colorMode: 'solid',
      fashionAttributes: targetAttributes,
    },
    [createCoat('different-coat', '네이비', '#27394A', differentAttributes)],
  )

  assert.equal(matches.length, 1)
  assert.equal(matches[0]?.kind, 'similar-color')
  assert.ok((matches[0]?.designSimilarityPercent ?? 100) < 70)
})

test('색상과 디자인이 모두 같으면 거의 같은 옷으로 판정한다', () => {
  const attributes = createAttributes()
  const matches = findSimilarWardrobeItems(
    {
      category: 'outer',
      subcategory: '코트',
      colorName: '네이비',
      colorHex: '#27394A',
      colorMode: 'solid',
      fashionAttributes: attributes,
    },
    [createCoat('same-coat', '네이비', '#27394A', attributes)],
  )

  assert.equal(matches.length, 1)
  assert.equal(matches[0]?.kind, 'near-duplicate')
  assert.equal(matches[0]?.colorSimilarityPercent, 100)
  assert.equal(matches[0]?.designSimilarityPercent, 100)
})

test('패턴이나 다색 옷은 대표색과 형태가 같아도 종합 일치로 판정하지 않는다', () => {
  const stripe = createAttributes({ pattern: 'stripe' })
  const solid = createAttributes()
  const cases = [
    { mode: 'patterned', attributes: stripe },
    { mode: 'multicolor', attributes: solid },
    { mode: 'solid', attributes: stripe },
  ] as const

  for (const { mode, attributes } of cases) {
    const [match] = findSimilarWardrobeItems(
      {
        category: 'outer',
        subcategory: '코트',
        colorName: '화이트',
        colorHex: '#FFFFFF',
        colorMode: mode,
        fashionAttributes: attributes,
      },
      [
        {
          ...createCoat('same-base-coat', '화이트', '#FFFFFF', attributes),
          colorMode: mode,
        },
      ],
    )

    assert.equal(match?.kind, 'similar-design')
    assert.equal(match.usesRepresentativeColorOnly, true)
    assert.equal(match.colorSimilarityPercent, 100)
    assert.ok(match.reasons.includes('매우 비슷한 대표색'))
  }
})

test('대표색이 같아도 체크와 스트라이프의 패턴 차이를 디자인에 반영한다', () => {
  const [match] = findSimilarWardrobeItems(
    {
      category: 'outer',
      subcategory: '코트',
      colorName: '화이트',
      colorHex: '#FFFFFF',
      colorMode: 'patterned',
      fashionAttributes: createAttributes({ pattern: 'stripe' }),
    },
    [
      {
        ...createCoat(
          'check-coat',
          '화이트',
          '#FFFFFF',
          createAttributes({ pattern: 'check' }),
        ),
        colorMode: 'patterned',
      },
    ],
  )

  assert.equal(match?.kind, 'similar-color')
  assert.equal(match.colorSimilarityPercent, 100)
  assert.ok(
    match.designSimilarityPercent !== null && match.designSimilarityPercent < 70,
  )
  assert.ok(match.reasons.includes('스트라이프·체크 차이'))
})

test('실루엣을 확인할 수 없는 스니커즈는 색상만으로 비교한다', () => {
  const attributes: FashionItemAttributes = {
    layerRole: 'single',
    silhouette: 'unknown',
    pattern: 'solid',
    material: 'unknown',
    texture: 'unknown',
    warmth: 'unknown',
    formality: 0.3,
    confidence: 0.2,
  }
  const cases: FashionItemAttributes[] = [
    attributes,
    { ...attributes, material: 'leather', texture: 'smooth' },
  ]
  for (const fashionAttributes of cases) {
    const matches = findSimilarWardrobeItems(
      {
        itemName: '흰색 로우탑',
        category: 'shoes',
        subcategory: '스니커즈',
        colorName: '화이트',
        colorHex: '#FFFFFF',
        colorMode: 'solid',
        fashionAttributes,
      },
      [
        {
          ...createCoat('white-high-top', '화이트', '#FFFFFF', fashionAttributes),
          name: '흰색 하이탑',
          category: 'shoes',
          subcategory: '스니커즈',
        },
        {
          ...createCoat('black-high-top', '블랙', '#000000', fashionAttributes),
          name: '검정 하이탑',
          category: 'shoes',
          subcategory: '스니커즈',
        },
      ],
    )

    assert.deepEqual(matches.map((match) => match.item.id), ['white-high-top'])
    assert.equal(matches[0]?.kind, 'similar-color')
    assert.equal(matches[0].designSimilarityPercent, null)
  }
})

test('소재가 같아도 트윌과 코듀로이처럼 질감이 다르면 디자인 유사도를 낮춘다', () => {
  const targetAttributes = createAttributes({
    silhouette: 'relaxed',
    material: 'cotton',
    texture: 'twill',
    warmth: 'medium',
    formality: 0.2,
  })
  const corduroyAttributes = createAttributes({
    silhouette: 'relaxed',
    material: 'cotton',
    texture: 'corduroy',
    warmth: 'medium',
    formality: 0.2,
  })
  const corduroyPants: WardrobeItem = {
    ...createCoat(
      'corduroy-pants',
      '다크 그레이',
      '#3A3A3C',
      corduroyAttributes,
    ),
    name: '다크 그레이 코듀로이 세미와이드 팬츠',
    category: 'bottom',
    subcategory: '와이드 팬츠',
  }

  const matches = findSimilarWardrobeItems(
    {
      itemName: '카키 트윌 와이드 팬츠',
      category: 'bottom',
      subcategory: '와이드 팬츠',
      colorName: '카키',
      colorHex: '#48503F',
      colorMode: 'solid',
      fashionAttributes: targetAttributes,
    },
    [corduroyPants],
  )

  assert.equal(matches.length, 0)
})

test('같은 니트여도 넥라인과 여밈, 포켓이 다르면 비슷한 형태로 판정하지 않는다', () => {
  const targetAttributes = createAttributes({
    layerRole: 'base',
    silhouette: 'relaxed',
    material: 'knit',
    texture: 'ribbed',
    warmth: 'medium',
    formality: 0.35,
    necklineStyle: 'collar',
    frontOpeningStyle: 'halfButtons',
    pocketStyle: 'patch',
  })
  const crewneckAttributes = createAttributes({
    layerRole: 'base',
    silhouette: 'relaxed',
    material: 'knit',
    texture: 'ribbed',
    warmth: 'medium',
    formality: 0.35,
    necklineStyle: 'crew',
    frontOpeningStyle: 'none',
    pocketStyle: 'none',
  })
  const crewneck: WardrobeItem = {
    ...createCoat('crewneck', '그레이', '#B8B3AE', crewneckAttributes),
    name: '그레이 크루넥 니트',
    category: 'top',
    subcategory: '니트',
  }

  const matches = findSimilarWardrobeItems(
    {
      itemName: '그레이 칼라 버튼 니트',
      category: 'top',
      subcategory: '니트',
      colorName: '그레이',
      colorHex: '#B8B3AE',
      colorMode: 'solid',
      fashionAttributes: targetAttributes,
    },
    [crewneck],
  )

  assert.equal(matches.length, 1)
  assert.equal(matches[0]?.kind, 'similar-color')
  assert.ok((matches[0]?.designSimilarityPercent ?? 100) < 70)
})

test('형태 세부 정보가 없는 기존 니트는 색까지 다르면 유사 후보에서 제외한다', () => {
  const legacyAttributes: FashionItemAttributes = {
    layerRole: 'base',
    silhouette: 'relaxed',
    pattern: 'solid',
    material: 'knit',
    texture: 'ribbed',
    warmth: 'medium',
    formality: 0.35,
    confidence: 0.9,
  }
  const legacyCrewneck: WardrobeItem = {
    ...createCoat('legacy-crewneck', '차콜', '#28292A', legacyAttributes),
    name: '딥 차콜 니트 크루넥 스웨터',
    category: 'top',
    subcategory: '니트',
  }

  const matches = findSimilarWardrobeItems(
    {
      itemName: '그레이 칼라 버튼 니트',
      category: 'top',
      subcategory: '니트',
      colorName: '그레이',
      colorHex: '#B8B3AE',
      colorMode: 'solid',
      fashionAttributes: legacyAttributes,
    },
    [legacyCrewneck],
  )

  assert.equal(matches.length, 0)
})

test('같은 와이드 팬츠여도 카고 포켓과 일반 포켓은 비슷한 형태로 판정하지 않는다', () => {
  const targetAttributes = createAttributes({
    layerRole: 'single',
    silhouette: 'relaxed',
    material: 'cotton',
    texture: 'twill',
    warmth: 'medium',
    formality: 0.2,
    necklineStyle: 'unknown',
    frontOpeningStyle: 'unknown',
    pocketStyle: 'cargo',
    bottomLegShape: 'wide',
    bottomWaistStyle: 'structured',
    bottomFrontPleats: 'absent',
  })
  const plainAttributes: FashionItemAttributes = {
    ...targetAttributes,
    pocketStyle: 'slant',
  }
  const plainPants: WardrobeItem = {
    ...createCoat('plain-pants', '올리브', '#3B4039', plainAttributes),
    name: '올리브 와이드 팬츠',
    category: 'bottom',
    subcategory: '와이드 팬츠',
  }

  const matches = findSimilarWardrobeItems(
    {
      itemName: '올리브 카고 와이드 팬츠',
      category: 'bottom',
      subcategory: '와이드 팬츠',
      colorName: '올리브',
      colorHex: '#3B4039',
      colorMode: 'solid',
      fashionAttributes: targetAttributes,
    },
    [plainPants],
  )

  assert.equal(matches.length, 1)
  assert.equal(matches[0]?.kind, 'similar-color')
  assert.ok((matches[0]?.designSimilarityPercent ?? 100) < 70)
})

test('기존에 팬츠로 등록한 바지는 색이 다른 와이드 팬츠나 일반 긴바지와 형태를 비교한다', () => {
  const attributes = createAttributes({
    layerRole: 'single',
    silhouette: 'relaxed',
    material: 'cotton',
    texture: 'twill',
    pocketStyle: 'patch',
    bottomLegShape: 'wide',
    bottomWaistStyle: 'structured',
    bottomFrontPleats: 'absent',
  })
  const savedPants: WardrobeItem = {
    ...createCoat('legacy-pants', '올리브', '#959F89', attributes),
    name: '파라트루퍼 팬츠 세이지',
    category: 'bottom',
    subcategory: '팬츠',
  }

  for (const subcategory of ['와이드 팬츠', '일반 긴바지']) {
    const [match] = findSimilarWardrobeItems(
      {
        category: 'bottom',
        subcategory,
        colorName: '블랙',
        colorHex: '#212223',
        colorMode: 'solid',
        fashionAttributes: attributes,
      },
      [savedPants],
    )

    assert.ok(match)
    assert.equal(match.item.id, savedPants.id)
    assert.equal(match.kind, 'similar-design')
    assert.equal(match.colorSimilarityPercent, 0)
    assert.ok((match.designSimilarityPercent ?? 0) >= 70)
    assert.ok(!match.reasons.includes(`같은 ${subcategory}`))
  }
})

test('세부 종류가 다른 바지는 같은 색만으로 후보가 되지 않는다', () => {
  const attributes = createAttributes({
    layerRole: 'single',
    pocketStyle: 'patch',
    bottomLegShape: 'wide',
    bottomWaistStyle: 'structured',
    bottomFrontPleats: 'absent',
  })
  const savedPants: WardrobeItem = {
    ...createCoat('legacy-pants', '올리브', '#959F89', attributes),
    category: 'bottom',
    subcategory: '팬츠',
  }
  const input = {
    category: 'bottom' as const,
    subcategory: '와이드 팬츠',
    colorName: '올리브',
    colorHex: '#959F89',
    colorMode: 'solid' as const,
    fashionAttributes: attributes,
  }

  assert.deepEqual(
    findSimilarWardrobeItems(input, [
      { ...savedPants, fashionAttributes: undefined },
      { ...savedPants, fashionAttributes: { ...attributes, pocketStyle: 'cargo' } },
      { ...savedPants, subcategory: '일반 긴바지' },
      { ...savedPants, subcategory: '반바지' },
    ]),
    [],
  )
  assert.deepEqual(findSimilarWardrobeItems({ ...input, subcategory: '반바지' }, [savedPants]), [])
})
