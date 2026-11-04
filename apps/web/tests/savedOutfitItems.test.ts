import assert from 'node:assert/strict'
import test from 'node:test'
import type { WardrobeItem } from '@closet/types'
import { toSavedOutfit, type OutfitPayload } from '../src/features/lookbook/api/lookbookQueries'
import type { WardrobeItemPayload } from '../src/features/closet/api/wardrobeQueries'
import { useClosetStore } from '../src/features/closet/stores/useClosetStore'
import { getSavedOutfitItems } from '../src/features/lookbook/utils/savedOutfitItems'
import { filterSavedOutfits } from '../src/features/lookbook/utils/outfitFilters'

function payload(id: string, archivedAt: string | null = null): WardrobeItemPayload {
  return {
    id, name: `${id} 코트`, archivedAt, brandName: null, createdAt: '2026-11-01T00:00:00.000Z',
    category: 'outer', additionalCategories: [], subcategory: null, colorName: '네이비',
    colorDetailName: null, colorHex: '#24364a', colorMode: null, fashionAttributes: null,
    seasons: ['autumn'], tags: [], sizeLabel: null, shoulderWidthCm: null,
    chestWidthCm: null, sleeveLengthCm: null, totalLengthCm: null, waistWidthCm: null,
    hipWidthCm: null, inseamCm: null, thighWidthCm: null, riseCm: null, hemWidthCm: null,
    classificationStatus: 'classified', wearCount: 1, lastWornAt: '2026-11-02',
    displayImageAsset: { deliveryUrl: `https://example.test/${id}.png` }, originalImageAsset: null,
  }
}

function outfitPayload(): OutfitPayload {
  return {
    id: 'book', name: 'ABC 코디', style: 'casual', seasons: ['autumn'], createdAt: '2026-11-01T00:00:00.000Z',
    items: [
      { wardrobeItemId: 'A', layerOrder: 1, wardrobeItem: payload('A') },
      { wardrobeItemId: 'B', layerOrder: 0, wardrobeItem: payload('B', '2026-11-05T00:00:00.000Z') },
      { wardrobeItemId: 'C', layerOrder: 2, wardrobeItem: payload('C') },
    ],
    generations: [{ status: 'completed', imageAsset: { deliveryUrl: 'https://example.test/old-ai.png' } }],
  }
}

test('코디 응답은 삭제된 옷의 이름·사진·상태와 기존 AI 사진을 활성 목록 없이 보관한다', () => {
  const outfit = toSavedOutfit(outfitPayload())
  const items = getSavedOutfitItems(outfit, [])
  assert.deepEqual(items.map((item) => item.id), ['B', 'A', 'C'])
  assert.equal(items[0]?.name, 'B 코트')
  assert.equal(items[0]?.imageUrl, 'https://example.test/B.png')
  assert.equal(items[0]?.archivedAt, '2026-11-05T00:00:00.000Z')
  assert.equal(outfit.previewImageUrl, 'https://example.test/old-ai.png')
})

test('코디의 삭제 상태를 오래된 활성 캐시보다 우선하고 관계가 없는 기존 코디는 활성 옷으로 표시한다', () => {
  const outfit = toSavedOutfit(outfitPayload())
  const stale = { ...outfit.outfitItems![1]!, archivedAt: null }
  assert.ok(getSavedOutfitItems(outfit, [stale])[0]?.archivedAt)
  const layers = [...outfit.layers]
  const legacy = { ...outfit, outfitItems: undefined }
  assert.deepEqual(getSavedOutfitItems(legacy, [stale]).map((item) => item.id), ['B'])
  assert.deepEqual(outfit.layers, layers)
})

test('삭제된 옷 관계를 읽어도 활성 선택 Store에 다시 넣지 않고 코디 표시 정보는 유지한다', () => {
  const original = useClosetStore.getState().items
  try {
    const outfit = toSavedOutfit(outfitPayload())
    const all = outfit.outfitItems!
    const store = useClosetStore.getState()
    store.hydrateItems(all)
    assert.deepEqual(useClosetStore.getState().items.map((item) => item.id), ['A', 'C'])
    store.mergeItems([{ ...all[1]!, archivedAt: null }])
    store.mergeItems(all)
    assert.deepEqual(useClosetStore.getState().items.map((item) => item.id), ['A', 'C'])
    assert.deepEqual(getSavedOutfitItems(outfit, useClosetStore.getState().items).map((item) => item.id), ['B', 'A', 'C'])
  } finally {
    useClosetStore.setState({ items: original })
  }
})

test('주간 편집의 코디 검색도 삭제된 옷의 이름과 색상을 찾는다', () => {
  const outfit = toSavedOutfit(outfitPayload())
  const options = { outfits: [outfit], wardrobeItems: [] as WardrobeItem[], activeStyle: 'all', activeSeason: null, searchQuery: 'B 코트', activeColor: '네이비' }
  assert.deepEqual(filterSavedOutfits(options), [outfit])
  assert.deepEqual(filterSavedOutfits({ ...options, searchQuery: '없는 옷' }), [])
})

test('옷을 교체한 저장 응답에는 삭제된 옷을 다시 섞지 않고 새 사진과 구성을 사용한다', () => {
  const previous = toSavedOutfit(outfitPayload())
  const nextPayload = outfitPayload()
  nextPayload.items = nextPayload.items.map((item) => item.wardrobeItemId === 'B'
    ? { wardrobeItemId: 'D', layerOrder: 0, wardrobeItem: payload('D') } : item)
  nextPayload.generations = []
  const next = toSavedOutfit(nextPayload)
  const items = getSavedOutfitItems(next, previous.outfitItems!)
  assert.deepEqual(items.map((item) => item.id), ['D', 'A', 'C'])
  assert.equal(items.some((item) => item.archivedAt), false)
  assert.equal(next.previewImageUrl, undefined)
  assert.equal(previous.previewImageUrl, 'https://example.test/old-ai.png')
})
