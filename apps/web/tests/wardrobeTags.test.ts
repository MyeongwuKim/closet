import assert from 'node:assert/strict'
import test from 'node:test'
import type { WardrobeItem } from '@closet/types'
import {
  getRankedWardrobeTags,
  wardrobeItemHasTag,
  wardrobeItemMatchesSearch,
} from '../src/features/closet/utils/wardrobeTags'

const item: WardrobeItem = {
  id: 'coat-1',
  name: '러프사이드 네이비 코트',
  createdAt: '2026-08-24T00:00:00.000Z',
  category: 'outer',
  additionalCategories: [],
  subcategory: '코트',
  classificationStatus: 'classified',
  colorName: '네이비',
  colorDetailName: '짙은 네이비',
  colorHex: '#27313D',
  colorMode: 'solid',
  seasons: ['winter'],
  tags: ['출근', '자주 입는'],
  wearCount: 0,
}

test('이름, 카테고리, 색상, 태그를 한 검색어처럼 찾는다', () => {
  assert.equal(wardrobeItemMatchesSearch(item, '네이비 출근'), true)
  assert.equal(wardrobeItemMatchesSearch(item, '아우터 코트'), true)
  assert.equal(wardrobeItemMatchesSearch(item, '브라운 출근'), false)
})

test('태그 비교는 대소문자와 앞쪽 #을 무시한다', () => {
  assert.equal(wardrobeItemHasTag(item, '#출근'), true)
  assert.equal(wardrobeItemHasTag({ ...item, tags: ['TRAVEL'] }, 'travel'), true)
})

test('저장된 태그는 사용 빈도순으로 정렬하고 같은 태그를 합친다', () => {
  assert.deepEqual(
    getRankedWardrobeTags(['여행', '출근', '출근', '#여행', '자주 입는']),
    ['여행', '출근', '자주 입는'],
  )
})
