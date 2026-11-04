import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import type { FashionItemAttributes } from '@closet/types'
import { ServiceError } from '../../graphql/errors.js'
import { RawImage } from '@huggingface/transformers'
import { classifyWardrobeImageWithOpenAi } from './openAiWardrobeClassifier.js'

const fashionAttributes: FashionItemAttributes = {
  layerRole: 'base',
  silhouette: 'relaxed',
  pattern: 'solid',
  material: 'knit',
  texture: 'ribbed',
  ribbedCuffs: 'present',
  ribbedHem: 'absent',
  ribbedNeckline: 'unknown',
  necklineStyle: 'crew',
  frontOpeningStyle: 'none',
  pocketStyle: 'none',
  bottomLegShape: 'unknown',
  bottomWaistStyle: 'unknown',
  bottomFrontPleats: 'unknown',
  warmth: 'medium',
  formality: 0.4,
  confidence: 0.9,
}
const trimFields = ['ribbedCuffs', 'ribbedHem', 'ribbedNeckline'] as const
const shapeFields = [
  'necklineStyle',
  'frontOpeningStyle',
  'pocketStyle',
  'bottomLegShape',
  'bottomWaistStyle',
  'bottomFrontPleats',
] as const

function mockOpenAiResponse(t: TestContext, output: unknown) {
  const previousKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = 'test-key'
  t.after(() => {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previousKey
  })

  return t.mock.method(globalThis, 'fetch', async (url: unknown, _options?: RequestInit) => {
    assert.equal(url, 'https://api.openai.com/v1/responses')
    return Response.json({
      output_text: JSON.stringify(output),
    })
  })
}

function mockClassification(t: TestContext, attributes: unknown, overrides: Record<string, unknown> = {}) {
  return mockOpenAiResponse(t, {
    imageKind: 'fashion_item',
    classificationKey: 'top:knit',
    colorName: '그레이',
    colorDetailName: '그레이',
    colorHex: '#777777',
    colorMode: 'solid',
    colorSamplePatchIds: [],
    suggestedName: '그레이 니트',
    fashionAttributes: attributes,
    confidence: 0.9,
    alternatives: [],
    ...overrides,
  })
}

test('최종 분류 결과의 검정 HEX와 RGB에 사진 픽셀 보정을 함께 반영한다', async (t) => {
  mockOpenAiResponse(t, {
    imageKind: 'fashion_item', classificationKey: 'top:knit', colorName: '블랙',
    colorDetailName: '블랙', colorHex: '#111111', colorMode: 'solid', suggestedName: '블랙 니트',
    colorSamplePatchIds: [],
    fashionAttributes, confidence: 0.9, alternatives: [],
  })
  const image = await RawImage.fromBlob(new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="160" height="200"><rect width="160" height="200" fill="white"/><rect x="35" y="40" width="90" height="130" fill="#2D2C32"/></svg>'], { type: 'image/svg+xml' }))
  const result = await classifyWardrobeImageWithOpenAi(await image.toSharp().png().toBuffer(), 'image/png')
  assert.equal(result.colorHex, '#2D2C32')
  assert.deepEqual(result.colorRgb, [45, 44, 50])
})

test('실제 픽셀 표본을 전달하고 교정된 색 계열·상세명·이름·HEX·RGB를 함께 반환한다', async (t) => {
  const request = mockClassification(t, fashionAttributes, {
    colorName: '네이비', colorDetailName: '딥 네이비', colorHex: '#0F2740', suggestedName: '딥 네이비 니트',
    colorSamplePatchIds: ['r2c2', 'r4c4', 'r6c3'],
  })
  const image = await RawImage.fromBlob(new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="200" height="240"><rect width="200" height="240" fill="white"/><rect x="40" y="40" width="120" height="170" fill="#193138"/></svg>'], { type: 'image/svg+xml' }))
  const result = await classifyWardrobeImageWithOpenAi(await image.toSharp().png().toBuffer(), 'image/png')
  assert.equal(result.colorName, '블루')
  assert.equal(result.colorDetailName, '짙은 블루')
  assert.equal(result.suggestedName, '짙은 블루 니트')
  assert.equal(result.colorHex, '#0F3540')
  assert.deepEqual(result.colorRgb, [15, 53, 64])
  const body = JSON.parse(String(request.mock.calls[0].arguments[1]?.body))
  assert.ok(body.text.format.schema.required.includes('colorSamplePatchIds'))
  assert.equal(body.text.format.schema.properties.colorSamplePatchIds.items.pattern, '^r[0-7]c[0-7]$')
  const prompt = JSON.parse(body.input[1].content[0].text)
  assert.equal(prompt.colorReferencePatches.find((patch: { id: string }) => patch.id === 'r2c2').colorHex, '#193138')
  assert.match(body.input[0].content, /서로 떨어진 원단 세 곳/)
})

test('흰 패턴 바탕의 크림 추정을 보완해도 패턴 구분을 유지하고 색 이름·HEX·RGB를 함께 반영한다', async (t) => {
  const request = mockClassification(t, { ...fashionAttributes, pattern: 'stripe' }, {
    colorName: '크림', colorDetailName: '라이트 크림', colorHex: '#F2E6DC', colorMode: 'patterned',
    suggestedName: '크림 스트라이프 니트', colorSamplePatchIds: ['r2c2', 'r4c4', 'r6c3'],
  })
  const stripes = [66, 106, 86].map((x) => `<rect x="${x}" y="40" width="4" height="170" fill="#293A42"/>`).join('')
  const image = await RawImage.fromBlob(new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="240"><rect width="200" height="240" fill="#AB8C72"/><rect x="40" y="40" width="120" height="170" fill="#D9DEE5"/>${stripes}</svg>`], { type: 'image/svg+xml' }))
  const result = await classifyWardrobeImageWithOpenAi(await image.toSharp().png().toBuffer(), 'image/png')
  assert.equal(result.colorName, '화이트')
  assert.equal(result.colorHex, '#F2F2F2')
  assert.deepEqual(result.colorRgb, [242, 242, 242])
  assert.equal(result.colorMode, 'patterned')
  assert.equal(result.fashionAttributes?.pattern, 'stripe')
  assert.equal(result.suggestedName, '화이트 바탕 니트')
  const body = JSON.parse(String(request.mock.calls[0].arguments[1]?.body))
  assert.match(body.input[0].content, /patterned이면 가장 넓은 같은 바탕색/)
  assert.equal(body.input[1].content.filter((part: { type: string }) => part.type === 'input_image').length, 2)
  assert.match(body.input[0].content, /초록 사각형이 원단을 가리키는지 확인/)
})

test('잘못된 표본 ID는 거절하고 사용할 수 없는 표본은 원래 분석으로 처리한다', async (t) => {
  for (const value of [undefined, 'invalid', [2], ['r8c0']]) {
    await t.test(`invalid regions: ${JSON.stringify(value)}`, async (t) => {
      mockClassification(t, fashionAttributes, { colorSamplePatchIds: value })
      await assert.rejects(classifyWardrobeImageWithOpenAi(Buffer.from('unused'), 'image/png'), /output is invalid/)
    })
  }
  mockClassification(t, fashionAttributes, {
    colorName: '네이비', colorDetailName: '네이비', colorHex: '#0F2740',
    colorSamplePatchIds: ['r2c2', 'r4c4', 'r6c3'],
  })
  const result = await classifyWardrobeImageWithOpenAi(Buffer.from('unused'), 'image/png')
  assert.equal(result.colorHex, '#0F2740')
})

test('사람 착용 사진은 최종 이미지 분류 결과에서 차단한다', async (t) => {
  mockOpenAiResponse(t, {
    imageKind: 'person',
    classificationKey: null,
    colorName: null,
    colorDetailName: null,
    colorHex: null,
    colorMode: null,
    colorSamplePatchIds: null,
    suggestedName: null,
    fashionAttributes: null,
    confidence: null,
    alternatives: [],
  })

  await assert.rejects(
    classifyWardrobeImageWithOpenAi(Buffer.from('person-image'), 'image/jpeg'),
    (error: unknown) =>
      error instanceof ServiceError && error.code === 'PERSON_DETECTED',
  )
})

test('옷 실루엣만으로 사람이라고 판정하지 않도록 기준을 전달한다', async (t) => {
  const request = mockClassification(t, fashionAttributes)

  await classifyWardrobeImageWithOpenAi(
    Buffer.from('standalone-jacket-image'),
    'image/jpeg',
  )

  const options = request.mock.calls[0]?.arguments[1]
  const body = JSON.parse(String(options?.body))
  const systemPrompt = body.input[0].content as string

  assert.match(systemPrompt, /실제 인체가 보이거나/)
  assert.match(systemPrompt, /옷의 실루엣만으로 person을 선택하지 마세요/)
  assert.match(systemPrompt, /옷만 펼쳐 놓은 상품 사진.*fashion_item/)
})

test('분석 요청은 세 시보리 판정을 필수 enum으로 요구하고 관찰 기준을 전달한다', async (t) => {
  const request = mockClassification(t, fashionAttributes)
  const result = await classifyWardrobeImageWithOpenAi(Buffer.from('test-image'), 'image/png')
  const options = request.mock.calls[0]?.arguments[1]
  const body = JSON.parse(String(options?.body))
  const attributeSchema = body.text.format.schema.properties.fashionAttributes
  const systemPrompt = body.input[0].content as string

  assert.equal(body.text.format.strict, true)
  for (const field of trimFields) {
    assert.ok(attributeSchema.required.includes(field))
    assert.equal(attributeSchema.properties[field].type, 'string')
    assert.deepEqual(attributeSchema.properties[field].enum, ['present', 'absent', 'unknown'])
  }
  assert.match(systemPrompt, /해당 가장자리가 충분히 보이며/)
  assert.match(systemPrompt, /잘림·가려짐·접힘·흐림/)
  assert.match(systemPrompt, /비골지 밴딩이나 주름/)
  assert.match(systemPrompt, /texture=ribbed.*독립/)
  assert.deepEqual(result.fashionAttributes, fashionAttributes)
})

test('전체 골지여도 별도 시보리 없음과 확인불가 판정을 바꾸지 않는다', async (t) => {
  for (const presence of ['absent', 'unknown'] as const) {
    await t.test(presence, async (t) => {
      const attributes = {
        ...fashionAttributes,
        ribbedCuffs: presence,
        ribbedHem: presence,
        ribbedNeckline: presence,
      }
      mockClassification(t, attributes)
      const result = await classifyWardrobeImageWithOpenAi(Buffer.from('test-image'), 'image/png')
      assert.deepEqual(result.fashionAttributes, attributes)
    })
  }
})

test('분석 요청은 옷 이름 대신 관찰 가능한 형태 속성을 요구한다', async (t) => {
  const request = mockClassification(t, fashionAttributes)

  await classifyWardrobeImageWithOpenAi(Buffer.from('test-image'), 'image/png')

  const options = request.mock.calls[0]?.arguments[1]
  const body = JSON.parse(String(options?.body))
  const attributeSchema = body.text.format.schema.properties.fashionAttributes
  const systemPrompt = body.input[0].content as string

  for (const field of shapeFields) {
    assert.ok(attributeSchema.required.includes(field))
    assert.equal(attributeSchema.properties[field].type, 'string')
  }
  assert.match(systemPrompt, /necklineStyle, frontOpeningStyle, pocketStyle/)
  assert.match(systemPrompt, /허벅지 옆에 돌출된 덮개형 수납 포켓은 cargo/)
  assert.match(systemPrompt, /세부 종류 이름을 그대로 복사하지 말고/)
})

test('새 분석 응답은 시보리 필드의 누락·null·잘못된 값을 허용하지 않는다', async (t) => {
  for (const field of trimFields) {
    for (const invalid of [undefined, null, 'ribbed', true]) {
      await t.test(`${field}: ${String(invalid)}`, async (t) => {
        mockClassification(t, { ...fashionAttributes, [field]: invalid })
        await assert.rejects(
          classifyWardrobeImageWithOpenAi(Buffer.from('test-image'), 'image/png'),
          /classification output is invalid/,
        )
      })
    }
  }
})

test('새 분석 응답은 형태 필드 누락을 허용하지 않는다', async (t) => {
  for (const field of shapeFields) {
    await t.test(field, async (t) => {
      mockClassification(t, { ...fashionAttributes, [field]: undefined })
      await assert.rejects(
        classifyWardrobeImageWithOpenAi(Buffer.from('test-image'), 'image/png'),
        /classification output is invalid/,
      )
    })
  }
})
