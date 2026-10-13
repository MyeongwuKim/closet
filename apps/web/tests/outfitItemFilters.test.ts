import assert from 'node:assert/strict'
import test from 'node:test'
import type { WardrobeItem } from '@closet/types'
import {
  filterOutfitItems,
  getOutfitItemFilterOptions,
} from '../src/features/lookbook/utils/outfitItemFilters'

function createItem(
  id: string,
  overrides: Partial<WardrobeItem> = {},
): WardrobeItem {
  return {
    id,
    name: id,
    createdAt: '2026-09-15T00:00:00.000Z',
    category: 'top',
    additionalCategories: [],
    classificationStatus: 'classified',
    colorName: '블랙',
    colorHex: '#111111',
    seasons: ['autumn'],
    tags: [],
    ...overrides,
  }
}

const items = [
  createItem('검정 니트', { subcategory: '니트', tags: ['출근'] }),
  createItem('아이보리 셔츠', {
    subcategory: '셔츠',
    colorName: '아이보리',
    colorDetailName: '크림',
    colorHex: '#f4efe4',
    seasons: ['spring', 'autumn'],
    tags: ['데이트'],
  }),
]

test('옷 이름과 세부 종류, 색상, 태그를 검색한다', () => {
  for (const query of ['아이보리', '셔츠', '크림', '데이트']) {
    assert.deepEqual(
      filterOutfitItems(items, { query, season: null, color: null }).map(
        (item) => item.id,
      ),
      ['아이보리 셔츠'],
    )
  }
})

test('검색어와 계절, 색상 조건을 함께 적용한다', () => {
  assert.deepEqual(
    filterOutfitItems(items, {
      query: '셔츠',
      season: 'spring',
      color: '아이보리',
    }).map((item) => item.id),
    ['아이보리 셔츠'],
  )
  assert.equal(
    filterOutfitItems(items, {
      query: '셔츠',
      season: 'winter',
      color: '아이보리',
    }).length,
    0,
  )
})

test('추천 색상 이름은 공백과 영문 대소문자를 정리해 옷장 색상과 비교한다', () => {
  const wardrobeItems = [
    createItem('베이지 바지', { category: 'bottom', colorName: ' Beige ' }),
    createItem('검정 바지', { category: 'bottom', colorName: '블랙' }),
  ]

  assert.deepEqual(
    filterOutfitItems(wardrobeItems, {
      query: '',
      season: null,
      color: 'beige',
    }).map((item) => item.id),
    ['베이지 바지'],
  )
})

test('추천 색 필터는 명확한 하위 색상만 포함하고 모호한 이름은 자동으로 묶지 않는다', () => {
  const wardrobeItems = [
    createItem('아이보리 상의', { colorName: '아이보리' }),
    createItem('다크브라운 상의', { colorName: '다크브라운' }),
    createItem('버건디 상의', { colorName: '버건디' }),
    createItem('머드 상의', { colorName: '머드' }),
  ]

  assert.deepEqual(
    filterOutfitItems(wardrobeItems, {
      query: '', season: null, color: '크림', includeColorAliases: true,
    }).map((item) => item.id),
    ['아이보리 상의'],
  )
  assert.deepEqual(
    filterOutfitItems(wardrobeItems, {
      query: '', season: null, color: '브라운', includeColorAliases: true,
    }).map((item) => item.id),
    ['다크브라운 상의'],
  )
  assert.deepEqual(
    filterOutfitItems(wardrobeItems, {
      query: '', season: null, color: '레드', includeColorAliases: true,
    }).map((item) => item.id),
    ['버건디 상의'],
  )
  assert.deepEqual(
    filterOutfitItems(wardrobeItems, {
      query: '', season: null, color: '베이지', includeColorAliases: true,
    }).map((item) => item.id),
    [],
  )
  assert.deepEqual(
    filterOutfitItems(wardrobeItems, {
      query: '', season: null, color: '버건디', includeColorAliases: false,
    }).map((item) => item.id),
    ['버건디 상의'],
  )
})

test('현재 목록에서 사용할 수 있는 계절과 색상만 만든다', () => {
  const options = getOutfitItemFilterOptions(items)

  assert.deepEqual([...options.seasons].sort(), ['autumn', 'spring'])
  assert.deepEqual(options.colors, [
    { name: '블랙', hex: '#111111' },
    { name: '아이보리', hex: '#f4efe4' },
  ])
})
