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

test('현재 목록에서 사용할 수 있는 계절과 색상만 만든다', () => {
  const options = getOutfitItemFilterOptions(items)

  assert.deepEqual([...options.seasons].sort(), ['autumn', 'spring'])
  assert.deepEqual(options.colors, [
    { name: '블랙', hex: '#111111' },
    { name: '아이보리', hex: '#f4efe4' },
  ])
})
