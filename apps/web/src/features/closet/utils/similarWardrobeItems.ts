/**
 * 용도:
 * 새로 등록할 옷과 옷장 아이템의 색상 및 관찰 가능한 형태 속성을 비교한다.
 *
 * 동작 방식:
 * 같은 세부 카테고리 안에서 색차와 형태 속성을 따로 계산하고,
 * 넥라인·여밈·포켓처럼 구분력이 높은 정보가 부족하면 점수를 보수적으로 낮춘다.
 */
import type {
  ClothingCategory,
  ColorMode,
  FashionItemAttributes,
  FashionTexture,
  WardrobeItem,
} from '@closet/types'
import { wardrobeItemHasCategory } from './wardrobeCategories'

interface LabColor {
  l: number
  a: number
  b: number
}

export interface SimilarWardrobeItemInput {
  itemName?: string
  category: ClothingCategory
  subcategory: string
  colorName: string
  colorHex: string
  colorMode: ColorMode | null
  fashionAttributes: FashionItemAttributes | null
}

export type SimilarWardrobeItemKind =
  | 'near-duplicate'
  | 'similar-design'
  | 'similar-color'

export interface SimilarWardrobeItemMatch {
  item: WardrobeItem
  kind: SimilarWardrobeItemKind
  colorDistance: number
  colorSimilarityPercent: number
  designSimilarityPercent: number | null
  similarityPercent: number
  reasons: string[]
}

// CIE76 색차가 12를 넘으면 육안으로 꽤 다른 색이므로 유사 색상에서 제외한다.
// 24는 유사도 0점 기준이며 SIMILAR_COLOR_PERCENT(50)와 함께 경계를 만든다.
const MAX_COLOR_DISTANCE = 24
const SIMILAR_COLOR_PERCENT = 50
const VERY_SIMILAR_COLOR_PERCENT = 72
const SIMILAR_DESIGN_PERCENT = 70
const VERY_SIMILAR_DESIGN_PERCENT = 75

const colorFamilyKeywords = {
  black: ['블랙', '검정', '흑색', 'black'],
  white: ['화이트', '흰색', '백색', 'white'],
  cream: ['크림', '아이보리', 'ivory', 'cream'],
  beige: ['베이지', '샌드', 'beige', 'sand'],
  gray: ['그레이', '회색', '차콜', '챠콜', 'gray', 'grey', 'charcoal'],
  navy: ['네이비', '남색', 'navy'],
  blue: ['블루', '파랑', '청색', 'blue'],
  brown: ['브라운', '갈색', '카멜', '초콜릿', '토프', 'brown', 'camel', 'taupe'],
  red: ['레드', '빨강', '적색', 'red'],
  pink: ['핑크', '분홍', 'pink'],
  orange: ['오렌지', '주황', 'orange'],
  yellow: ['옐로', '노랑', 'yellow'],
  green: ['그린', '초록', '녹색', 'green'],
  olive: ['올리브', '카키', 'olive', 'khaki'],
  purple: ['퍼플', '보라', '자주', 'purple', 'violet'],
  multicolor: ['다색', '멀티', 'multicolor', 'multi'],
} as const

type ColorFamily = keyof typeof colorFamilyKeywords

const compatibleColorFamilies: Record<ColorFamily, ColorFamily[]> = {
  black: ['black', 'gray'],
  white: ['white', 'cream'],
  cream: ['cream', 'white', 'beige'],
  beige: ['beige', 'cream'],
  gray: ['gray', 'black'],
  navy: ['navy', 'blue'],
  blue: ['blue', 'navy'],
  brown: ['brown'],
  red: ['red'],
  pink: ['pink'],
  orange: ['orange'],
  yellow: ['yellow'],
  green: ['green', 'olive'],
  olive: ['olive', 'green'],
  purple: ['purple'],
  multicolor: ['multicolor'],
}

function normalizeColorText(value: string) {
  return value.normalize('NFKC').trim().replaceAll(/\s+/g, '').toLowerCase()
}

function getColorFamily(value: string): ColorFamily | null {
  const normalized = normalizeColorText(value)
  if (!normalized) return null

  for (const [family, keywords] of Object.entries(colorFamilyKeywords)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return family as ColorFamily
    }
  }
  return null
}

export function areColorNamesCompatible(first: string, second: string) {
  const firstFamily = getColorFamily(first)
  const secondFamily = getColorFamily(second)

  if (!firstFamily || !secondFamily) {
    const firstNormalized = normalizeColorText(first)
    return Boolean(firstNormalized) && firstNormalized === normalizeColorText(second)
  }

  return compatibleColorFamilies[firstFamily].includes(secondFamily)
}

function normalizeSubcategory(value: string) {
  return value.normalize('NFKC').trim().replaceAll(/\s+/g, ' ').toLowerCase()
}

function hexToRgb(value: string) {
  const hex = value.trim().replace(/^#/, '')
  if (!/^[\dA-Fa-f]{6}$/.test(hex)) return null

  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ] as const
}

function rgbChannelToLinear(value: number) {
  const normalized = value / 255
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

function hexToLab(value: string): LabColor | null {
  const rgb = hexToRgb(value)
  if (!rgb) return null

  const [red, green, blue] = rgb.map(rgbChannelToLinear)
  const x = (red * 0.4124 + green * 0.3576 + blue * 0.1805) / 0.95047
  const y = red * 0.2126 + green * 0.7152 + blue * 0.0722
  const z = (red * 0.0193 + green * 0.1192 + blue * 0.9505) / 1.08883

  const pivot = (channel: number) =>
    channel > 0.008856
      ? Math.cbrt(channel)
      : 7.787 * channel + 16 / 116

  const fx = pivot(x)
  const fy = pivot(y)
  const fz = pivot(z)

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  }
}

function getLabDistance(first: LabColor, second: LabColor) {
  return Math.sqrt(
    (first.l - second.l) ** 2 +
      (first.a - second.a) ** 2 +
      (first.b - second.b) ** 2,
  )
}

function getColorModePenalty(
  targetMode: ColorMode | null,
  itemMode: ColorMode | undefined,
) {
  if (!targetMode || !itemMode) return 3
  return targetMode === itemMode ? 0 : 12
}

function getColorSimilarity(
  input: SimilarWardrobeItemInput,
  item: WardrobeItem,
  targetColor: LabColor,
) {
  const itemColor = hexToLab(item.colorHex)
  if (!itemColor) return null

  const colorDistance =
    getLabDistance(targetColor, itemColor) +
    getColorModePenalty(input.colorMode, item.colorMode)
  const rawSimilarity = Math.round(
    100 -
      (Math.min(colorDistance, MAX_COLOR_DISTANCE) / MAX_COLOR_DISTANCE) *
        100,
  )
  const targetFamily = getColorFamily(input.colorName)
  const itemFamily = getColorFamily(item.colorName)
  const familiesConflict =
    targetFamily !== null &&
    itemFamily !== null &&
    !areColorNamesCompatible(input.colorName, item.colorName)

  return {
    colorDistance,
    colorSimilarityPercent: familiesConflict
      ? Math.min(rawSimilarity, 35)
      : rawSimilarity,
  }
}

function isKnownAttribute(value: unknown): value is string {
  return typeof value === 'string' && value !== 'unknown'
}

function inferTextureFromName(value: string): FashionTexture {
  const normalized = value.normalize('NFKC').toLowerCase()
  if (normalized.includes('코듀로이') || normalized.includes('골덴')) {
    return 'corduroy'
  }
  if (normalized.includes('트윌') || normalized.includes('능직')) return 'twill'
  if (normalized.includes('골지')) return 'ribbed'
  if (normalized.includes('케이블') || normalized.includes('꽈배기')) {
    return 'cableKnit'
  }
  if (normalized.includes('부클') || normalized.includes('뽀글')) return 'boucle'
  if (normalized.includes('퀼팅') || normalized.includes('누빔')) return 'quilted'
  if (normalized.includes('스웨이드')) return 'suede'
  if (normalized.includes('워싱') || normalized.includes('디스트레스')) {
    return 'distressed'
  }
  return 'unknown'
}

function resolveTexture(
  attributes: FashionItemAttributes | null | undefined,
  itemName: string,
) {
  return attributes?.texture && attributes.texture !== 'unknown'
    ? attributes.texture
    : inferTextureFromName(itemName)
}

function getTextureSimilarity(first: FashionTexture, second: FashionTexture) {
  if (first === second) return 1

  const relatedTexturePairs = [
    ['smooth', 'twill'],
    ['corduroy', 'ribbed'],
    ['fuzzy', 'boucle'],
  ]
  return relatedTexturePairs.some(
    ([left, right]) =>
      (first === left && second === right) ||
      (first === right && second === left),
  )
    ? 0.4
    : 0
}

function getOrderedAttributeSimilarity(
  first: string,
  second: string,
  order: string[],
) {
  const firstIndex = order.indexOf(first)
  const secondIndex = order.indexOf(second)
  if (firstIndex < 0 || secondIndex < 0) return 0

  const distance = Math.abs(firstIndex - secondIndex)
  return distance === 0 ? 1 : distance === 1 ? 0.55 : 0
}

function getBottomLegShapeSimilarity(first: string, second: string) {
  if (first === second) return 1

  const relatedShapes = new Map([
    ['skinny:straight', 0.4],
    ['straight:tapered', 0.55],
    ['straight:wide', 0.45],
    ['wide:flared', 0.4],
  ])
  return (
    relatedShapes.get(`${first}:${second}`) ??
    relatedShapes.get(`${second}:${first}`) ??
    0
  )
}

function getWaistStyleSimilarity(first: string, second: string) {
  if (first === second) return 1
  if (
    (first === 'elastic' && second === 'drawstring') ||
    (first === 'drawstring' && second === 'elastic')
  ) {
    return 0.5
  }
  return first === 'mixed' || second === 'mixed' ? 0.35 : 0
}

interface DesignComparison {
  comparable: boolean
  similarity: number
  weight: number
}

function createCommonDesignComparisons(
  target: FashionItemAttributes,
  item: FashionItemAttributes,
  targetTexture: FashionTexture,
  itemTexture: FashionTexture,
  weightScale: number,
): DesignComparison[] {
  return [
    {
      comparable:
        isKnownAttribute(target.silhouette) &&
        isKnownAttribute(item.silhouette),
      similarity: getOrderedAttributeSimilarity(
        target.silhouette,
        item.silhouette,
        ['slim', 'regular', 'relaxed', 'oversized'],
      ),
      weight: 0.2 * weightScale,
    },
    {
      comparable:
        isKnownAttribute(target.material) && isKnownAttribute(item.material),
      similarity: target.material === item.material ? 1 : 0.2,
      weight: 0.15 * weightScale,
    },
    {
      comparable:
        isKnownAttribute(targetTexture) && isKnownAttribute(itemTexture),
      similarity: getTextureSimilarity(targetTexture, itemTexture),
      weight: 0.35 * weightScale,
    },
    {
      comparable:
        isKnownAttribute(target.pattern) && isKnownAttribute(item.pattern),
      similarity: target.pattern === item.pattern ? 1 : 0,
      weight: 0.15 * weightScale,
    },
    {
      comparable:
        isKnownAttribute(target.warmth) && isKnownAttribute(item.warmth),
      similarity: getOrderedAttributeSimilarity(
        target.warmth,
        item.warmth,
        ['light', 'medium', 'heavy'],
      ),
      weight: 0.08 * weightScale,
    },
    {
      comparable:
        Number.isFinite(target.formality) && Number.isFinite(item.formality),
      similarity: Math.max(
        0,
        1 - Math.abs(target.formality - item.formality) / 0.5,
      ),
      weight: 0.07 * weightScale,
    },
  ]
}

function createExactComparison(
  first: unknown,
  second: unknown,
  weight: number,
): DesignComparison {
  return {
    comparable: isKnownAttribute(first) && isKnownAttribute(second),
    similarity: first === second ? 1 : 0,
    weight,
  }
}

function getDesignSimilarity(
  target: FashionItemAttributes | null,
  item: FashionItemAttributes | undefined,
  targetName: string,
  itemName: string,
  category: ClothingCategory,
) {
  if (!target || !item) return null

  const targetTexture = resolveTexture(target, targetName)
  const itemTexture = resolveTexture(item, itemName)
  const isBottom = category === 'bottom'
  const hasUpperStructure = ['top', 'outer', 'midlayer', 'dress'].includes(
    category,
  )
  const commonWeightScale = isBottom ? 0.43 : hasUpperStructure ? 0.45 : 1
  const comparisons = createCommonDesignComparisons(
    target,
    item,
    targetTexture,
    itemTexture,
    commonWeightScale,
  )

  if (isBottom) {
    comparisons.push(
      {
        comparable:
          isKnownAttribute(target.bottomLegShape) &&
          isKnownAttribute(item.bottomLegShape),
        similarity: getBottomLegShapeSimilarity(
          target.bottomLegShape ?? 'unknown',
          item.bottomLegShape ?? 'unknown',
        ),
        weight: 0.15,
      },
      createExactComparison(target.pocketStyle, item.pocketStyle, 0.32),
      {
        comparable:
          isKnownAttribute(target.bottomWaistStyle) &&
          isKnownAttribute(item.bottomWaistStyle),
        similarity: getWaistStyleSimilarity(
          target.bottomWaistStyle ?? 'unknown',
          item.bottomWaistStyle ?? 'unknown',
        ),
        weight: 0.06,
      },
      createExactComparison(
        target.bottomFrontPleats,
        item.bottomFrontPleats,
        0.04,
      ),
    )
  } else if (hasUpperStructure) {
    comparisons.push(
      createExactComparison(target.necklineStyle, item.necklineStyle, 0.2),
      createExactComparison(
        target.frontOpeningStyle,
        item.frontOpeningStyle,
        0.2,
      ),
      createExactComparison(target.pocketStyle, item.pocketStyle, 0.15),
    )
  }

  const comparable = comparisons.filter((comparison) => comparison.comparable)
  if (comparable.length < 2) return null

  const totalWeight = comparable.reduce(
    (sum, comparison) => sum + comparison.weight,
    0,
  )
  const weightedSimilarity = comparable.reduce(
    (sum, comparison) =>
      sum + comparison.similarity * comparison.weight,
    0,
  )
  const allWeight = comparisons.reduce(
    (sum, comparison) => sum + comparison.weight,
    0,
  )
  const evidenceCoverage = totalWeight / allWeight
  const evidenceMultiplier = isBottom || hasUpperStructure
    ? 0.35 + evidenceCoverage * 0.65
    : 1

  return Math.round(
    (weightedSimilarity / totalWeight) * evidenceMultiplier * 100,
  )
}

const silhouetteLabels: Record<string, string> = {
  slim: '슬림한',
  regular: '기본 핏',
  relaxed: '여유로운 핏',
  oversized: '오버핏',
}

const materialLabels: Record<string, string> = {
  cotton: '면',
  denim: '데님',
  knit: '니트',
  wool: '울',
  leather: '가죽',
  linen: '리넨',
  synthetic: '합성 소재',
  other: '기타 소재',
}

const patternLabels: Record<string, string> = {
  solid: '무지',
  stripe: '스트라이프',
  check: '체크',
  graphic: '그래픽',
  floral: '플로럴',
  other: '기타 패턴',
}

const textureLabels: Record<FashionTexture, string> = {
  smooth: '매끈한',
  twill: '트윌',
  corduroy: '코듀로이',
  ribbed: '골지',
  cableKnit: '케이블 니트',
  fuzzy: '보송한',
  boucle: '부클',
  quilted: '퀼팅',
  suede: '스웨이드',
  glossy: '광택',
  distressed: '워싱·헤짐',
  other: '기타',
  unknown: '확인되지 않은',
}

const necklineLabels: Record<string, string> = {
  crew: '크루넥',
  vNeck: '브이넥',
  mock: '모크넥',
  turtleneck: '터틀넥',
  collar: '칼라',
  hood: '후드',
  scoop: '스쿱넥',
  boat: '보트넥',
  square: '스퀘어넥',
  other: '기타 넥라인',
}

const openingLabels: Record<string, string> = {
  none: '앞여밈 없음',
  buttons: '전체 단추',
  halfButtons: '부분 단추',
  zipper: '전체 지퍼',
  halfZip: '부분 지퍼',
  wrap: '랩 여밈',
  other: '기타 여밈',
}

const pocketLabels: Record<string, string> = {
  none: '포켓 없음',
  slant: '사선 포켓',
  welt: '웰트 포켓',
  patch: '패치 포켓',
  cargo: '카고 포켓',
  kangaroo: '캥거루 포켓',
  zippered: '지퍼 포켓',
  mixed: '혼합 포켓',
}

function addStructuralReason(
  reasons: string[],
  first: unknown,
  second: unknown,
  labels: Record<string, string>,
  suffix: string,
) {
  if (!isKnownAttribute(first) || !isKnownAttribute(second)) return
  const firstLabel = labels[first] ?? first
  const secondLabel = labels[second] ?? second
  reasons.push(
    first === second
      ? `같은 ${firstLabel}`
      : `${firstLabel}·${secondLabel} ${suffix}`,
  )
}

function getSimilarityReasons(
  input: SimilarWardrobeItemInput,
  item: WardrobeItem,
  colorSimilarityPercent: number,
  designSimilarityPercent: number | null,
) {
  const reasons = [`같은 ${input.subcategory}`]

  if (colorSimilarityPercent >= VERY_SIMILAR_COLOR_PERCENT) {
    reasons.push('매우 비슷한 색상')
  } else if (colorSimilarityPercent >= SIMILAR_COLOR_PERCENT) {
    reasons.push('비슷한 색상')
  } else if (
    designSimilarityPercent !== null &&
    designSimilarityPercent >= SIMILAR_DESIGN_PERCENT
  ) {
    reasons.push('다른 색상')
  }

  const target = input.fashionAttributes
  const current = item.fashionAttributes
  if (!target || !current) return reasons

  const targetTexture = resolveTexture(target, input.itemName ?? '')
  const itemTexture = resolveTexture(current, item.name)

  if (
    target.silhouette === current.silhouette &&
    isKnownAttribute(target.silhouette)
  ) {
    reasons.push(`${silhouetteLabels[target.silhouette] ?? '같은'} 실루엣`)
  }
  if (input.category === 'bottom') {
    addStructuralReason(
      reasons,
      target.pocketStyle,
      current.pocketStyle,
      pocketLabels,
      '차이',
    )
  } else if (['top', 'outer', 'midlayer', 'dress'].includes(input.category)) {
    addStructuralReason(
      reasons,
      target.necklineStyle,
      current.necklineStyle,
      necklineLabels,
      '차이',
    )
    addStructuralReason(
      reasons,
      target.frontOpeningStyle,
      current.frontOpeningStyle,
      openingLabels,
      '차이',
    )
    addStructuralReason(
      reasons,
      target.pocketStyle,
      current.pocketStyle,
      pocketLabels,
      '차이',
    )
  }
  if (
    target.material === current.material &&
    isKnownAttribute(target.material)
  ) {
    reasons.push(`${materialLabels[target.material] ?? '같은'} 소재`)
  }
  if (targetTexture === itemTexture && isKnownAttribute(targetTexture)) {
    reasons.push(`${textureLabels[targetTexture]} 질감`)
  } else if (
    isKnownAttribute(targetTexture) &&
    isKnownAttribute(itemTexture)
  ) {
    reasons.push(
      `${textureLabels[targetTexture]}·${textureLabels[itemTexture]} 질감 차이`,
    )
  }
  if (
    target.pattern === current.pattern &&
    isKnownAttribute(target.pattern)
  ) {
    reasons.push(`${patternLabels[target.pattern] ?? '같은'} 패턴`)
  }

  return reasons.slice(0, 4)
}

export function findSimilarWardrobeItems(
  input: SimilarWardrobeItemInput,
  wardrobeItems: WardrobeItem[],
  limit = 4,
): SimilarWardrobeItemMatch[] {
  const targetColor = hexToLab(input.colorHex)
  const targetSubcategory = normalizeSubcategory(input.subcategory)

  if (!targetColor || !targetSubcategory || limit <= 0) return []

  return wardrobeItems
    .flatMap((item): SimilarWardrobeItemMatch[] => {
      if (
        item.classificationStatus !== 'classified' ||
        !wardrobeItemHasCategory(item, input.category) ||
        normalizeSubcategory(item.subcategory ?? '') !== targetSubcategory
      ) {
        return []
      }

      const color = getColorSimilarity(input, item, targetColor)
      if (!color) return []
      const designSimilarityPercent = getDesignSimilarity(
        input.fashionAttributes,
        item.fashionAttributes,
        input.itemName ?? '',
        item.name,
        input.category,
      )
      const hasSimilarColor =
        color.colorSimilarityPercent >= SIMILAR_COLOR_PERCENT
      const hasSimilarDesign =
        designSimilarityPercent !== null &&
        designSimilarityPercent >= SIMILAR_DESIGN_PERCENT

      if (!hasSimilarColor && !hasSimilarDesign) return []

      const kind: SimilarWardrobeItemKind =
        color.colorSimilarityPercent >= VERY_SIMILAR_COLOR_PERCENT &&
        designSimilarityPercent !== null &&
        designSimilarityPercent >= VERY_SIMILAR_DESIGN_PERCENT
          ? 'near-duplicate'
          : hasSimilarDesign
            ? 'similar-design'
            : 'similar-color'
      const similarityPercent =
        designSimilarityPercent === null
          ? color.colorSimilarityPercent
          : Math.round(
              color.colorSimilarityPercent * 0.45 +
                designSimilarityPercent * 0.55,
            )

      return [
        {
          item,
          kind,
          colorDistance: color.colorDistance,
          colorSimilarityPercent: color.colorSimilarityPercent,
          designSimilarityPercent,
          similarityPercent,
          reasons: getSimilarityReasons(
            input,
            item,
            color.colorSimilarityPercent,
            designSimilarityPercent,
          ),
        },
      ]
    })
    .sort((first, second) => {
      const kindPriority: Record<SimilarWardrobeItemKind, number> = {
        'near-duplicate': 3,
        'similar-design': 2,
        'similar-color': 1,
      }
      const kindDifference =
        kindPriority[second.kind] - kindPriority[first.kind]
      if (kindDifference !== 0) return kindDifference

      const firstRelevantScore =
        first.kind === 'similar-color'
          ? first.colorSimilarityPercent
          : first.kind === 'similar-design'
            ? first.designSimilarityPercent ?? 0
            : first.similarityPercent
      const secondRelevantScore =
        second.kind === 'similar-color'
          ? second.colorSimilarityPercent
          : second.kind === 'similar-design'
            ? second.designSimilarityPercent ?? 0
            : second.similarityPercent
      return secondRelevantScore - firstRelevantScore
    })
    .slice(0, limit)
}
