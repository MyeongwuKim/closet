import assert from 'node:assert/strict'
import test from 'node:test'
import type { StoredOutfitPreview } from '@closet/types'
import {
  cacheOutfitPreview,
  getOutfitPreviewCompositionKey,
  readCachedOutfitPreview,
} from '../src/features/lookbook/utils/outfitPreviewCache'

function createMemoryStorage() {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  } satisfies Storage
}

const preview: StoredOutfitPreview = {
  assetId: 'asset-1',
  imageUrl: 'https://images.example.test/asset-1',
  mimeType: 'image/png',
  model: 'test-model',
}

test('아이템 순서가 달라도 같은 AI 룩북 캐시 키를 사용한다', () => {
  assert.equal(
    getOutfitPreviewCompositionKey(['outer', 'top', 'bottom'], 'casual'),
    getOutfitPreviewCompositionKey(['bottom', 'outer', 'top'], 'casual'),
  )
})

test('같은 사용자와 조합의 AI 룩북을 한 시간 동안 다시 사용한다', () => {
  const storage = createMemoryStorage()
  const compositionKey = getOutfitPreviewCompositionKey(
    ['outer', 'top', 'bottom'],
    'casual',
  )
  cacheOutfitPreview('viewer-1', compositionKey, preview, {
    storage,
    now: 1_000,
  })

  assert.deepEqual(
    readCachedOutfitPreview('viewer-1', compositionKey, {
      storage,
      now: 1_000 + 60 * 60 * 1000 - 1,
    }),
    preview,
  )
})

test('한 시간이 지난 임시 AI 룩북 캐시는 제거한다', () => {
  const storage = createMemoryStorage()
  const compositionKey = getOutfitPreviewCompositionKey(
    ['outer', 'top', 'bottom'],
    'casual',
  )
  cacheOutfitPreview('viewer-1', compositionKey, preview, {
    storage,
    now: 1_000,
  })

  assert.equal(
    readCachedOutfitPreview('viewer-1', compositionKey, {
      storage,
      now: 1_000 + 60 * 60 * 1000,
    }),
    undefined,
  )
})
