import assert from 'node:assert/strict'
import test from 'node:test'
import type { WardrobeItem } from '@closet/types'
import {
  areColorNamesCompatible,
  findSimilarWardrobeItems,
} from '../src/features/closet/utils/similarWardrobeItems'

function createCoat(
  id: string,
  colorName: string,
  colorHex: string,
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
    seasons: ['winter'],
    tags: [],
    wearCount: 0,
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
