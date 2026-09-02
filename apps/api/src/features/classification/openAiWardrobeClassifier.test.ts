import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import type { FashionItemAttributes } from '@closet/types'
import { ServiceError } from '../../graphql/errors.js'
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
  warmth: 'medium',
  formality: 0.4,
  confidence: 0.9,
}
const trimFields = ['ribbedCuffs', 'ribbedHem', 'ribbedNeckline'] as const

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

function mockClassification(t: TestContext, attributes: unknown) {
  return mockOpenAiResponse(t, {
    imageKind: 'fashion_item',
    classificationKey: 'top:knit',
    colorName: '그레이',
    colorDetailName: '그레이',
    colorHex: '#777777',
    colorMode: 'solid',
    suggestedName: '그레이 니트',
    fashionAttributes: attributes,
    confidence: 0.9,
    alternatives: [],
  })
}

test('사람 착용 사진은 최종 이미지 분류 결과에서 차단한다', async (t) => {
  mockOpenAiResponse(t, {
    imageKind: 'person',
    classificationKey: null,
    colorName: null,
    colorDetailName: null,
    colorHex: null,
    colorMode: null,
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
