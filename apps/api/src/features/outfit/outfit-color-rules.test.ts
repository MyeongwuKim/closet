import assert from 'node:assert/strict'
import test from 'node:test'
import { getColorMatchEvidence, getColorSchemeFitScore, recommendOutfitColors, type ColorRuleItem } from './outfit-color-rules.js'

function item(hex: string | null, category: ColorRuleItem['category'] = 'top', name = '블루'): ColorRuleItem {
  return { name, category, colorName: name, colorHex: hex, colorMode: 'solid' }
}

test('선택 화면의 파스텔 톤온톤·톤인톤 예시를 실제 조합으로 인정한다', () => {
  const toneOnTone = [item('#dce9ef'), item('#8caebe', 'bottom'), item('#375e74', 'outer')]
  const toneInTone = [item('#a8b3c5'), item('#b5a4bb', 'bottom', '퍼플'), item('#afba9d', 'outer', '그린')]
  assert.equal(getColorSchemeFitScore(toneOnTone, 'tone-on-tone'), 1)
  assert.equal(getColorSchemeFitScore(toneInTone, 'tone-in-tone'), 1)
  assert.equal(getColorSchemeFitScore(toneInTone, 'achromatic'), 0)
})

test('무채색과 같은 색·밝기 단일 조합을 톤온톤이나 톤인톤으로 과장하지 않는다', () => {
  const black = item('#242424', 'top', '블랙')
  const white = item('#F2F1EC', 'bottom', '화이트')
  assert.equal(getColorSchemeFitScore([black, white], 'achromatic'), 1)
  assert.equal(getColorSchemeFitScore([black, white], 'tone-on-tone'), 0)
  assert.equal(getColorSchemeFitScore([item('#254F82'), item('#254F82', 'bottom')], 'tone-on-tone'), 0)
  assert.equal(getColorSchemeFitScore([item('#254F82'), item('#82ACE0', 'bottom')], 'tone-in-tone'), 0)
  assert.notEqual(getColorMatchEvidence([black], item('#C9B28F', 'bottom', '베이지')).relation, 'tone-on-tone')
})

test('색을 모르는 옷과 다색 신발은 실제 색 관계를 확정하지 않는다', () => {
  const black = item('#242424', 'dress', '블랙')
  const patternedShoes = { ...item('#E43C45', 'shoes', '레드'), colorMode: 'patterned' }
  assert.equal(getColorSchemeFitScore([black, patternedShoes], 'accent'), 0)
  assert.equal(getColorSchemeFitScore([black, { ...patternedShoes, colorMode: null }], 'accent'), 0)
  const whitePattern = { ...item('#F2F2F2', 'top', '화이트'), colorMode: 'patterned' }
  assert.equal(getColorSchemeFitScore([whitePattern, item('#242424', 'bottom', '블랙')], 'achromatic'), 0)
  assert.notEqual(getColorMatchEvidence([item(null)], item('#82ACE0', 'bottom')).relation, 'tone-on-tone')
})

test('실제 사진에서 추정한 짙은 빨강도 무채색 받침과의 채도 차이가 크면 포인트다', () => {
  const black = item('#2D2C32', 'bottom', '블랙')
  // 사진 표본과 실제 AI 추정값이 기존 절대 채도 경계 0.13의 양쪽에 있던 회귀 사례다.
  for (const hex of ['#9A3140', '#8B2F36', '#852D34', '#91343B', '#5A1F1F']) {
    const red = item(hex, 'top', '레드')
    assert.equal(getColorSchemeFitScore([black, red], 'accent'), 1, hex)
    assert.equal(getColorMatchEvidence([black], red).relation, 'accent', hex)
    assert.notEqual(getColorMatchEvidence([red], black).relation, 'accent', hex)
  }
})

test('촬영 편차가 있는 어두운 유채색끼리는 톤인톤으로 인정하고 큰 명도·채도 차이는 제외한다', () => {
  const navy = item('#13183A', 'bottom', '네이비')
  assert.equal(getColorSchemeFitScore([item('#7A1717', 'top', '레드'), navy], 'tone-in-tone'), 1)
  assert.equal(getColorMatchEvidence([navy], item('#7A1717', 'top', '레드')).relation, 'tone-in-tone')
  for (const hex of ['#C66A6A', '#B50000']) {
    assert.equal(getColorSchemeFitScore([item(hex, 'top', '레드'), navy], 'tone-in-tone'), 0, hex)
  }
})

test('파스텔 하나·선명색 둘·채도 차이가 부족한 두 색은 단일 포인트로 과장하지 않는다', () => {
  const black = item('#242424', 'bottom', '블랙')
  for (const colors of [
    [black, item('#E8BFBF', 'top', '핑크')],
    [item('#0055FF', 'bottom'), item('#DF2B34', 'top', '레드')],
    [item('#697D9B', 'bottom'), item('#8B2F36', 'top', '레드')],
    [item('#8B2F36', 'bottom', '레드'), item('#8B2F36', 'top', '레드')],
    [black, item('#3B2020', 'top', '레드')],
    [black, item('#13183A', 'top', '네이비')],
  ]) assert.equal(getColorSchemeFitScore(colors, 'accent'), 0)
})

test('색 추천은 선택 순서와 무관하고 전체 옷과 실제 HEX를 비교한다', () => {
  const black = item('#242424', 'top', '블랙')
  const blue = item('#0055FF', 'outer', '블루')
  assert.deepEqual(recommendOutfitColors([black, blue], 'bottom'), recommendOutfitColors([blue, black], 'bottom'))
  const pale = recommendOutfitColors([item('#DCE9EF')], 'bottom')
  const vivid = recommendOutfitColors([item('#0033FF')], 'bottom')
  assert.notDeepEqual(pale, vivid)
  assert.ok(pale.some((color) => color.role === 'harmony' && color.reason.includes('톤온톤')))
  assert.ok(recommendOutfitColors([black], 'bottom').some((color) => color.role === 'accent'))
  assert.ok(recommendOutfitColors([black, blue], 'bottom').every((color) => color.role !== 'accent'))
})

test('넓은 색상명이 잘못 저장되어 있어도 실제 HEX로 같은 팔레트를 만든다', () => {
  assert.deepEqual(
    recommendOutfitColors([item('#254F82', 'top', '레드')], 'bottom'),
    recommendOutfitColors([item('#254F82', 'top', '블루')], 'bottom'),
  )
})

test('기존 두 옷의 톤 관계를 무채색 새 후보의 관계로 잘못 설명하지 않는다', () => {
  const toneOnTone = [item('#27394A'), item('#122333', 'bottom', '네이비')]
  const toneInTone = [item('#A8B3C5'), item('#B5A4BB', 'bottom', '퍼플')]
  for (const selected of [toneOnTone, toneInTone]) {
    for (const candidate of [item('#F2F1EC', 'outer', '화이트'), item('#808080', 'outer', '그레이')]) {
      const evidence = getColorMatchEvidence(selected, candidate)
      assert.ok(!['tone-on-tone', 'tone-in-tone'].includes(evidence.relation))
      assert.doesNotMatch(evidence.reason, /톤온톤|톤인톤/)
    }
    const safe = recommendOutfitColors(selected, 'outer').find((color) => color.role === 'safe')!
    assert.doesNotMatch(safe.reason, /톤온톤|톤인톤/)
  }
})
