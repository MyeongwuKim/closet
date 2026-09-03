import assert from 'node:assert/strict'
import test from 'node:test'
import type { OutfitPreview } from '@closet/types'
import {
  cacheRecommendationPreview,
  getRecommendationPreviewKey,
  readRecommendationPreview,
} from '../src/features/plan/utils/recommendationPreviewCache'

const preview: OutfitPreview = {
  imageBase64: 'generated-lookbook',
  mimeType: 'image/png',
  model: 'gpt-image-2',
}

test('같은 사용자·스타일·아이템 조합은 아이템 순서와 무관하게 같은 키를 사용한다', () => {
  const firstKey = getRecommendationPreviewKey(
    'viewer',
    'casual',
    ['outer', 'top', 'bottom'],
  )
  const historyKey = getRecommendationPreviewKey(
    'viewer',
    'casual',
    ['bottom', 'outer', 'top'],
  )

  assert.equal(firstKey, historyKey)
})

test('추천 상세에서 만든 AI 룩북을 같은 히스토리 조합에서 다시 읽는다', () => {
  const key = getRecommendationPreviewKey(
    'viewer',
    'vintage',
    ['corduroy-pants', 'jacket', 'knit'],
  )

  cacheRecommendationPreview(key, preview)

  assert.deepEqual(readRecommendationPreview(key), preview)
})

test('아이템 구성이나 스타일이 다르면 기존 AI 룩북을 재사용하지 않는다', () => {
  const cachedKey = getRecommendationPreviewKey(
    'viewer',
    'casual',
    ['top', 'bottom'],
  )
  cacheRecommendationPreview(cachedKey, preview)

  const changedItemsKey = getRecommendationPreviewKey(
    'viewer',
    'casual',
    ['top', 'other-bottom'],
  )
  const changedStyleKey = getRecommendationPreviewKey(
    'viewer',
    'classic',
    ['top', 'bottom'],
  )

  assert.equal(readRecommendationPreview(changedItemsKey), undefined)
  assert.equal(readRecommendationPreview(changedStyleKey), undefined)
})
