import type {
  ClothingClassificationResult,
  ClothingClassificationSuggestion,
} from '@closet/types'
import { ServiceError } from '../../graphql/errors.js'
import {
  colorHexToRgb,
  isColorHex,
  normalizeColorHex,
} from './color.js'
import {
  categoryLabels,
  fashionColorLabels,
  fashionTypeLabels,
} from './taxonomy.js'

interface OpenAiClassification {
  classificationKey: string
  colorName: string
  colorDetailName: string
  colorHex: string
  colorMode: 'solid' | 'patterned' | 'multicolor'
  suggestedName: string
  confidence: number
  alternatives: Array<{
    classificationKey: string
    score: number
  }>
}

const classificationEntries = fashionTypeLabels.map((item) => ({
  key: `${item.category}:${item.subcategory}`,
  item,
}))
const classificationByKey = new Map(
  classificationEntries.map((entry) => [entry.key, entry.item]),
)
const classificationKeys = classificationEntries.map((entry) => entry.key)
const colorByName = new Map(
  fashionColorLabels.map((color) => [color.name, color]),
)
const colorNames = fashionColorLabels.map((color) => color.name)

export function getOpenAiClassificationModel() {
  return process.env.OPENAI_MODEL?.trim() || 'gpt-5-mini'
}

function getOutputText(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null

  const response = payload as {
    output_text?: unknown
    output?: Array<{
      type?: unknown
      content?: Array<{ type?: unknown; text?: unknown }>
    }>
  }

  if (typeof response.output_text === 'string') return response.output_text

  for (const output of response.output ?? []) {
    if (output.type !== 'message') continue
    for (const content of output.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        return content.text
      }
    }
  }

  return null
}

function isOpenAiClassification(value: unknown): value is OpenAiClassification {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<OpenAiClassification>

  return (
    typeof candidate.classificationKey === 'string' &&
    classificationByKey.has(candidate.classificationKey) &&
    typeof candidate.colorName === 'string' &&
    colorByName.has(candidate.colorName) &&
    typeof candidate.colorDetailName === 'string' &&
    candidate.colorDetailName.trim().length > 0 &&
    candidate.colorDetailName.trim().length <= 30 &&
    typeof candidate.colorHex === 'string' &&
    isColorHex(candidate.colorHex) &&
    typeof candidate.colorMode === 'string' &&
    ['solid', 'patterned', 'multicolor'].includes(candidate.colorMode) &&
    typeof candidate.suggestedName === 'string' &&
    candidate.suggestedName.trim().length > 0 &&
    candidate.suggestedName.trim().length <= 40 &&
    typeof candidate.confidence === 'number' &&
    candidate.confidence >= 0 &&
    candidate.confidence <= 1 &&
    Array.isArray(candidate.alternatives) &&
    candidate.alternatives.every(
      (alternative) =>
        alternative !== null &&
        typeof alternative === 'object' &&
        typeof alternative.classificationKey === 'string' &&
        classificationByKey.has(alternative.classificationKey) &&
        typeof alternative.score === 'number' &&
        alternative.score >= 0 &&
        alternative.score <= 1,
    )
  )
}

function createCandidates(
  classification: OpenAiClassification,
): ClothingClassificationSuggestion[] {
  const scoredKeys = [
    {
      classificationKey: classification.classificationKey,
      score: classification.confidence,
    },
    ...classification.alternatives,
  ]
  const seen = new Set<string>()

  return scoredKeys.flatMap(({ classificationKey, score }) => {
    if (seen.has(classificationKey)) return []
    seen.add(classificationKey)

    const item = classificationByKey.get(classificationKey)
    if (!item) return []

    return [
      {
        category: item.category,
        subcategory: item.subcategory,
        label: item.label,
        score,
      },
    ]
  }).slice(0, 3)
}

export async function classifyWardrobeImageWithOpenAi(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<ClothingClassificationResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new ServiceError(
      'AI 이미지 분석 설정을 확인해주세요.',
      'AI_CONFIGURATION_ERROR',
    )
  }

  const model = getOpenAiClassificationModel()
  const taxonomy = classificationEntries.map(({ key, item }) => ({
    key,
    label: item.label,
    description: item.prompt,
  }))
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: 'minimal' },
      input: [
        {
          role: 'system',
          content:
            '당신은 옷 한 벌의 상품 사진을 분류하는 패션 이미지 분석가입니다. 사진에서 실제로 보이는 옷만 분석하세요. 배경, 옷걸이, 그림자와 강한 하이라이트는 색상 판단에서 제외하세요. colorName은 제공된 넓은 색상 분류 중 하나를 사용하고, colorHex는 화면에 보이는 원단의 대표색을 #RRGGBB로 추정하세요. colorDetailName은 colorHex의 명도와 채도를 반영한 자연스러운 한국어 상세 색상명(예: 차콜빛 딥 네이비)으로 작성하세요. 단일 색 원단은 solid, 반복되는 스트라이프·체크·프린트가 있으면 patterned, 비슷한 비중의 여러 색 면이 있으면 multicolor로 판단하세요. patterned 또는 multicolor의 colorHex는 가장 넓은 면적의 바탕색을 사용하세요. 먼저 옷의 실제 기장과 실루엣을 확인하세요. 반바지는 바지 밑단이 무릎 위에서 끝날 때만 선택하세요. 와이드 팬츠는 발목까지 내려오는 긴 기장이고 허벅지부터 밑단까지 통이 넓은 바지이며, 밴딩이나 드로스트링 허리여도 와이드 팬츠가 될 수 있습니다. 치노 팬츠는 구조적인 허리단과 앞여밈이 있는 면 트윌 팬츠에 가깝고 밴딩 드로스트링 와이드 팬츠에는 사용하지 마세요. 조거 팬츠는 밑단으로 갈수록 좁아지거나 밑단 밴딩이 있는 경우에 선택하세요. suggestedName은 브랜드를 제외하고 대표 색상, 눈에 띄는 패턴 또는 소재, 세부 종류를 조합한 자연스러운 한국어 이름으로 작성하세요. 확신도는 이미지에서 확인 가능한 정도만 반영하고 애매하면 낮게 주세요.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify({
                task: '옷장 등록용 옷 정보 분석',
                allowedClassifications: taxonomy,
                allowedColors: colorNames,
              }),
            },
            {
              type: 'input_image',
              image_url: `data:${mimeType};base64,${imageBuffer.toString('base64')}`,
              detail: 'high',
            },
          ],
        },
      ],
      max_output_tokens: 1600,
      text: {
        format: {
          type: 'json_schema',
          name: 'wardrobe_image_classification',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: [
              'classificationKey',
              'colorName',
              'colorDetailName',
              'colorHex',
              'colorMode',
              'suggestedName',
              'confidence',
              'alternatives',
            ],
            properties: {
              classificationKey: {
                type: 'string',
                enum: classificationKeys,
              },
              colorName: {
                type: 'string',
                enum: colorNames,
              },
              colorDetailName: {
                type: 'string',
                minLength: 1,
                maxLength: 30,
              },
              colorHex: {
                type: 'string',
                pattern: '^#[0-9A-Fa-f]{6}$',
              },
              colorMode: {
                type: 'string',
                enum: ['solid', 'patterned', 'multicolor'],
              },
              suggestedName: {
                type: 'string',
                minLength: 1,
                maxLength: 40,
              },
              confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1,
              },
              alternatives: {
                type: 'array',
                maxItems: 2,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['classificationKey', 'score'],
                  properties: {
                    classificationKey: {
                      type: 'string',
                      enum: classificationKeys,
                    },
                    score: {
                      type: 'number',
                      minimum: 0,
                      maximum: 1,
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    signal: AbortSignal.timeout(45_000),
  })

  if (!response.ok) {
    throw new Error(`OpenAI clothing classification failed with ${response.status}`)
  }

  const payload: unknown = await response.json()
  const outputText = getOutputText(payload)
  if (!outputText) {
    throw new Error('OpenAI clothing classification output is empty')
  }

  const parsed: unknown = JSON.parse(outputText)
  if (!isOpenAiClassification(parsed)) {
    throw new Error('OpenAI clothing classification output is invalid')
  }

  const type = classificationByKey.get(parsed.classificationKey)!
  const color = colorByName.get(parsed.colorName)!
  const colorHex = normalizeColorHex(parsed.colorHex)
  const colorRgb = colorHexToRgb(colorHex)

  if (!colorRgb) {
    throw new Error('OpenAI clothing classification color is invalid')
  }

  return {
    category: type.category,
    categoryLabel: categoryLabels[type.category],
    subcategory: type.subcategory,
    subcategoryLabel: type.label,
    suggestedName: parsed.suggestedName.trim(),
    colorName: color.name,
    colorDetailName: parsed.colorDetailName.trim(),
    colorHex,
    colorRgb,
    colorMode: parsed.colorMode,
    confidence: parsed.confidence,
    model,
    candidates: createCandidates(parsed),
  }
}
