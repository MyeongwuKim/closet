import assert from 'node:assert/strict'
import test from 'node:test'
import { RawImage } from '@huggingface/transformers'
import { createColorReferenceGuide, createColorReferencePatches, refineGarmentColor, type ColorSampleRegion } from './refineGarmentColor.js'

const navy = { colorName: '네이비', colorDetailName: '딥 네이비', colorHex: '#0F2740', colorMode: 'solid' as const }
const original = { colorName: navy.colorName, colorDetailName: navy.colorDetailName, colorHex: navy.colorHex }
const regions: ColorSampleRegion[] = [
  { x: 0.3, y: 0.3, width: 0.08, height: 0.08 },
  { x: 0.5, y: 0.5, width: 0.08, height: 0.08 },
  { x: 0.4, y: 0.7, width: 0.08, height: 0.08 },
]

async function photo(fabric = '#193138', extra = '') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="240"><rect width="200" height="240" fill="#AB8C72"/><rect x="40" y="40" width="120" height="170" fill="${fabric}"/>${extra}</svg>`
  const image = await RawImage.fromBlob(new Blob([svg], { type: 'image/svg+xml' }))
  return image.toSharp().png().toBuffer()
}

const creamPattern = { colorName: '크림', colorDetailName: '라이트 크림', colorHex: '#F2E6DC', colorMode: 'patterned' as const }
const stripeInk = [66, 106, 86].map((x) => `<rect x="${x}" y="40" width="4" height="170" fill="#293A42"/>`).join('')

test('세 원단 표본의 밝은 바탕에 노란 기운이 없으면 크림 추정을 화이트로 보완한다', async () => {
  const result = await refineGarmentColor(await photo('#D9DEE5', stripeInk), 'image/png', creamPattern, regions)
  assert.equal(result.colorName, '화이트')
  assert.equal(result.colorDetailName, '화이트 바탕')
  assert.equal(result.colorHex, '#F2F2F2')
})

test('실제 크림·파스텔 바탕과 표본이 없는 패턴은 원래 색을 유지한다', async () => {
  const expected = { colorName: creamPattern.colorName, colorDetailName: creamPattern.colorDetailName, colorHex: creamPattern.colorHex }
  for (const fabric of ['#E7DDC9', '#F2E6DC', '#A8B3C5', '#B5A4BB']) {
    assert.deepEqual(await refineGarmentColor(await photo(fabric, stripeInk), 'image/png', creamPattern, regions), expected, fabric)
  }
  const whiteMarks = stripeInk.replaceAll('#293A42', '#FFFFFF')
  assert.deepEqual(await refineGarmentColor(await photo('#E7DDC9', whiteMarks), 'image/png', creamPattern, regions), expected)
  const mixedBase = await photo('#D9DEE5', `${stripeInk}<rect x="100" y="120" width="20" height="24" fill="#F2E6DC"/>`)
  assert.deepEqual(await refineGarmentColor(mixedBase, 'image/png', creamPattern, regions), expected)
  assert.deepEqual(await refineGarmentColor(await photo('#D9DEE5', stripeInk), 'image/png', creamPattern, []), expected)
  assert.deepEqual(await refineGarmentColor(await photo('#D9DEE5', stripeInk), 'image/png', { ...creamPattern, colorMode: 'multicolor' }, regions), expected)
})

test('원단 세 영역이 청록을 가리키면 네이비 추정의 색상 축과 이름을 함께 보완한다', async () => {
  const result = await refineGarmentColor(await photo(), 'image/png', navy, regions)
  assert.equal(result.colorName, '블루')
  assert.equal(result.colorDetailName, '짙은 블루')
  assert.equal(result.colorHex, '#0F3540')
})

test('표본 ID는 사진의 고정 위치와 실제 픽셀을 사용하고 사용할 수 없는 사진은 빈 목록을 반환한다', async () => {
  const patches = await createColorReferencePatches(await photo(), 'image/png')
  assert.equal(patches.length, 64)
  assert.equal(patches.find((patch) => patch.id === 'r2c2')?.colorHex, '#193138')
  assert.equal(patches.find((patch) => patch.id === 'r0c0')?.colorHex, '#AB8C72')
  assert.deepEqual(await createColorReferencePatches(Buffer.from('invalid'), 'image/png'), [])
})

test('위치 참조 이미지를 만들 때 색 표본의 원본 픽셀을 바꾸지 않는다', async () => {
  const bytes = await photo()
  const before = await createColorReferencePatches(bytes, 'image/png')
  const guide = await createColorReferenceGuide(bytes, 'image/png')
  assert.ok(guide)
  assert.deepEqual([...guide.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  assert.deepEqual(await createColorReferencePatches(bytes, 'image/png'), before)
  assert.equal(await createColorReferenceGuide(Buffer.from('invalid'), 'image/png'), null)
})

test('어두운 저채도 원단의 약한 푸른 반사를 유채색으로 과장하지 않는다', async () => {
  const blue = { ...navy, colorName: '블루', colorDetailName: '워시드 블루', colorHex: '#2F3947' }
  for (const colorHex of ['#2F3947', '#3B4047']) {
    const result = await refineGarmentColor(await photo('#393C47'), 'image/png', { ...blue, colorHex }, regions)
    assert.equal(result.colorName, '그레이')
    assert.equal(result.colorHex, '#474747')
  }
  const teal = await refineGarmentColor(await photo('#193138'), 'image/png', blue, regions)
  assert.equal(teal.colorName, '블루')
  assert.notEqual(teal.colorHex, '#474747')
})

test('밝은 청색 표본과 모순되는 네이비 이름은 정리하고 실제 짙은 네이비는 유지한다', async () => {
  const lighter = { ...navy, colorHex: '#28445D' }
  const corrected = await refineGarmentColor(await photo('#2C455E'), 'image/png', lighter, regions)
  assert.equal(corrected.colorName, '블루')
  assert.equal(corrected.colorHex, lighter.colorHex)
  const deep = { ...navy, colorHex: '#27394A' }
  assert.deepEqual(await refineGarmentColor(await photo('#25394B'), 'image/png', deep, regions), {
    colorName: deep.colorName, colorDetailName: deep.colorDetailName, colorHex: deep.colorHex,
  })
})

test('실제 네이비·무채색·패턴과 큰 색상 충돌은 원래 분석을 유지한다', async () => {
  assert.deepEqual(await refineGarmentColor(await photo('#152A4D'), 'image/png', navy, regions), original)
  assert.deepEqual(await refineGarmentColor(await photo('#7A1717'), 'image/png', navy, regions), original)
  for (const colorMode of ['patterned', 'multicolor'] as const) {
    assert.deepEqual(await refineGarmentColor(await photo(), 'image/png', { ...navy, colorMode }, regions), original)
  }
  const gray = { ...navy, colorName: '그레이', colorDetailName: '그레이', colorHex: '#777777' }
  assert.deepEqual(await refineGarmentColor(await photo(), 'image/png', gray, regions), {
    colorName: gray.colorName, colorDetailName: gray.colorDetailName, colorHex: gray.colorHex,
  })
})

test('배경·불일치 표본·겹친 영역·잘못된 좌표·부족한 표본·디코딩 실패는 교정하지 않는다', async () => {
  const bytes = await photo()
  const invalid = [null, [], regions.slice(0, 2), [regions[0], regions[0], regions[2]],
    [{ ...regions[0], x: 0.98 }, ...regions.slice(1)], [{ ...regions[0], width: 0.5 }, ...regions.slice(1)],
    [{ ...regions[0], x: -0.1 }, ...regions.slice(1)],
    [{ x: 0.01, y: 0.01, width: 0.08, height: 0.08 }, ...regions.slice(1)],
  ]
  for (const sample of invalid) assert.deepEqual(await refineGarmentColor(bytes, 'image/png', navy, sample), original)
  const mixed = await photo('#193138', '<rect x="100" y="120" width="20" height="24" fill="#7A1717"/>')
  assert.deepEqual(await refineGarmentColor(mixed, 'image/png', navy, regions), original)
  assert.deepEqual(await refineGarmentColor(Buffer.from('invalid'), 'image/png', navy, regions), original)
})
