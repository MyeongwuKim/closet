import assert from 'node:assert/strict'
import test from 'node:test'
import { RawImage } from '@huggingface/transformers'
import { refineBlackColor } from './refineBlackColor.js'

const black = { colorName: '블랙', colorMode: 'solid' as const, colorHex: '#111111' }

/** 배경·원단·그림자·로고를 분리해 보정과 보정 포기 조건을 확인하는 픽셀 입력을 만든다. */
async function photo(options: { background?: string; fabric?: string; extra?: string; shape?: string } = {}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="200"><rect width="160" height="200" fill="${options.background ?? '#E7E7E9'}"/>${options.shape ?? `<rect x="35" y="40" width="90" height="130" fill="${options.fabric ?? '#2D2C32'}"/>`}${options.extra ?? ''}</svg>`
  const image = await RawImage.fromBlob(new Blob([svg], { type: 'image/svg+xml' }))
  return image.toSharp().png().toBuffer()
}

test('밝은 균일 배경의 검정 원단을 AI의 관념적인 검정 대신 사진 픽셀로 보완한다', async () => {
  const bytes = await photo({ extra: '<rect x="35" y="40" width="12" height="130" fill="#151517"/><rect x="70" y="55" width="15" height="8" fill="white"/>' })
  assert.equal(await refineBlackColor(bytes, 'image/png', black), '#2D2C32')
  assert.equal(await refineBlackColor(await photo({ fabric: '#2E2E2E' }), 'image/png', black), '#2E2E2E')
})

test('투명 배경에서도 원단을 표본으로 사용한다', async () => {
  assert.equal(await refineBlackColor(await photo({ background: 'none' }), 'image/png', black), '#2D2C32')
})

test('검정 외 색과 패턴·다색은 픽셀 보정을 적용하지 않는다', async () => {
  const bytes = await photo()
  for (const color of [
    { ...black, colorName: '네이비' }, { ...black, colorMode: 'patterned' as const },
    { ...black, colorMode: 'multicolor' as const }, { ...black, colorHex: '#777777' },
  ]) assert.equal(await refineBlackColor(bytes, 'image/png', color), color.colorHex)
})

test('어두운 배경·복잡한 테두리·큰 물체 둘·잘린 옷은 원래 추정값을 유지한다', async () => {
  const cases = [
    { background: '#222222' },
    { extra: '<rect x="0" y="0" width="160" height="8" fill="#777777"/>' },
    { shape: '<rect x="12" y="40" width="60" height="120" fill="#2D2C32"/><rect x="88" y="40" width="60" height="120" fill="#2D2C32"/>' },
    { shape: '<rect x="0" y="40" width="100" height="130" fill="#2D2C32"/>' },
    { fabric: '#324468' },
    { shape: '<rect x="60" y="80" width="12" height="12" fill="#2D2C32"/>' },
  ]
  for (const options of cases) assert.equal(await refineBlackColor(await photo(options), 'image/png', black), '#111111', JSON.stringify(options))
  assert.equal(await refineBlackColor(Buffer.from('invalid'), 'image/png', black), '#111111')
})
