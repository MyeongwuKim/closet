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
