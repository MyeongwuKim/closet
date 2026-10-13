import { createHash } from 'node:crypto'
import type {
  ClothingCategory,
  Prisma,
  WardrobeItem,
} from '@prisma/client'
import type { OutfitMatchRelation } from '@closet/types'
import { ServiceError } from '../../graphql/errors.js'
import { colorHexToRgb } from '../classification/color.js'
import { categoryLabels, fashionColorLabels } from '../classification/taxonomy.js'
import {
  wardrobeItemInclude,
  wardrobeRepository,
} from '../wardrobe/wardrobe.repository.js'
import { getFashionAttributes } from './outfit-style-rules.js'
import { rankOutfitMatchCandidates } from './outfit-recommendation-matching.js'

interface RecommendOutfitInput {
  selectedItemIds: string[]
  targetCategory: ClothingCategory
  /** 생략하면 기존 호출자처럼 색과 옷을 함께 추천한다. */
  mode?: 'colors' | 'items' | null
}

interface OpenAiRecommendation {
  headline: string
  summary: string
  recommendedColors?: Array<{
    name: string
    reason: string
    role: 'safe' | 'harmony' | 'accent'
  }>
  candidates?: Array<{
    wardrobeItemId: string
    reason: string
    relation: OutfitMatchRelation
  }>
}

type RecommendationMode = 'colors' | 'items' | 'both'

type WardrobeItemWithImages = Prisma.WardrobeItemGetPayload<{
  include: typeof wardrobeItemInclude
}>

const COLOR_BY_NAME = new Map(
  fashionColorLabels.map((color) => [color.name, color]),
)

const COLOR_MATCHES: Record<string, string[]> = {
  블랙: ['화이트', '그레이', '베이지', '크림', '레드'],
  화이트: ['네이비', '블랙', '베이지', '브라운', '블루'],
  크림: ['브라운', '네이비', '베이지', '올리브', '그레이'],
  베이지: ['화이트', '네이비', '브라운', '블랙', '올리브'],
  그레이: ['블랙', '화이트', '네이비', '핑크', '블루'],
  네이비: ['화이트', '크림', '베이지', '그레이', '브라운'],
  블루: ['화이트', '그레이', '베이지', '네이비', '브라운'],
  브라운: ['크림', '베이지', '화이트', '네이비', '올리브'],
  레드: ['블랙', '화이트', '네이비', '그레이', '크림'],
  핑크: ['그레이', '화이트', '네이비', '크림', '브라운'],
  오렌지: ['네이비', '크림', '브라운', '화이트', '올리브'],
  옐로: ['네이비', '그레이', '화이트', '브라운', '올리브'],
  그린: ['크림', '베이지', '네이비', '브라운', '화이트'],
  올리브: ['크림', '베이지', '브라운', '블랙', '화이트'],
  퍼플: ['그레이', '크림', '블랙', '화이트', '네이비'],
  다색: ['블랙', '화이트', '크림', '베이지', '네이비'],
}

const ACCENT_COLOR_BY_BASE: Record<string, string> = {
  블랙: '레드',
  화이트: '레드',
  크림: '올리브',
  베이지: '블루',
  그레이: '핑크',
  네이비: '오렌지',
  블루: '브라운',
  브라운: '블루',
  레드: '블루',
  핑크: '그린',
  오렌지: '블루',
  옐로: '퍼플',
  그린: '핑크',
  올리브: '오렌지',
  퍼플: '옐로',
  다색: '네이비',
}

function normalizeColorName(colorName: string | null) {
  const trimmed = colorName?.trim() ?? ''
  if (COLOR_BY_NAME.has(trimmed)) return trimmed

  return (
    fashionColorLabels.find((color) =>
      trimmed.toLowerCase().includes(color.name.toLowerCase()),
    )?.name ?? '다색'
  )
}

function getFallbackColorNames(selectedItems: WardrobeItem[]) {
  const colors = selectedItems.flatMap((item) =>
    COLOR_MATCHES[normalizeColorName(item.colorName)] ?? [],
  )

  return [...new Set(colors)].slice(0, 5)
}

/** AI를 사용할 수 없을 때 요청 모드에 필요한 색 또는 옷 후보만 구성한다. */
function createFallbackRecommendation(
  selectedItems: WardrobeItem[],
  candidates: WardrobeItemWithImages[],
  targetCategory: ClothingCategory,
  mode: RecommendationMode,
) {
  const recommendedColorNames = getFallbackColorNames(selectedItems)
  const fallbackColorSuggestions = mode === 'items' ? [] : [
    {
      name: recommendedColorNames[0],
      role: 'safe' as const,
      reason: '어떤 아이템과도 안정적으로 이어지는 색이에요.',
    },
    {
      name: recommendedColorNames[2] ?? recommendedColorNames[1],
      role: 'harmony' as const,
      reason: '고른 옷의 분위기를 부드럽게 이어주는 색이에요.',
    },
    {
      name: ACCENT_COLOR_BY_BASE[normalizeColorName(selectedItems[0]?.colorName ?? null)] ?? recommendedColorNames.at(-1),
      role: 'accent' as const,
      reason: '무난한 조합에 선명한 포인트를 더해주는 색이에요.',
    },
  ]
  const selectedName = selectedItems[0]?.name ?? '고른 옷'
  return {
    targetCategory,
    headline: `${selectedName}에 어울리는 ${categoryLabels[targetCategory]}`,
    summary: mode === 'colors'
      ? '지금 고른 옷과 어울리는 색을 모았어요.'
      : '지금 고른 옷과 어울리는 아이템을 모았어요.',
    recommendedColors: mode === 'items' ? [] : fallbackColorSuggestions.flatMap((suggestion) => {
      if (!suggestion.name) return []
      const color = COLOR_BY_NAME.get(suggestion.name)
      return color
        ? [
            {
              name: color.name,
              hex: color.hex,
              reason: suggestion.reason,
              role: suggestion.role,
            },
          ]
        : []
    }),
    candidates: mode === 'colors' ? [] : rankOutfitMatchCandidates(
      selectedItems,
      candidates,
      recommendedColorNames,
    ),
    model: 'outfit-match-rules-v2',
    source: 'fallback',
  }
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

function getResponseDiagnostics(payload: unknown) {
  if (!payload || typeof payload !== 'object') return 'invalid-payload'
  const response = payload as {
    status?: unknown
    incomplete_details?: { reason?: unknown }
    output?: Array<{ type?: unknown; content?: Array<{ type?: unknown }> }>
  }
  const outputTypes = (response.output ?? []).map((output) => ({
    type: output.type,
    contentTypes: (output.content ?? []).map((content) => content.type),
  }))
  return JSON.stringify({
    status: response.status,
    incompleteReason: response.incomplete_details?.reason,
    outputTypes,
  })
}

/** 요청 모드에 필요한 배열과 값만 검증한다. 다른 모드의 배열은 응답 스키마에 포함하지 않는다. */
function isOpenAiRecommendation(
  value: unknown,
  mode: RecommendationMode,
): value is OpenAiRecommendation {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<OpenAiRecommendation>
  const recommendedColorRoles = new Set(
    candidate.recommendedColors?.map((color) => color.role) ?? [],
  )
  const recommendedColorNames = new Set(
    candidate.recommendedColors?.map((color) => color.name) ?? [],
  )
  const hasColors =
    Array.isArray(candidate.recommendedColors) &&
    candidate.recommendedColors.every(
      (color) =>
        color !== null &&
        typeof color === 'object' &&
        typeof color.name === 'string' &&
        typeof color.reason === 'string' &&
        ['safe', 'harmony', 'accent'].includes(color.role),
    ) &&
    recommendedColorRoles.size === 3 &&
    recommendedColorNames.size === 3
  const hasCandidates =
    Array.isArray(candidate.candidates) &&
    candidate.candidates.every(
      (item) =>
        item !== null &&
        typeof item === 'object' &&
        typeof item.wardrobeItemId === 'string' &&
        typeof item.reason === 'string' &&
        ['clean-contrast', 'tone-on-tone', 'soft-balance', 'accent', 'design-balance'].includes(item.relation),
    )
  return (
    typeof candidate.headline === 'string' &&
    typeof candidate.summary === 'string' &&
    (mode === 'items' || hasColors) &&
    (mode === 'colors' || hasCandidates)
  )
}

/** 선택 모드에 필요한 저장된 분류 속성만 AI에 전달한다. 키가 없으면 null을 반환한다. */
async function requestOpenAiRecommendation(
  userId: string,
  selectedItems: WardrobeItem[],
  candidates: WardrobeItemWithImages[],
  targetCategory: ClothingCategory,
  mode: RecommendationMode,
) {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return null

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-5-mini'
  const candidateIds = candidates.map((item) => item.id)
  const colorNames = fashionColorLabels.map((color) => color.name)
  const colorRules = [
    '색은 colorName보다 실제 원단에서 분석한 colorDetailName, colorHex, colorRgb의 톤을 우선하세요. patterned 또는 multicolor는 패턴끼리 과하게 경쟁하지 않는지도 고려하세요.',
    '추천 색상은 서로 달라야 하며 safe는 무난한 색, harmony는 자연스럽게 이어지는 색, accent는 확실한 포인트 색으로 각각 하나씩 제안하세요.',
  ]
  const itemRules = [
    '옷 후보는 색뿐 아니라 subcategory와 fashionAttributes의 실루엣 균형, 패턴, 소재와 질감, 두께감, 격식도, 레이어 역할을 함께 비교하세요.',
    'fashionAttributes의 unknown은 판단 근거에서 제외하고 confidence가 낮으면 그 속성을 확정적으로 설명하지 마세요. 모든 디자인 조합에 통하는 절대 규칙이나 패션 점수를 만들지 마세요.',
    '후보마다 실제 입력으로 뒷받침되는 디자인 또는 색 조합 이유를 짧은 한국어 문장으로 쓰세요. 디자인 정보가 충분하면 색과 디자인을 함께 설명하세요.',
    '후보의 주요 추천 이유가 디자인 균형이면 relation은 design-balance로 표시하세요.',
  ]
  const outputProperties = {
    headline: { type: 'string' },
    summary: { type: 'string' },
    ...(mode === 'items' ? {} : {
      recommendedColors: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'reason', 'role'],
          properties: {
            name: { type: 'string', enum: colorNames },
            reason: { type: 'string' },
            role: { type: 'string', enum: ['safe', 'harmony', 'accent'] },
          },
        },
      },
    }),
    ...(mode === 'colors' ? {} : {
      candidates: {
        type: 'array',
        maxItems: candidateIds.length > 0 ? 5 : 0,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['wardrobeItemId', 'reason', 'relation'],
          properties: {
            wardrobeItemId:
              candidateIds.length > 0
                ? { type: 'string', enum: candidateIds }
                : { type: 'string' },
            reason: { type: 'string' },
            relation: {
              type: 'string',
              enum: [
                'clean-contrast',
                'tone-on-tone',
                'soft-balance',
                'accent',
                'design-balance',
              ],
            },
          },
        },
      },
    }),
  }
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      store: false,
      safety_identifier: createHash('sha256').update(userId).digest('hex'),
      reasoning: { effort: 'minimal' },
      input: [
        {
          role: 'system',
          content: [
            '당신은 일상복 조합을 돕는 스타일리스트입니다. 선호 스타일이나 선호 핏을 가정하지 마세요. 옷 사진은 전달되지 않으므로 입력에 없는 디자인 특징을 상상하지 마세요.',
            ...(mode === 'items' ? [] : colorRules),
            ...(mode === 'colors' ? [] : itemRules),
            mode === 'colors'
              ? '사용자가 고른 옷에 어울리는 컬러만 추천하세요. 옷장 후보와 아이템 추천은 만들지 마세요.'
              : mode === 'items'
                ? '제공된 옷장 후보 중 실제로 어울리는 옷만 추천하세요. 별도의 컬러 팔레트는 만들지 마세요.'
                : '컬러와 실제 옷을 함께 추천하세요. 옷장 후보가 없더라도 컬러는 제안하고, 아이템은 제공된 후보 안에서만 추천하세요.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify({
            selectedItems: selectedItems.map((item) => ({
              id: item.id,
              name: item.name,
              category: item.category,
              colorName: item.colorName,
              colorDetailName: item.colorDetailName,
              colorHex: item.colorHex,
              colorRgb: colorHexToRgb(item.colorHex),
              colorMode: item.colorMode,
              ...(mode === 'colors' ? {} : {
                subcategory: item.subcategory,
                fashionAttributes: getFashionAttributes(item),
              }),
            })),
            targetCategory,
            targetCategoryLabel: categoryLabels[targetCategory],
            ...(mode === 'colors' ? {} : { wardrobeCandidates: candidates.map((item) => ({
              id: item.id,
              name: item.name,
              subcategory: item.subcategory,
              colorName: item.colorName,
              colorDetailName: item.colorDetailName,
              colorHex: item.colorHex,
              colorRgb: colorHexToRgb(item.colorHex),
              colorMode: item.colorMode,
              fashionAttributes: getFashionAttributes(item),
            })) }),
          }),
        },
      ],
      max_output_tokens: 3000,
      text: {
        format: {
          type: 'json_schema',
          name: `outfit_${mode}_recommendation`,
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: [
              'headline',
              'summary',
              ...(mode === 'items' ? [] : ['recommendedColors']),
              ...(mode === 'colors' ? [] : ['candidates']),
            ],
            properties: outputProperties,
          },
        },
      },
    }),
    signal: AbortSignal.timeout(25_000),
  })

  if (!response.ok) {
    throw new Error(`OpenAI recommendation failed with ${response.status}`)
  }

  const payload: unknown = await response.json()
  const outputText = getOutputText(payload)
  if (!outputText) {
    throw new Error(
      `OpenAI recommendation output is empty: ${getResponseDiagnostics(payload)}`,
    )
  }

  const parsed: unknown = JSON.parse(outputText)
  if (!isOpenAiRecommendation(parsed, mode)) {
    throw new Error('OpenAI recommendation output is invalid')
  }

  return { model, recommendation: parsed }
}

/** 선택한 옷을 검증하고 요청 모드에 필요한 색 또는 옷 후보만 조회·분석한다. */
export const outfitRecommendationService = {
  async recommend(userId: string, input: RecommendOutfitInput) {
    const mode: RecommendationMode = input.mode ?? 'both'
    const selectedItemIds = [...new Set(input.selectedItemIds)]
    if (selectedItemIds.length === 0) {
      throw new ServiceError('기준이 될 옷을 하나 이상 골라주세요.', 'INVALID_OUTFIT_RECOMMENDATION')
    }

    const selectedItemsFromDb = await wardrobeRepository.findManyOwnedByIds(userId, selectedItemIds)
    if (
      selectedItemsFromDb.length !== selectedItemIds.length ||
      selectedItemsFromDb.some(
        (item) => item.classificationStatus !== 'classified' || !item.category,
      )
    ) {
      throw new ServiceError(
        '분류가 완료된 내 옷장 아이템만 추천에 사용할 수 있습니다.',
        'INVALID_OUTFIT_RECOMMENDATION',
      )
    }

    const selectedItemById = new Map(
      selectedItemsFromDb.map((item) => [item.id, item]),
    )
    const selectedItems = selectedItemIds.map(
      (itemId) => selectedItemById.get(itemId)!,
    )
    const selectedIdSet = new Set(selectedItemIds)
    const candidates = mode === 'colors'
      ? []
      : (await wardrobeRepository.findMany(userId, {
        category: input.targetCategory,
      })).filter(
        (item) =>
          !selectedIdSet.has(item.id) && item.classificationStatus === 'classified',
      ) as WardrobeItemWithImages[]

    const fallback = createFallbackRecommendation(
      selectedItems,
      candidates,
      input.targetCategory,
      mode,
    )

    try {
      const aiResult = await requestOpenAiRecommendation(
        userId,
        selectedItems,
        mode === 'colors'
          ? []
          : rankOutfitMatchCandidates(
            selectedItems,
            candidates,
            getFallbackColorNames(selectedItems),
            30,
          ).map(({ item }) => item),
        input.targetCategory,
        mode,
      )
      if (!aiResult) return fallback

      const candidateById = new Map(candidates.map((item) => [item.id, item]))
      const seenCandidateIds = new Set<string>()
      const recommendedCandidates = (aiResult.recommendation.candidates ?? []).flatMap(
        (candidate) => {
          const item = candidateById.get(candidate.wardrobeItemId)
          if (!item || seenCandidateIds.has(item.id)) return []
          seenCandidateIds.add(item.id)
          return [
            {
              item,
              reason: candidate.reason.trim(),
              relation: candidate.relation,
            },
          ]
        },
      )

      return {
        targetCategory: input.targetCategory,
        headline: aiResult.recommendation.headline.trim(),
        summary: aiResult.recommendation.summary.trim(),
        recommendedColors:
          (mode === 'items' ? [] : aiResult.recommendation.recommendedColors ?? []).flatMap(
            ({ name, reason, role }) => {
              const color = COLOR_BY_NAME.get(name)
              return color
                ? [
                    {
                      name: color.name,
                      hex: color.hex,
                      reason: reason.trim(),
                      role,
                    },
                  ]
                : []
            },
          ),
        candidates:
          mode !== 'colors' && recommendedCandidates.length > 0
            ? recommendedCandidates
            : fallback.candidates,
        model: aiResult.model,
        source: 'ai' as const,
      }
    } catch (error) {
      console.warn(
        '[outfit-recommendation] falling back to color rules:',
        error instanceof Error ? error.message : 'unknown error',
      )
      return fallback
    }
  },
}
