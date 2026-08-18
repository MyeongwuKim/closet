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

interface RecommendOutfitInput {
  selectedItemIds: string[]
  targetCategory: ClothingCategory
}

interface OpenAiRecommendation {
  headline: string
  summary: string
  recommendedColors: Array<{
    name: string
    reason: string
    role: 'safe' | 'harmony' | 'accent'
  }>
  candidates: Array<{
    wardrobeItemId: string
    reason: string
    relation: OutfitMatchRelation
  }>
}

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

const RELATION_LABELS: Record<OutfitMatchRelation, string> = {
  'clean-contrast': '깔끔한 대비',
  'tone-on-tone': '톤온톤',
  'soft-balance': '부드러운 균형',
  accent: '포인트 조합',
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

function relationForColor(colorName: string, recommendedColors: string[]) {
  const index = recommendedColors.indexOf(colorName)
  if (index === 0) return 'clean-contrast' as const
  if (index === 1) return 'soft-balance' as const
  if (index === 2) return 'tone-on-tone' as const
  return 'accent' as const
}

function createFallbackRecommendation(
  selectedItems: WardrobeItem[],
  candidates: WardrobeItemWithImages[],
  targetCategory: ClothingCategory,
) {
  const recommendedColorNames = getFallbackColorNames(selectedItems)
  const baseColorName = normalizeColorName(selectedItems[0]?.colorName ?? null)
  const fallbackColorSuggestions = [
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
      name: ACCENT_COLOR_BY_BASE[baseColorName] ?? recommendedColorNames.at(-1),
      role: 'accent' as const,
      reason: '무난한 조합에 선명한 포인트를 더해주는 색이에요.',
    },
  ]
  const selectedName = selectedItems[0]?.name ?? '고른 옷'
  const sortedCandidates = [...candidates].sort((left, right) => {
    const leftIndex = recommendedColorNames.indexOf(
      normalizeColorName(left.colorName),
    )
    const rightIndex = recommendedColorNames.indexOf(
      normalizeColorName(right.colorName),
    )
    return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex)
  })

  return {
    targetCategory,
    headline: `${selectedName}에 어울리는 ${categoryLabels[targetCategory]}`,
    summary: '지금 고른 색과 자연스럽게 이어지는 옷을 먼저 모았어요.',
    recommendedColors: fallbackColorSuggestions.flatMap((suggestion) => {
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
    candidates: sortedCandidates.slice(0, 5).map((item) => {
      const colorName = normalizeColorName(item.colorName)
      const relation = relationForColor(colorName, recommendedColorNames)
      return {
        item,
        relation,
        reason: `${colorName} 컬러로 ${RELATION_LABELS[relation]}을 만들기 좋아요.`,
      }
    }),
    model: 'color-rules-v1',
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

function isOpenAiRecommendation(value: unknown): value is OpenAiRecommendation {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<OpenAiRecommendation>
  const recommendedColorRoles = new Set(
    candidate.recommendedColors?.map((color) => color.role) ?? [],
  )
  const recommendedColorNames = new Set(
    candidate.recommendedColors?.map((color) => color.name) ?? [],
  )
  return (
    typeof candidate.headline === 'string' &&
    typeof candidate.summary === 'string' &&
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
    recommendedColorNames.size === 3 &&
    Array.isArray(candidate.candidates)
  )
}

async function requestOpenAiRecommendation(
  userId: string,
  selectedItems: WardrobeItem[],
  candidates: WardrobeItemWithImages[],
  targetCategory: ClothingCategory,
) {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return null

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-5-mini'
  const candidateIds = candidates.map((item) => item.id)
  const colorNames = fashionColorLabels.map((color) => color.name)
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
          content:
            '당신은 일상복 컬러 조합을 돕는 스타일리스트입니다. 사용자가 이미 고른 옷과 목표 카테고리를 보고 컬러를 추천하세요. colorName은 넓은 분류이고 colorDetailName, colorHex, colorRgb는 실제 원단에서 분석한 대표색이므로 상세 톤 판단에는 이 값을 우선하세요. solid는 대표색을 정밀하게 비교하고, patterned 또는 multicolor는 바탕색뿐 아니라 패턴끼리 과하게 경쟁하지 않는지도 고려하세요. 추천 색상은 서로 달라야 하며 safe는 무난한 색, harmony는 자연스럽게 이어지는 색, accent는 확실한 포인트 색으로 각각 하나씩 제안하세요. 옷장 후보가 없더라도 컬러 추천은 반드시 제공하고, 아이템은 제공된 후보 안에서만 추천하세요. 각 이유는 짧은 한국어 한 문장으로 쓰고 절대적인 패션 점수는 만들지 마세요.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            selectedItems: selectedItems.map((item) => ({
              id: item.id,
              name: item.name,
              category: item.category,
              subcategory: item.subcategory,
              colorName: item.colorName,
              colorDetailName: item.colorDetailName,
              colorHex: item.colorHex,
              colorRgb: colorHexToRgb(item.colorHex),
              colorMode: item.colorMode,
            })),
            targetCategory,
            targetCategoryLabel: categoryLabels[targetCategory],
            wardrobeCandidates: candidates.map((item) => ({
              id: item.id,
              name: item.name,
              subcategory: item.subcategory,
              colorName: item.colorName,
              colorDetailName: item.colorDetailName,
              colorHex: item.colorHex,
              colorRgb: colorHexToRgb(item.colorHex),
              colorMode: item.colorMode,
            })),
          }),
        },
      ],
      max_output_tokens: 3000,
      text: {
        format: {
          type: 'json_schema',
          name: 'outfit_color_recommendation',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: [
              'headline',
              'summary',
              'recommendedColors',
              'candidates',
            ],
            properties: {
              headline: { type: 'string' },
              summary: { type: 'string' },
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
                    role: {
                      type: 'string',
                      enum: ['safe', 'harmony', 'accent'],
                    },
                  },
                },
              },
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
                      ],
                    },
                  },
                },
              },
            },
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
  if (!isOpenAiRecommendation(parsed)) {
    throw new Error('OpenAI recommendation output is invalid')
  }

  return { model, recommendation: parsed }
}

export const outfitRecommendationService = {
  async recommend(userId: string, input: RecommendOutfitInput) {
    const selectedItemIds = [...new Set(input.selectedItemIds)]
    if (selectedItemIds.length === 0) {
      throw new ServiceError('기준이 될 옷을 하나 이상 골라주세요.', 'INVALID_OUTFIT_RECOMMENDATION')
    }

    const selectedItemsFromDb = await wardrobeRepository.findManyOwnedByIds(
      userId,
      selectedItemIds,
    )
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
    const candidates = (await wardrobeRepository.findMany(userId, {
      category: input.targetCategory,
    })).filter(
      (item) =>
        !selectedIdSet.has(item.id) && item.classificationStatus === 'classified',
    ) as WardrobeItemWithImages[]

    const fallback = createFallbackRecommendation(
      selectedItems,
      candidates,
      input.targetCategory,
    )

    try {
      const aiResult = await requestOpenAiRecommendation(
        userId,
        selectedItems,
        candidates.slice(0, 30),
        input.targetCategory,
      )
      if (!aiResult) return fallback

      const candidateById = new Map(candidates.map((item) => [item.id, item]))
      const seenCandidateIds = new Set<string>()
      const recommendedCandidates = aiResult.recommendation.candidates.flatMap(
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
          aiResult.recommendation.recommendedColors.flatMap(
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
          recommendedCandidates.length > 0
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
