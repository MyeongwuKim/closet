import type {
  ClothingClassificationResult,
  ClothingClassificationSuggestion,
  FashionItemAttributes,
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

const imageKinds = [
  'fashion_item',
  'person',
  'non_fashion',
  'multiple_items',
  'unclear',
] as const

type ImageKind = (typeof imageKinds)[number]

interface OpenAiClassificationResponse {
  imageKind: ImageKind
  classificationKey: string | null
  colorName: string | null
  colorDetailName: string | null
  colorHex: string | null
  colorMode: 'solid' | 'patterned' | 'multicolor' | null
  fashionAttributes: FashionItemAttributes | null
  suggestedName: string | null
  confidence: number | null
  alternatives: Array<{
    classificationKey: string
    score: number
  }>
}

interface OpenAiClassification extends OpenAiClassificationResponse {
  imageKind: 'fashion_item'
  classificationKey: string
  colorName: string
  colorDetailName: string
  colorHex: string
  colorMode: 'solid' | 'patterned' | 'multicolor'
  fashionAttributes: FashionItemAttributes
  suggestedName: string
  confidence: number
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
const layerRoles = ['base', 'mid', 'outer', 'single', 'unknown'] as const
const silhouettes = ['slim', 'regular', 'relaxed', 'oversized', 'unknown'] as const
const patterns = ['solid', 'stripe', 'check', 'graphic', 'floral', 'other', 'unknown'] as const
const materials = ['cotton', 'denim', 'knit', 'wool', 'leather', 'linen', 'synthetic', 'other', 'unknown'] as const
const textures = [
  'smooth',
  'twill',
  'corduroy',
  'ribbed',
  'cableKnit',
  'fuzzy',
  'boucle',
  'quilted',
  'suede',
  'glossy',
  'distressed',
  'other',
  'unknown',
] as const
const warmthLevels = ['light', 'medium', 'heavy', 'unknown'] as const
const trimPresences = ['present', 'absent', 'unknown'] as const
const personImageAnalysisGuide = [
  'person은 얼굴·피부·손·다리 등 실제 인체가 보이거나 사람이 옷을 착용하고 있다는 시각적 근거가 있을 때만 사용하세요.',
  '후드, 어깨, 소매처럼 사람 형태를 닮은 옷의 실루엣만으로 person을 선택하지 마세요. 사람이 없는 마네킹 또는 옷만 펼쳐 놓은 상품 사진은 다른 조건을 만족하면 fashion_item입니다.',
].join(' ')
const ribbedTrimAnalysisGuide = [
  'fashion_item의 ribbedCuffs는 소매 끝, ribbedHem은 몸판 밑단 또는 바짓단, ribbedNeckline은 목둘레에 있는 별도 시보리(골지 마감 띠)의 유무입니다. 세 부위를 각각 독립적으로 판단하세요.',
  '해당 가장자리와 조직이 선명하게 보여 별도 시보리가 확인되면 present를 사용하세요. 해당 가장자리가 충분히 보이며 시보리 없이 원단이 이어지거나 일반 봉제·말림·비골지 커프스·비골지 밴딩 마감임이 확인될 때만 absent를 사용하세요. 비골지 밴딩이나 주름이 있다는 이유만으로 시보리를 present로 판단하지 마세요.',
  '잘림·가려짐·접힘·흐림 때문에 마감을 확인할 수 없거나 해당 부위가 없는 아이템이면 unknown을 사용하세요. unknown은 시보리가 없다는 뜻이 아닙니다.',
  '몸판 전체의 texture=ribbed와 가장자리의 별도 시보리는 독립입니다. 전체 골지나 니트·맨투맨 같은 옷 종류만으로 시보리를 추정하거나 한 부위의 판정을 다른 부위에 복사하지 마세요.',
].join(' ')

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

function isOpenAiClassificationResponse(
  value: unknown,
): value is OpenAiClassificationResponse {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<OpenAiClassificationResponse>

  return (
    typeof candidate.imageKind === 'string' &&
    imageKinds.includes(candidate.imageKind as ImageKind) &&
    (candidate.classificationKey === null ||
      (typeof candidate.classificationKey === 'string' &&
        classificationByKey.has(candidate.classificationKey))) &&
    (candidate.colorName === null ||
      (typeof candidate.colorName === 'string' &&
        colorByName.has(candidate.colorName))) &&
    (candidate.colorDetailName === null ||
      (typeof candidate.colorDetailName === 'string' &&
        candidate.colorDetailName.trim().length > 0 &&
        candidate.colorDetailName.trim().length <= 30)) &&
    (candidate.colorHex === null ||
      (typeof candidate.colorHex === 'string' &&
        isColorHex(candidate.colorHex))) &&
    (candidate.colorMode === null ||
      (typeof candidate.colorMode === 'string' &&
        ['solid', 'patterned', 'multicolor'].includes(candidate.colorMode))) &&
    (candidate.fashionAttributes === null ||
      isFashionItemAttributes(candidate.fashionAttributes)) &&
    (candidate.suggestedName === null ||
      (typeof candidate.suggestedName === 'string' &&
        candidate.suggestedName.trim().length > 0 &&
        candidate.suggestedName.trim().length <= 40)) &&
    (candidate.confidence === null ||
      (typeof candidate.confidence === 'number' &&
        candidate.confidence >= 0 &&
        candidate.confidence <= 1)) &&
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

function isFashionItemAttributes(value: unknown): value is FashionItemAttributes {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<FashionItemAttributes>
  return (
    typeof candidate.layerRole === 'string' &&
    layerRoles.includes(candidate.layerRole as (typeof layerRoles)[number]) &&
    typeof candidate.silhouette === 'string' &&
    silhouettes.includes(candidate.silhouette as (typeof silhouettes)[number]) &&
    typeof candidate.pattern === 'string' &&
    patterns.includes(candidate.pattern as (typeof patterns)[number]) &&
    typeof candidate.material === 'string' &&
    materials.includes(candidate.material as (typeof materials)[number]) &&
    typeof candidate.texture === 'string' &&
    textures.includes(candidate.texture as (typeof textures)[number]) &&
    typeof candidate.ribbedCuffs === 'string' &&
    trimPresences.includes(candidate.ribbedCuffs) &&
    typeof candidate.ribbedHem === 'string' &&
    trimPresences.includes(candidate.ribbedHem) &&
    typeof candidate.ribbedNeckline === 'string' &&
    trimPresences.includes(candidate.ribbedNeckline) &&
    typeof candidate.warmth === 'string' &&
    warmthLevels.includes(candidate.warmth as (typeof warmthLevels)[number]) &&
    typeof candidate.formality === 'number' &&
    candidate.formality >= 0 &&
    candidate.formality <= 1 &&
    typeof candidate.confidence === 'number' &&
    candidate.confidence >= 0 &&
    candidate.confidence <= 1
  )
}

function isOpenAiFashionClassification(
  value: OpenAiClassificationResponse,
): value is OpenAiClassification {
  return (
    value.imageKind === 'fashion_item' &&
    typeof value.classificationKey === 'string' &&
    typeof value.colorName === 'string' &&
    typeof value.colorDetailName === 'string' &&
    typeof value.colorHex === 'string' &&
    typeof value.colorMode === 'string' &&
    isFashionItemAttributes(value.fashionAttributes) &&
    typeof value.suggestedName === 'string' &&
    typeof value.confidence === 'number'
  )
}

function assertFashionItem(imageKind: ImageKind) {
  if (imageKind === 'fashion_item') return

  const errorByImageKind: Record<Exclude<ImageKind, 'fashion_item'>, {
    message: string
    code: string
  }> = {
    person: {
      message: '사람이 포함된 이미지예요. 옷만 나온 사진을 올려주세요.',
      code: 'PERSON_DETECTED',
    },
    non_fashion: {
      message: '옷이나 패션 아이템을 찾지 못했어요.',
      code: 'FASHION_ITEM_NOT_DETECTED',
    },
    multiple_items: {
      message: '서로 다른 아이템이 여러 개 보여요. 한 번에 한 가지 상품만 올려주세요.',
      code: 'MULTIPLE_FASHION_ITEMS_DETECTED',
    },
    unclear: {
      message: '아이템이 잘 보이는 선명한 사진으로 다시 올려주세요.',
      code: 'UNCLEAR_FASHION_IMAGE',
    },
  }
  const error = errorByImageKind[imageKind]

  throw new ServiceError(error.message, error.code)
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
          content: [
            '먼저 이미지가 옷장에 등록할 수 있는 패션 상품 사진인지 판단하세요. 한 쌍으로 판매되는 신발은 여러 개가 보여도 하나의 fashion_item입니다. 상의와 하의처럼 서로 다른 독립 상품이 함께 있을 때만 multiple_items로 판단하세요. 사람이 보이거나 사람이 직접 착용한 사진은 person, 패션 상품이 아닌 사진은 non_fashion, 상품을 신뢰할 수 있게 확인하기 어려운 사진은 unclear로 판단하세요. imageKind가 fashion_item이 아니면 분류·색상·이름·확신도·fashionAttributes 필드는 null, alternatives는 빈 배열로 응답하세요. fashion_item일 때만 다음 규칙으로 분석하세요. 당신은 옷 한 벌의 상품 사진을 분류하는 패션 이미지 분석가입니다. 사진에서 실제로 보이는 옷만 분석하세요. 배경, 옷걸이, 그림자와 강한 하이라이트는 색상 판단에서 제외하세요. colorName은 제공된 넓은 색상 분류 중 하나를 사용하고, colorHex는 화면에 보이는 원단의 대표색을 #RRGGBB로 추정하세요. colorDetailName은 colorHex의 명도와 채도를 반영한 자연스러운 한국어 상세 색상명(예: 차콜빛 딥 네이비)으로 작성하세요. 단일 색 원단은 solid, 반복되는 스트라이프·체크·프린트가 있으면 patterned, 비슷한 비중의 여러 색 면이 있으면 multicolor로 판단하세요. patterned 또는 multicolor의 colorHex는 가장 넓은 면적의 바탕색을 사용하세요. fashionAttributes는 스타일 이름이 아니라 사진에서 관찰 가능한 속성만 기록하세요. layerRole은 피부나 속옷 위에 입는 기본 상의면 base, 가디건·베스트·집업 같은 중간 겹이면 mid, 외투면 outer, 하의·원피스·신발·액세서리는 single입니다. silhouette는 몸에 붙는 정도와 전체 품으로 판단하고, pattern과 material은 확실히 보일 때만 구체값을 사용하세요. material은 면·울·가죽 같은 원재료이고 texture는 표면 조직과 가공입니다. texture는 매끈하면 smooth, 사선 능직이 보이면 twill, 세로 골이 반복되면 corduroy, 가는 골지는 ribbed, 굵은 꽈배기 조직은 cableKnit, 보풀이 길고 포근하면 fuzzy, 고리진 조직은 boucle, 누빔은 quilted, 스웨이드 결은 suede, 광택이 강하면 glossy, 의도적인 워싱·헤짐은 distressed로 구분하세요. 질감이 이미지에서 확실하지 않으면 unknown을 사용하세요. warmth는 원단 두께와 보온성을 light·medium·heavy로 판단하세요. formality는 매우 편한 일상복 0에서 정장용 1 사이의 값입니다. fashionAttributes.confidence는 이 속성들을 사진에서 확인할 수 있는 정도이며 애매한 속성은 unknown을 사용하세요. 먼저 옷의 실제 기장과 실루엣을 확인하세요. 반바지는 바지 밑단이 무릎 위에서 끝날 때만 선택하세요. 와이드 팬츠는 발목까지 내려오는 긴 기장이고 허벅지부터 밑단까지 통이 넓은 바지이며, 밴딩이나 드로스트링 허리여도 와이드 팬츠가 될 수 있습니다. 치노 팬츠는 구조적인 허리단과 앞여밈이 있는 면 트윌 팬츠에 가깝고 밴딩 드로스트링 와이드 팬츠에는 사용하지 마세요. 조거 팬츠는 밑단으로 갈수록 좁아지거나 밑단 밴딩이 있는 경우에 선택하세요. suggestedName은 브랜드를 제외하고 대표 색상, 눈에 띄는 패턴 또는 소재, 세부 종류를 조합한 자연스러운 한국어 이름으로 작성하세요. 확신도는 이미지에서 확인 가능한 정도만 반영하고 애매하면 낮게 주세요.',
            personImageAnalysisGuide,
            ribbedTrimAnalysisGuide,
          ].join('\n\n'),
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
              'imageKind',
              'classificationKey',
              'colorName',
              'colorDetailName',
              'colorHex',
              'colorMode',
              'fashionAttributes',
              'suggestedName',
              'confidence',
              'alternatives',
            ],
            properties: {
              imageKind: {
                type: 'string',
                enum: imageKinds,
              },
              classificationKey: {
                type: ['string', 'null'],
                enum: [...classificationKeys, null],
              },
              colorName: {
                type: ['string', 'null'],
                enum: [...colorNames, null],
              },
              colorDetailName: {
                type: ['string', 'null'],
                minLength: 1,
                maxLength: 30,
              },
              colorHex: {
                type: ['string', 'null'],
                pattern: '^#[0-9A-Fa-f]{6}$',
              },
              colorMode: {
                type: ['string', 'null'],
                enum: ['solid', 'patterned', 'multicolor', null],
              },
              fashionAttributes: {
                type: ['object', 'null'],
                additionalProperties: false,
                required: [
                  'layerRole',
                  'silhouette',
                  'pattern',
                  'material',
                  'texture',
                  'ribbedCuffs',
                  'ribbedHem',
                  'ribbedNeckline',
                  'warmth',
                  'formality',
                  'confidence',
                ],
                properties: {
                  layerRole: { type: 'string', enum: layerRoles },
                  silhouette: { type: 'string', enum: silhouettes },
                  pattern: { type: 'string', enum: patterns },
                  material: { type: 'string', enum: materials },
                  texture: { type: 'string', enum: textures },
                  ribbedCuffs: { type: 'string', enum: trimPresences },
                  ribbedHem: { type: 'string', enum: trimPresences },
                  ribbedNeckline: { type: 'string', enum: trimPresences },
                  warmth: { type: 'string', enum: warmthLevels },
                  formality: { type: 'number', minimum: 0, maximum: 1 },
                  confidence: { type: 'number', minimum: 0, maximum: 1 },
                },
              },
              suggestedName: {
                type: ['string', 'null'],
                minLength: 1,
                maxLength: 40,
              },
              confidence: {
                type: ['number', 'null'],
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
  if (!isOpenAiClassificationResponse(parsed)) {
    throw new Error('OpenAI clothing classification output is invalid')
  }
  assertFashionItem(parsed.imageKind)
  if (!isOpenAiFashionClassification(parsed)) {
    throw new Error('OpenAI fashion item classification output is invalid')
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
    fashionAttributes: parsed.fashionAttributes,
    confidence: parsed.confidence,
    model,
    candidates: createCandidates(parsed),
  }
}
