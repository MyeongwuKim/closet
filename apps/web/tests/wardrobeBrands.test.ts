import assert from 'node:assert/strict'
import test from 'node:test'
import type { WardrobeItem } from '@closet/types'
import { clearWardrobeBrandFromItems, getWardrobeBrandOptions } from '../src/features/closet/utils/wardrobeBrands'

test('브랜드를 해제해도 옷의 분류·이미지·구성 정보와 다른 브랜드는 유지한다', () => {
  const items = [
    { id: 'first', brandName: 'COS', name: '니트', category: 'top', imageUrl: 'photo-1', seasons: ['autumn'], additionalCategories: [], tags: ['데일리'] },
    { id: 'second', brandName: '  ＣＯＳ  ', name: '팬츠', category: 'bottom', imageUrl: 'photo-2', seasons: ['winter'], additionalCategories: [], tags: [] },
    { id: 'other', brandName: 'COS STUDIO', name: '재킷', category: 'outer', imageUrl: 'photo-3', seasons: ['spring'], additionalCategories: [], tags: [] },
    { id: 'none', brandName: undefined, name: '셔츠', category: 'top', imageUrl: 'photo-4', seasons: [], additionalCategories: [], tags: [] },
  ] as unknown as WardrobeItem[]

  const result = clearWardrobeBrandFromItems(items, ' cos ')
  assert.equal(result[0].brandName, undefined)
  assert.equal(result[1].brandName, undefined)
  assert.deepEqual(result[0], { ...items[0], brandName: undefined })
  assert.deepEqual(result[1], { ...items[1], brandName: undefined })
  assert.equal(result[2], items[2])
  assert.equal(result[3], items[3])
  assert.equal(items[0].brandName, 'COS')
  assert.equal(items[1].brandName, '  ＣＯＳ  ')
  assert.deepEqual(getWardrobeBrandOptions(result.flatMap((item) => item.brandName ? [item.brandName] : [])), ['COS STUDIO'])
})
