import assert from 'node:assert/strict'
import test from 'node:test'
import { useUiStore, type ClassificationCandidate } from '../src/stores/useUiStore'

function candidate(itemId: string): ClassificationCandidate {
  return {
    itemId, itemName: itemId, imageUrl: 'data:image/png;base64,test', category: 'top',
    subcategory: '셔츠', colorName: '네이비', colorDetailName: '네이비', colorHex: '#24364a',
    colorRgb: [36, 54, 74], colorMode: 'solid', fashionAttributes: null,
    confidence: 0.9, model: 'test', candidates: [], analysisFailed: false,
  }
}

test('먼저 닫힌 사진의 늦은 저장 완료는 다음 등록 후보를 제거하지 않는다', () => {
  useUiStore.setState({ classificationQueue: [candidate('first'), candidate('next')] })
  useUiStore.getState().cancelClassification('first')
  useUiStore.getState().completeClassification('first')
  assert.deepEqual(useUiStore.getState().classificationQueue.map((item) => item.itemId), ['next'])
  useUiStore.getState().completeClassification('next')
  assert.deepEqual(useUiStore.getState().classificationQueue, [])
})
