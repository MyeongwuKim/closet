import assert from 'node:assert/strict'
import test from 'node:test'
import type { FashionItemAttributes } from '@closet/types'
import {
  fashionAttributesFromItem,
  mergeEditableFashionAttributes,
} from '../src/features/closet/utils/fashionAttributes'

const analyzedAttributes: FashionItemAttributes = {
  layerRole: 'outer',
  silhouette: 'relaxed',
  pattern: 'solid',
  material: 'synthetic',
  texture: 'smooth',
  warmth: 'light',
  formality: 0.4,
  confidence: 0.8,
}

test('AI 분석값에서 소재와 보온감을 입력값으로 가져온다', () => {
  assert.deepEqual(fashionAttributesFromItem(analyzedAttributes), {
    material: 'synthetic',
    warmth: 'light',
  })
})

test('사용자가 바꾼 소재와 보온감만 기존 분석값에 반영한다', () => {
  const attributes = mergeEditableFashionAttributes(
    analyzedAttributes,
    { material: 'wool', warmth: 'heavy' },
    'outer',
  )

  assert.equal(attributes.material, 'wool')
  assert.equal(attributes.warmth, 'heavy')
  assert.equal(attributes.layerRole, analyzedAttributes.layerRole)
  assert.equal(attributes.silhouette, analyzedAttributes.silhouette)
  assert.equal(attributes.formality, analyzedAttributes.formality)
  assert.equal(attributes.confidence, analyzedAttributes.confidence)
})

test('분석값이 없는 옷도 선택한 값과 카테고리에 맞는 속성을 만든다', () => {
  const attributes = mergeEditableFashionAttributes(
    null,
    { material: 'cotton', warmth: 'medium' },
    'top',
  )

  assert.equal(attributes.layerRole, 'base')
  assert.equal(attributes.material, 'cotton')
  assert.equal(attributes.warmth, 'medium')
  assert.equal(attributes.confidence, 0)
})
