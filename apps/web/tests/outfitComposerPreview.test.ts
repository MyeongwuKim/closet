import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createOutfitComposerState,
  outfitComposerReducer,
} from '../src/features/lookbook/contexts/OutfitComposerContext'
import { getOutfitPreviewCompositionKey } from '../src/features/lookbook/utils/outfitPreviewCache'

test('첫 스타일 선택은 이미 생성한 AI 이미지와 서버 이미지 ID를 유지한다', () => {
  const itemIds = ['top', 'bottom']
  const previousKey = getOutfitPreviewCompositionKey(itemIds, '')
  const nextKey = getOutfitPreviewCompositionKey(itemIds, 'casual')
  const state = outfitComposerReducer(
    createOutfitComposerState(itemIds.map((wardrobeItemId, order) => ({ wardrobeItemId, order }))),
    {
      type: 'PREVIEW_SUCCESS',
      imageUrl: 'https://images.example.test/preview',
      assetId: 'asset-1',
      compositionKey: previousKey,
      mimeType: 'image/png',
      model: 'test-model',
    },
  )

  const nextState = outfitComposerReducer(state, {
    type: 'REKEY_PREVIEW',
    previousCompositionKey: previousKey,
    compositionKey: nextKey,
  })

  assert.deepEqual(nextState.preview, {
    ...state.preview,
    compositionKey: nextKey,
  })
  assert.equal(nextState.preview.assetId, 'asset-1')
})

test('다른 조합의 AI 이미지는 현재 스타일 키로 재연결하지 않는다', () => {
  const state = outfitComposerReducer(createOutfitComposerState([]), {
    type: 'PREVIEW_SUCCESS',
    imageUrl: 'https://images.example.test/preview',
    assetId: 'asset-1',
    compositionKey: 'previous-composition',
    mimeType: 'image/png',
    model: 'test-model',
  })

  assert.equal(
    outfitComposerReducer(state, {
      type: 'REKEY_PREVIEW',
      previousCompositionKey: 'different-composition',
      compositionKey: 'next-composition',
    }),
    state,
  )
})
