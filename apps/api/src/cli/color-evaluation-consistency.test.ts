import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateColorConsistency } from './color-evaluation-consistency.js'

test('같은 옷의 촬영 변화와 분석 실패를 분리해 기록한다', () => {
  const photos = ['a', 'b', 'c'].map((id) => ({ id, garmentId: 'shirt', scene: id, expectedColors: ['화이트'] }))
  const result = { colorName: '화이트', colorHex: '#FFFFFF', colorRgb: [255, 255, 255], colorMode: 'solid' }
  const [group] = evaluateColorConsistency(photos, { a: { result, referenceRgb: [240, 240, 240] }, b: { result, referenceRgb: [240, 225, 200] } })
  assert.equal(group.completed, 2)
  assert.equal(group.total, 3)
  assert.equal(group.allExpectedColorFamilies, false)
  assert.equal(group.colorFamilyStable, false)
  assert.equal(group.maxEstimatedDeltaE76, 0)
  assert.ok(group.maxPhotoPixelDeltaE76! > 0)
})

test('촬영에 따른 색 계열 변동과 원래 색 계열 일치 여부를 따로 비교한다', () => {
  const photos = ['a', 'b'].map((id) => ({ id, garmentId: 'shirt', expectedColors: ['블랙'] }))
  const result = { colorName: '블랙', colorHex: '#242424', colorRgb: [36, 36, 36], colorMode: 'solid' }
  const [group] = evaluateColorConsistency(photos, { a: { result }, b: { result: { ...result, colorName: '네이비', colorRgb: [30, 40, 55] } } })
  assert.equal(group.colorFamilyStable, false)
  assert.equal(group.allExpectedColorFamilies, false)
  assert.equal(group.compositionStable, true)
  assert.ok(group.maxEstimatedDeltaE76! > 0)
  assert.equal(group.maxPhotoPixelDeltaE76, null)
})
