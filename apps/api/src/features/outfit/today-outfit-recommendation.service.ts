import { createHash } from 'node:crypto'
import type {
  OutfitStyle,
  PreferredFit,
  Prisma,
  Season,
} from '@prisma/client'
import { parseDateOnly } from '../../lib/date.js'
import { userRepository } from '../user/user.repository.js'
import {
  wardrobeItemInclude,
  wardrobeRepository,
} from '../wardrobe/wardrobe.repository.js'
import {
  buildOutfitCombinations,
  excludeOuterItems,
  getFashionAttributes,
  styleDefinitions,
  type OutfitCombination,
} from './outfit-style-rules.js'

interface TodayOutfitRecommendationInput {
  date: string
  season: Season
  style?: OutfitStyle | null
  variation?: number | null
  excludedOuterItemIds?: string[] | null
}

type WardrobeItemWithImages = Prisma.WardrobeItemGetPayload<{
  include: typeof wardrobeItemInclude
}>

type ViewerProfile = Awaited<ReturnType<typeof userRepository.findViewerById>>

interface OpenAiTodayRecommendation {
  headline: string
  summary: string
  candidateId: string
  reasons: string[]
}

const seasonLabels: Record<Season, string> = {
  spring: '봄',
  summer: '여름',
  autumn: '가을',
  winter: '겨울',
}

const styleLabels: Record<OutfitStyle, string> = {
  minimal: '미니멀',
  casual: '캐주얼',
  street: '스트릿',
  classic: '클래식',
  vintage: '빈티지',
  sporty: '스포티',
}

const fitLabels: Record<PreferredFit, string> = {
  wide: '여유로운 핏',
  regular: '기본 핏',
  skinny: '슬림한 핏',
}

const categoryLabels: Record<
  NonNullable<WardrobeItemWithImages['category']>,
  string
> = {
  top: '상의',
  bottom: '하의',
  outer: '아우터',
  midlayer: '중간 레이어',
  dress: '원피스',
  shoes: '신발',
  accessory: '액세서리',
  other: '기타',
}

const layerRoleLabels = {
  base: '기본 상의',
  mid: '중간 레이어',
  outer: '아우터',
  single: '단독 아이템',
  unknown: '확인 어려움',
} as const

const silhouetteLabels = {
  slim: '슬림 핏',
  regular: '기본 핏',
  relaxed: '여유로운 핏',
  oversized: '오버핏',
  unknown: '확인 어려움',
} as const

const patternLabels = {
  solid: '무지',
  stripe: '스트라이프',
  check: '체크',
  graphic: '그래픽',
  floral: '플로럴',
  other: '기타 패턴',
  unknown: '확인 어려움',
} as const

const materialLabels = {
  cotton: '면',
  denim: '데님',
  knit: '니트',
  wool: '울',
  leather: '가죽',
  linen: '린넨',
  synthetic: '합성 소재',
  other: '기타 소재',
  unknown: '확인 어려움',
} as const

const warmthLabels = {
  light: '가벼움',
  medium: '보통',
  heavy: '도톰함',
  unknown: '확인 어려움',
} as const

const styleOrder: OutfitStyle[] = [
  'minimal',
  'casual',
  'street',
  'classic',
  'vintage',
  'sporty',
]

function isSeasonSuitable(item: WardrobeItemWithImages, season: Season) {
  return item.seasons.includes(season)
}

function getProfileSummary(profile: ViewerProfile) {
  const gender = profile?.styleProfile?.gender
  const fit = profile?.styleProfile?.preferredFit ?? 'regular'
  const styles = profile?.preferredStyles.map(({ style }) => style) ?? []
  return [
    gender === 'male' ? '남성 프로필' : gender === 'female' ? '여성 프로필' : null,
    styles.length > 0
      ? `${styles.map((style) => styleLabels[style]).join('·')} 취향`
      : null,
    fitLabels[fit],
  ].filter((value): value is string => Boolean(value))
}

function getFormalityLabel(value: number) {
  if (value <= 0.3) return '편안한 일상복에 가까움'
  if (value <= 0.6) return '일상적으로 단정한 편'
  if (value <= 0.8) return '격식이 있는 편'
  return '격식이 높은 편'
}

function getRecommendationAttributes(item: WardrobeItemWithImages) {
  const attributes = getFashionAttributes(item)
  return {
    레이어역할: layerRoleLabels[attributes.layerRole],
    실루엣: silhouetteLabels[attributes.silhouette],
    패턴: patternLabels[attributes.pattern],
    소재: materialLabels[attributes.material],
    두께감: warmthLabels[attributes.warmth],
    격식도: getFormalityLabel(attributes.formality),
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

function isOpenAiTodayRecommendation(value: unknown): value is OpenAiTodayRecommendation {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<OpenAiTodayRecommendation>
  return (
    typeof candidate.headline === 'string' &&
    typeof candidate.summary === 'string' &&
    typeof candidate.candidateId === 'string' &&
    Array.isArray(candidate.reasons) &&
    candidate.reasons.every((reason) => typeof reason === 'string')
  )
}

export function normalizeTodayOutfitHeadline(value: string) {
  const normalized = value
    .trim()
    .replace(/^추천\s*코디\s*[—–-]\s*/u, '')
    .replace(/\s*(?:루킹|룩킹)/gu, ' 코디')
    .replace(/코디(?:\s+코디)+/gu, '코디')
    .replace(/\s+/gu, ' ')
    .trim()

  return normalized || '오늘의 추천 코디'
}

async function requestOpenAiRecommendation(
  userId: string,
  date: string,
  variation: number,
  season: Season,
  targetStyle: OutfitStyle,
  profile: ViewerProfile,
  candidates: OutfitCombination<WardrobeItemWithImages>[],
) {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return null

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-5-mini'
  const candidateIds = candidates.map((candidate) => candidate.id)
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
            '당신은 사용자의 실제 옷장으로 미리 검증된 완성 코디 후보 중 하나를 고르는 스타일리스트입니다.',
            '아이템을 새로 조합하거나 candidate 안의 아이템을 빼지 말고 반드시 제공된 candidateId 하나만 선택하세요.',
            '스타일은 개별 아이템의 이름이나 카테고리가 아니라 candidate 전체 조합이 만드는 인상으로 판단하세요.',
            '셔츠, 슬랙스, 후드, 스니커즈처럼 여러 스타일에 쓰일 수 있는 아이템을 특정 스타일 전용으로 간주하지 마세요.',
            '먼저 상의·하의·아우터·신발의 실루엣과 볼륨 균형을 보고, 다음으로 소재의 구조감, 전체 격식도, 레이어 관계, 패턴과 색 조화를 평가하세요.',
            '각 옷의 관찰 속성은 판단 단서일 뿐 그 자체가 스타일 이름은 아닙니다. 한 속성이나 키워드만 일치하는 후보보다 여러 아이템의 관계가 목표 스타일을 만드는 후보를 우선하세요.',
            '예를 들어 셔츠는 데님과 스니커즈를 만나면 캐주얼할 수 있고, 테일러드 슬랙스와 로퍼 또는 블레이저를 만나면 클래식할 수 있습니다.',
            '슬랙스도 여유로운 상의, 와이드한 실루엣, 편한 신발과 조합되면 캐주얼할 수 있습니다. 다만 와이드 아이템 하나만으로 캐주얼이나 스트릿이라고 단정하지 마세요.',
            '목표 스타일과 스타일 가이드를 가장 우선하고 사용자가 선호하는 핏은 착용 취향을 반영하는 보조 기준으로 사용하세요.',
            '후보는 이미 계절과 레이어 규칙을 통과했으므로 아우터가 있는 조합에서는 이너를 생략하지 마세요.',
            '성별은 스타일링 맥락으로만 참고하고 고정관념으로 옷을 제한하지 마세요.',
            'headline은 사용자가 바로 이해할 수 있는 자연스러운 한국어 코디 제목으로 작성하세요. "추천 코디 —" 같은 앞말을 붙이지 말고 "루킹", "룩킹" 같은 번역투 대신 "코디"를 사용하세요.',
            'summary와 reasons는 아이템 이름을 나열하거나 스타일을 반영했다는 말만 하지 말고, 어떤 실루엣과 아이템 관계가 목표 스타일을 만드는지 제공된 정보 안에서 구체적으로 설명하세요.',
            'summary는 한두 개의 완결된 한국어 문장으로 작성하고 reasons의 각 항목도 한 문장으로 끝내세요. 글자 수를 맞추려고 단어나 문장을 중간에서 자르지 말고 내용의 수를 줄여서라도 반드시 자연스럽게 끝내세요.',
            '사용자에게 보여주는 headline, summary, reasons에는 candidateId, targetStyle, preferredFit, fashionAttributes 같은 내부 필드명이나 regular, relaxed 같은 영문 분류값, 점수, 코드, 괄호로 덧붙인 메타데이터를 절대 노출하지 마세요. 모든 속성은 기본 핏, 여유로운 핏처럼 자연스러운 한국어로 풀어 쓰세요.',
            '날씨는 아직 연결되지 않았으므로 언급하지 마세요.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify({
            date,
            season: seasonLabels[season],
            variation,
            targetStyle: styleLabels[targetStyle],
            styleGuide: styleDefinitions[targetStyle].description,
            profile: {
              성별:
                profile?.styleProfile?.gender === 'male'
                  ? '남성'
                  : profile?.styleProfile?.gender === 'female'
                    ? '여성'
                    : '지정하지 않음',
              선호하는핏:
                fitLabels[profile?.styleProfile?.preferredFit ?? 'regular'],
            },
            candidates: candidates.map((candidate) => ({
              candidateId: candidate.id,
              items: candidate.items.map((item) => ({
                id: item.id,
                이름: item.name,
                종류: item.category ? categoryLabels[item.category] : null,
                세부종류: item.subcategory,
                대표색: item.colorName,
                상세색: item.colorDetailName,
                색구성:
                  item.colorMode === 'solid'
                    ? '단색'
                    : item.colorMode === 'patterned'
                      ? '패턴'
                      : item.colorMode === 'multicolor'
                        ? '여러 색'
                        : '확인 어려움',
                관찰속성: getRecommendationAttributes(item),
              })),
            })),
          }),
        },
      ],
      max_output_tokens: 1600,
      text: {
        format: {
          type: 'json_schema',
          name: 'today_outfit_recommendation',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['headline', 'summary', 'candidateId', 'reasons'],
            properties: {
              headline: { type: 'string', minLength: 1, maxLength: 80 },
              summary: { type: 'string', minLength: 1, maxLength: 240 },
              candidateId: { type: 'string', enum: candidateIds },
              reasons: {
                type: 'array',
                minItems: 1,
                maxItems: 3,
                items: { type: 'string', minLength: 1, maxLength: 160 },
              },
            },
          },
        },
      },
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`OpenAI today recommendation failed with ${response.status}`)
  const outputText = getOutputText(await response.json())
  if (!outputText) throw new Error('OpenAI today recommendation output is empty')
  const parsed: unknown = JSON.parse(outputText)
  if (!isOpenAiTodayRecommendation(parsed)) {
    throw new Error('OpenAI today recommendation output is invalid')
  }
  return { model, recommendation: parsed }
}

function hasCategory(
  item: WardrobeItemWithImages,
  category: WardrobeItemWithImages['category'],
) {
  return (
    item.category === category ||
    (category !== null && item.additionalCategories.includes(category))
  )
}

function getEmptySummary(
  season: Season,
  items: WardrobeItemWithImages[],
) {
  const hasBottom = items.some((item) => hasCategory(item, 'bottom'))
  const hasOuter = items.some((item) => hasCategory(item, 'outer'))
  const hasBaseTop = items.some(
    (item) =>
      hasCategory(item, 'top') &&
      !['outer', 'mid'].includes(getFashionAttributes(item).layerRole),
  )

  if (hasBottom && hasOuter && !hasBaseTop) {
    return `${seasonLabels[season]} 아우터 안에 입을 이너 상의가 부족해요. 다른 계절 옷은 섞지 않았어요.`
  }
  return `옷장에 ${seasonLabels[season]}용 이너 상의와 하의 또는 원피스가 충분하지 않아요. 다른 계절 옷은 섞지 않았어요.`
}

function createEmptyRecommendation(
  date: string,
  season: Season,
  targetStyle: OutfitStyle,
  profile: ViewerProfile,
  items: WardrobeItemWithImages[],
) {
  return {
    date,
    season,
    ready: false,
    headline: `${seasonLabels[season]} 코디를 추천하기 어려워요`,
    summary: getEmptySummary(season, items),
    style: targetStyle,
    items: [],
    reasons: [],
    profileSummary: getProfileSummary(profile),
    model: 'wardrobe-combination-rules-v2',
    source: 'fallback',
  }
}

export const todayOutfitRecommendationService = {
  async recommend(userId: string, input: TodayOutfitRecommendationInput) {
    parseDateOnly(input.date, '추천 날짜')
    const variation = Math.max(0, Math.min(Math.trunc(input.variation ?? 0), 20))
    const season = input.season
    const [profile, wardrobeItems] = await Promise.all([
      userRepository.findViewerById(userId),
      wardrobeRepository.findMany(userId, {}),
    ])
    const classifiedItems = wardrobeItems.filter(
      (item): item is WardrobeItemWithImages =>
        item.classificationStatus === 'classified' &&
        Boolean(item.category) &&
        item.category !== 'other',
    )
    const seasonalItems = classifiedItems.filter((item) =>
      isSeasonSuitable(item, season),
    )
    const recommendationItems = excludeOuterItems(
      seasonalItems,
      (input.excludedOuterItemIds ?? []).slice(0, 10),
    )
    const preferredStyleSet = new Set(
      profile?.preferredStyles.map(({ style }) => style) ?? [],
    )
    const preferredStyles = styleOrder.filter((style) =>
      preferredStyleSet.has(style),
    )
    const targetStyle =
      input.style ??
      (preferredStyles.length > 0
        ? preferredStyles[variation % preferredStyles.length]
        : 'casual')
    const preferredFit = profile?.styleProfile?.preferredFit ?? 'regular'
    const combinations = buildOutfitCombinations(
      recommendationItems,
      targetStyle,
      preferredFit,
      season,
    )
    if (combinations.length === 0) {
      return createEmptyRecommendation(
        input.date,
        season,
        targetStyle,
        profile,
        seasonalItems,
      )
    }

    const fallbackCombination =
      combinations[variation % Math.min(combinations.length, 6)]!
    const hasStylePreference = Boolean(input.style) || preferredStyles.length > 0
    const fallback = {
      date: input.date,
      season,
      ready: true,
      headline: hasStylePreference
        ? `오늘은 ${styleLabels[targetStyle]}하게 입어보세요`
        : '오늘은 이 조합으로 입어보세요',
      summary: hasStylePreference
        ? `${seasonLabels[season]} 계절 정보와 내 옷장, 저장한 취향을 기준으로 골랐어요.`
        : `${seasonLabels[season]} 계절 정보와 내 옷장 아이템을 기준으로 골랐어요.`,
      style: targetStyle,
      items: fallbackCombination.items,
      reasons: [
        hasStylePreference
          ? `${styleLabels[targetStyle]} 기준과 ${fitLabels[preferredFit]}을 반영했어요.`
          : `${fitLabels[preferredFit]}과 계절 정보를 반영했어요.`,
        '이너·하의·레이어 역할을 먼저 맞춘 뒤 색과 실루엣을 비교했어요.',
      ],
      profileSummary: getProfileSummary(profile),
      model: 'wardrobe-combination-rules-v2',
      source: 'fallback',
    }

    try {
      const aiResult = await requestOpenAiRecommendation(
        userId,
        input.date,
        variation,
        season,
        targetStyle,
        profile,
        combinations,
      )
      if (!aiResult) return fallback

      const selectedCombination = combinations.find(
        (candidate) =>
          candidate.id === aiResult.recommendation.candidateId,
      )
      if (!selectedCombination) return fallback

      return {
        date: input.date,
        season,
        ready: true,
        headline: normalizeTodayOutfitHeadline(
          aiResult.recommendation.headline,
        ),
        summary: aiResult.recommendation.summary.trim(),
        style: targetStyle,
        items: selectedCombination.items,
        reasons: aiResult.recommendation.reasons.map((reason) => reason.trim()),
        profileSummary: getProfileSummary(profile),
        model: aiResult.model,
        source: 'ai',
      }
    } catch (error) {
      console.warn(
        '[today-outfit-recommendation] falling back to wardrobe rules:',
        error instanceof Error ? error.message : 'unknown error',
      )
      return fallback
    }
  },
}
