import type {
  ClothingCategory,
  Season,
} from '@prisma/client'
import type {
  FashionItemAttributes,
  FashionMaterial,
  FashionPattern,
  FashionSilhouette,
  FashionTexture,
} from '@closet/types'
import { colorHexToRgb } from '../classification/color.js'

export interface StyleRuleItem {
  id: string
  name: string
  category: ClothingCategory | null
  additionalCategories?: ClothingCategory[]
  subcategory: string | null
  colorName: string | null
  colorHex: string | null
  colorMode: string | null
  fashionAttributes?: unknown
  wearCount: number
  lastWornAt: Date | null
}

export interface OutfitCombination<T extends StyleRuleItem> {
  id: string
  items: T[]
  score: number
}

const neutralColors = new Set(['블랙', '화이트', '크림', '베이지', '그레이', '네이비'])

const colorMatches: Record<string, string[]> = {
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
}

interface OklchColor {
  lightness: number
  chroma: number
  hue: number
}

const NEUTRAL_CHROMA_MAX = 0.045

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function rgbChannelToLinear(value: number) {
  const normalized = value / 255
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

function colorHexToOklch(value: string | null): OklchColor | null {
  const rgb = colorHexToRgb(value)
  if (!rgb) return null

  const red = rgbChannelToLinear(rgb[0])
  const green = rgbChannelToLinear(rgb[1])
  const blue = rgbChannelToLinear(rgb[2])
  const l = Math.cbrt(
    0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue,
  )
  const m = Math.cbrt(
    0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue,
  )
  const s = Math.cbrt(
    0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue,
  )
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const chroma = Math.sqrt(a ** 2 + b ** 2)
  const hue = (Math.atan2(b, a) * 180) / Math.PI

  return {
    lightness,
    chroma,
    hue: hue < 0 ? hue + 360 : hue,
  }
}

function getHueDistance(left: number, right: number) {
  const distance = Math.abs(left - right)
  return Math.min(distance, 360 - distance)
}

function getColorNameScore(left: StyleRuleItem, right: StyleRuleItem) {
  const leftColor = left.colorName?.trim() ?? ''
  const rightColor = right.colorName?.trim() ?? ''
  if (leftColor && leftColor === rightColor) return 2
  if (colorMatches[leftColor]?.includes(rightColor)) return 6
  if (colorMatches[rightColor]?.includes(leftColor)) return 6
  if (neutralColors.has(leftColor) || neutralColors.has(rightColor)) return 4
  return 1
}

function softenRepresentativeColorScore(
  score: number,
  left: StyleRuleItem,
  right: StyleRuleItem,
) {
  const hasComplexColor = [left.colorMode, right.colorMode].some(
    (mode) => mode === 'patterned' || mode === 'multicolor',
  )
  return hasComplexColor ? 3.5 + (score - 3.5) * 0.7 : score
}

/** 실제 대표색의 명도·채도·색상 차이를 비교한다. 대표색이 없으면 넓은 색상명 규칙을 사용한다. */
export function getColorHarmonyScore(
  left: StyleRuleItem,
  right: StyleRuleItem,
) {
  const leftColor = colorHexToOklch(left.colorHex)
  const rightColor = colorHexToOklch(right.colorHex)
  if (!leftColor || !rightColor) return getColorNameScore(left, right)

  const lightnessDistance = Math.abs(
    leftColor.lightness - rightColor.lightness,
  )
  const leftIsNeutral = leftColor.chroma <= NEUTRAL_CHROMA_MAX
  const rightIsNeutral = rightColor.chroma <= NEUTRAL_CHROMA_MAX
  let score: number

  if (leftIsNeutral && rightIsNeutral) {
    score = 4.25 + Math.min(lightnessDistance / 0.22, 1) * 1.25
  } else if (leftIsNeutral || rightIsNeutral) {
    const colored = leftIsNeutral ? rightColor : leftColor
    const contrastBonus = Math.min(lightnessDistance / 0.24, 1) * 0.65
    const vividnessPenalty = Math.max(0, colored.chroma - 0.24) * 4
    score = 5 + contrastBonus - vividnessPenalty
  } else {
    const hueDistance = getHueDistance(leftColor.hue, rightColor.hue)
    const lightnessBonus =
      lightnessDistance >= 0.08 && lightnessDistance <= 0.48 ? 0.45 : 0

    if (hueDistance <= 18) {
      score = 5.25 + lightnessBonus
    } else if (hueDistance <= 55) {
      score = 5 + lightnessBonus
    } else if (hueDistance >= 145 && hueDistance <= 215) {
      score = 4.85 + lightnessBonus
    } else if (hueDistance >= 105 && hueDistance <= 135) {
      score = 4.4 + lightnessBonus
    } else {
      score = 2.75 + lightnessBonus
    }

    if (
      leftColor.chroma + rightColor.chroma > 0.34 &&
      hueDistance > 55 &&
      hueDistance < 145
    ) {
      score -= 0.75
    }
  }

  return clamp(softenRepresentativeColorScore(score, left, right), 1, 6)
}

const layerRoles = new Set(['base', 'mid', 'outer', 'single', 'unknown'])
const silhouettes = new Set(['slim', 'regular', 'relaxed', 'oversized', 'unknown'])
const patterns = new Set(['solid', 'stripe', 'check', 'graphic', 'floral', 'other', 'unknown'])
const materials = new Set(['cotton', 'denim', 'knit', 'wool', 'leather', 'linen', 'synthetic', 'other', 'unknown'])
const textures = new Set<FashionTexture>(['smooth', 'twill', 'corduroy', 'ribbed', 'cableKnit', 'fuzzy', 'boucle', 'quilted', 'suede', 'glossy', 'distressed', 'other', 'unknown'])
const warmthLevels = new Set(['light', 'medium', 'heavy', 'unknown'])

function includesCategory(item: StyleRuleItem, category: ClothingCategory) {
  return item.category === category || item.additionalCategories?.includes(category) === true
}

/** 직전 추천의 아우터만 후보에서 제외한다. 사용자가 고른 기준 옷은 제외 목록에 있어도 유지한다. */
export function excludeOuterItems<T extends StyleRuleItem>(
  items: T[],
  excludedItemIds: Iterable<string>,
  baseItemId?: string,
) {
  const excludedIdSet = new Set(excludedItemIds)
  return items.filter(
    (item) =>
      item.id === baseItemId ||
      !(excludedIdSet.has(item.id) && includesCategory(item, 'outer')),
  )
}

function inferFashionAttributes(item: StyleRuleItem): FashionItemAttributes {
  const text = `${item.name} ${item.subcategory ?? ''}`.toLocaleLowerCase()
  const layerRole =
    item.category === 'outer'
      ? 'outer'
      : item.category === 'midlayer'
        ? 'mid'
        : item.category === 'top'
          ? 'base'
          : includesCategory(item, 'outer')
            ? 'outer'
            : includesCategory(item, 'midlayer')
              ? 'mid'
              : includesCategory(item, 'top')
                ? 'base'
                : 'single'
  const silhouette = text.includes('오버핏')
    ? 'oversized'
    : text.includes('와이드') || text.includes('루즈')
      ? 'relaxed'
      : text.includes('슬림') || text.includes('스키니')
        ? 'slim'
        : 'regular'
  const pattern = text.includes('체크')
    ? 'check'
    : text.includes('스트라이프') || text.includes('줄무늬')
      ? 'stripe'
      : text.includes('그래픽') || text.includes('프린트')
        ? 'graphic'
        : item.colorMode === 'solid'
          ? 'solid'
          : item.colorMode === 'patterned' || item.colorMode === 'multicolor'
            ? 'other'
            : 'unknown'
  const material = text.includes('데님') || text.includes('청바지')
    ? 'denim'
    : text.includes('니트') || text.includes('가디건')
      ? 'knit'
      : text.includes('레더') || text.includes('가죽')
        ? 'leather'
        : text.includes('울') || text.includes('코트')
          ? 'wool'
          : text.includes('린넨')
            ? 'linen'
            : 'unknown'
  const texture: FashionTexture = text.includes('코듀로이') || text.includes('골덴')
    ? 'corduroy'
    : text.includes('트윌') || text.includes('능직')
      ? 'twill'
      : text.includes('골지')
        ? 'ribbed'
        : text.includes('케이블') || text.includes('꽈배기')
          ? 'cableKnit'
          : text.includes('부클') || text.includes('뽀글')
            ? 'boucle'
            : text.includes('퀼팅') || text.includes('누빔')
              ? 'quilted'
              : text.includes('스웨이드')
                ? 'suede'
                : text.includes('워싱')
                  ? 'distressed'
                  : 'unknown'
  const warmth = text.includes('패딩') || text.includes('코트')
    ? 'heavy'
    : text.includes('민소매') || text.includes('반팔') || text.includes('샌들')
      ? 'light'
      : 'medium'
  const formality = text.includes('구두') || text.includes('블레이저') || text.includes('슬랙스')
    ? 0.88
    : text.includes('로퍼') || text.includes('셔츠') || text.includes('코트')
      ? 0.7
      : text.includes('후드') || text.includes('조거') || text.includes('스니커즈')
        ? 0.15
        : 0.4

  return {
    layerRole,
    silhouette,
    pattern,
    material,
    texture,
    warmth,
    formality,
    confidence: 0.35,
  }
}

/** 저장된 관찰 속성을 읽으며, 누락되거나 유효하지 않으면 옷 이름·종류·색 구성으로 보조 추정한다. */
export function getFashionAttributes(item: StyleRuleItem): FashionItemAttributes {
  if (!item.fashionAttributes || typeof item.fashionAttributes !== 'object') {
    return inferFashionAttributes(item)
  }
  const value = item.fashionAttributes as Partial<FashionItemAttributes>
  if (
    typeof value.layerRole !== 'string' || !layerRoles.has(value.layerRole) ||
    typeof value.silhouette !== 'string' || !silhouettes.has(value.silhouette) ||
    typeof value.pattern !== 'string' || !patterns.has(value.pattern) ||
    typeof value.material !== 'string' || !materials.has(value.material) ||
    (value.texture !== undefined &&
      (typeof value.texture !== 'string' || !textures.has(value.texture))) ||
    typeof value.warmth !== 'string' || !warmthLevels.has(value.warmth) ||
    typeof value.formality !== 'number' || value.formality < 0 || value.formality > 1 ||
    typeof value.confidence !== 'number' || value.confidence < 0 || value.confidence > 1
  ) {
    return inferFashionAttributes(item)
  }

  const inferred = inferFashionAttributes(item)
  return {
    layerRole:
      item.category === 'outer'
        ? 'outer'
        : item.category === 'midlayer'
          ? 'mid'
          : item.category === 'top' && value.layerRole === 'outer'
            ? 'base'
            : value.layerRole,
    silhouette: value.silhouette,
    pattern: value.pattern,
    material: value.material,
    texture: value.texture ?? inferred.texture,
    warmth: value.warmth,
    formality: value.formality,
    confidence: value.confidence ?? inferred.confidence,
  }
}

function getRotationScore(item: StyleRuleItem) {
  const lastWornAt = item.lastWornAt?.getTime() ?? 0
  const daysSinceWorn = lastWornAt
    ? Math.floor((Date.now() - lastWornAt) / (24 * 60 * 60 * 1000))
    : 30
  return Math.min(Math.max(daysSinceWorn, 0), 30) / 15 - Math.min(item.wearCount, 10) / 10
}

/**
 * 상의·겉옷과 하의의 실제 실루엣을 비교해 볼륨 균형을 보조 평가한다.
 * 같은 핏이나 기본 핏을 포함한 조합, 여유로운 옷과 슬림한 옷의 조합에 가점을 준다.
 * unknown은 판단에서 제외하고 분석 확신도가 낮으면 가점을 줄이며 어떤 실루엣도 추천 후보에서 금지하지 않는다.
 */
function getSilhouetteBalanceScore<T extends StyleRuleItem>(items: T[]) {
  const upperItems = items.filter((item) =>
    ['top', 'midlayer', 'outer'].some((category) =>
      includesCategory(item, category as ClothingCategory),
    ),
  )
  const bottom = items.find((item) => includesCategory(item, 'bottom'))
  if (!bottom || upperItems.length === 0) return 0
  const bottomAttributes = getFashionAttributes(bottom)
  const bottomShape = bottomAttributes.silhouette
  const scores = upperItems.flatMap((item) => {
    const upperAttributes = getFashionAttributes(item)
    const upperShape = upperAttributes.silhouette
    const confidence = Math.min(upperAttributes.confidence, bottomAttributes.confidence)
    if (upperShape === 'unknown' || bottomShape === 'unknown') return []
    if (upperShape === bottomShape || [upperShape, bottomShape].includes('regular')) return [confidence]
    if ([upperShape, bottomShape].includes('slim')) return [1.5 * confidence]
    return [0.5 * confidence]
  })
  return scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0
}

function isOuterLayer(item: StyleRuleItem) {
  return (
    includesCategory(item, 'outer') ||
    getFashionAttributes(item).layerRole === 'outer'
  )
}

function isMidLayer(item: StyleRuleItem) {
  return (
    includesCategory(item, 'midlayer') ||
    getFashionAttributes(item).layerRole === 'mid'
  )
}

function isInsulatingGarment(item: StyleRuleItem) {
  const { material, warmth } = getFashionAttributes(item)
  const text = `${item.name} ${item.subcategory ?? ''}`.toLocaleLowerCase()
  const hasInsulatingDetail = [
    '니트',
    '스웨터',
    '맨투맨',
    '후드',
    '기모',
    '플리스',
    '터틀넥',
    '목폴라',
  ].some((keyword) => text.includes(keyword))

  return (
    material === 'wool' ||
    ((material === 'knit' || hasInsulatingDetail) && warmth !== 'light')
  )
}

function isWeatherCompatibleCombination<T extends StyleRuleItem>(
  items: T[],
  apparentTemperatureC: number,
  baseItemId?: string,
) {
  const optionalItems = items.filter((item) => item.id !== baseItemId)
  const optionalLayers = optionalItems.filter(
    (item) => isOuterLayer(item) || isMidLayer(item),
  )

  if (apparentTemperatureC >= 23) {
    return (
      optionalLayers.length === 0 &&
      optionalItems.every((item) => {
        const { material, warmth } = getFashionAttributes(item)
        return (
          warmth !== 'heavy' &&
          material !== 'wool' &&
          !isInsulatingGarment(item)
        )
      })
    )
  }
  if (apparentTemperatureC >= 20) {
    return (
      optionalLayers.length === 0 &&
      optionalItems.every((item) => {
        const { material, warmth } = getFashionAttributes(item)
        return (
          warmth !== 'heavy' &&
          material !== 'wool' &&
          !isInsulatingGarment(item)
        )
      })
    )
  }
  if (apparentTemperatureC >= 12) {
    return optionalItems.every(
      (item) => getFashionAttributes(item).warmth !== 'heavy',
    )
  }
  return true
}

function getWeatherCompatibilityScore<T extends StyleRuleItem>(
  items: T[],
  apparentTemperatureC: number,
) {
  const attributes = items.map(getFashionAttributes)
  const outerCount = items.filter(isOuterLayer).length
  const midLayerCount = items.filter(isMidLayer).length
  const heavyCount = attributes.filter(({ warmth }) => warmth === 'heavy').length
  const lightCount = attributes.filter(({ warmth }) => warmth === 'light').length

  if (apparentTemperatureC >= 28) return lightCount - heavyCount * 6
  if (apparentTemperatureC >= 23) return lightCount * 0.5 - heavyCount * 4
  if (apparentTemperatureC >= 20) return lightCount * 0.25 - heavyCount * 3
  if (apparentTemperatureC >= 17) {
    return (outerCount + midLayerCount) * 1.25 - heavyCount * 3
  }
  if (apparentTemperatureC >= 12) {
    return outerCount * 2.5 + midLayerCount * 1.5 - heavyCount * 2
  }
  if (apparentTemperatureC >= 9) {
    return outerCount * 4 + midLayerCount + heavyCount * 0.75 - (outerCount === 0 ? 2 : 0)
  }
  if (apparentTemperatureC >= 5) {
    return outerCount * 5 + midLayerCount + heavyCount * 1.5 - (outerCount === 0 ? 4 : 0)
  }
  return outerCount * 6 + midLayerCount + heavyCount * 2.5 - (outerCount === 0 ? 6 : 0)
}

function scoreCombination<T extends StyleRuleItem>(
  items: T[],
  season: Season,
  apparentTemperatureC?: number,
) {
  const pairs: Array<[T, T]> = []
  items.forEach((item, index) => {
    items.slice(index + 1).forEach((other) => pairs.push([item, other]))
  })
  const averageColor =
    pairs.length > 0
      ? pairs.reduce(
          (sum, [left, right]) => sum + getColorHarmonyScore(left, right),
          0,
        ) /
        pairs.length
      : 0
  const averageRotation =
    items.reduce((sum, item) => sum + getRotationScore(item), 0) / items.length
  const hasShoes = items.some((item) => includesCategory(item, 'shoes'))
  const hasOuter = items.some(isOuterLayer)
  const patternedCount = items.filter((item) => {
    const pattern = getFashionAttributes(item).pattern
    return pattern !== 'solid' && pattern !== 'unknown'
  }).length
  const patternPenalty = patternedCount > 1 ? (patternedCount - 1) * 1.5 : 0
  const summerWarmthPenalty =
    apparentTemperatureC === undefined && season === 'summer'
      ? items.filter((item) => getFashionAttributes(item).warmth === 'heavy').length * 4
      : 0
  const layerScore =
    apparentTemperatureC === undefined
      ? hasOuter && (season === 'autumn' || season === 'winter')
        ? 1.5
        : 0
      : getWeatherCompatibilityScore(items, apparentTemperatureC)

  return (
    averageColor * 2.5 +
    getSilhouetteBalanceScore(items) * 1.5 +
    averageRotation +
    (hasShoes ? 2 : 0) +
    layerScore -
    patternPenalty -
    summerWarmthPenalty
  )
}

/**
 * 각 역할의 후보를 색 궁합과 최근 착용 기록으로 정렬해 최대 8개 남긴다.
 * 기준 옷이 있으면 그 옷과의 색 궁합을, 없으면 다른 종류 옷과의 평균 궁합을 비교한다.
 * 기준 옷은 점수와 무관하게 맨 앞에 두어 후보 제한으로 빠지지 않게 한다.
 */
function sortPool<T extends StyleRuleItem>(
  items: T[],
  wardrobeItems: T[],
  baseItemId?: string,
) {
  const baseItem = wardrobeItems.find((item) => item.id === baseItemId)
  const scores = new Map(items.map((item) => {
    const partners = baseItem && baseItem.id !== item.id
      ? [baseItem]
      : wardrobeItems.filter((other) => other.id !== item.id && other.category !== item.category)
    const colorScore = partners.length > 0
      ? partners.reduce((sum, partner) => sum + getColorHarmonyScore(item, partner), 0) / partners.length
      : 0
    return [item.id, colorScore + getRotationScore(item)]
  }))
  return [...items]
    .sort((left, right) =>
      Number(right.id === baseItemId) - Number(left.id === baseItemId) ||
      scores.get(right.id)! - scores.get(left.id)!,
    )
    .slice(0, 8)
}

function selectDiverseCombinations<T extends StyleRuleItem>(
  combinations: OutfitCombination<T>[],
  limit: number,
) {
  const groups = new Map<string, OutfitCombination<T>[]>()
  const itemUsage = new Map<string, number>()

  combinations.forEach((combination) => {
    const outerIds = combination.items
      .filter(
        (item) =>
          includesCategory(item, 'outer') ||
          getFashionAttributes(item).layerRole === 'outer',
      )
      .map((item) => item.id)
      .sort()
    const key = outerIds.length > 0 ? outerIds.join(':') : 'without-outer'
    const group = groups.get(key) ?? []
    group.push(combination)
    groups.set(key, group)
  })

  const getReusePenalty = (combination: OutfitCombination<T>) =>
    combination.items.reduce((penalty, item) => {
      const usage = itemUsage.get(item.id) ?? 0
      const category = item.category
      const weight =
        category === 'top'
          ? 4
          : category === 'bottom'
            ? 3.5
            : category === 'outer' || category === 'dress'
              ? 4
              : category === 'midlayer'
                ? 3
                : category === 'shoes'
                  ? 2
                  : 1
      return penalty + usage * weight
    }, 0)

  const takeBestAvailable = (group: OutfitCombination<T>[]) => {
    let bestIndex = 0
    let bestAdjustedScore = Number.NEGATIVE_INFINITY

    group.forEach((combination, index) => {
      const adjustedScore = combination.score - getReusePenalty(combination)
      if (adjustedScore > bestAdjustedScore) {
        bestIndex = index
        bestAdjustedScore = adjustedScore
      }
    })

    const [combination] = group.splice(bestIndex, 1)
    return combination
  }

  const selected: OutfitCombination<T>[] = []
  while (selected.length < limit) {
    let added = false
    for (const group of groups.values()) {
      const combination = takeBestAvailable(group)
      if (!combination) continue
      selected.push(combination)
      combination.items.forEach((item) => {
        itemUsage.set(item.id, (itemUsage.get(item.id) ?? 0) + 1)
      })
      added = true
      if (selected.length === limit) break
    }
    if (!added) break
  }

  return selected
}

/**
 * 이너와 하의 또는 원피스를 갖춘 옷장 조합을 만들고 색·핏 균형·레이어·착용 기록으로 정렬한다.
 * 계절은 겉옷과 두께 평가에 사용하고, 기온이 있으면 더운 날의 보온성 옷을 후보에서 제외한다.
 * baseItemId가 있으면 모든 결과에 포함하며 함께 입을 기본 구성이 없으면 빈 배열을 반환한다.
 * 스타일 이름이나 선호 핏으로 옷을 제한하지 않고 최대 18개의 서로 다른 조합을 반환한다.
 */
export function buildOutfitCombinations<T extends StyleRuleItem>(
  items: T[],
  season: Season,
  baseItemId?: string,
  apparentTemperatureC?: number,
) {
  if (baseItemId !== undefined && !items.some((item) => item.id === baseItemId)) {
    return []
  }
  // 기온에 맞지 않는 옷을 후보 제한 전에 제외해, 착용 가능한 옷이 8개 제한 아래로 밀리지 않게 한다.
  const availableItems = apparentTemperatureC === undefined
    ? items
    : items.filter((item) => isWeatherCompatibleCombination([item], apparentTemperatureC, baseItemId))
  const tops = sortPool(
    availableItems.filter((item) => {
      const role = getFashionAttributes(item).layerRole
      return includesCategory(item, 'top') && role !== 'outer' && role !== 'mid'
    }),
    availableItems,
    baseItemId,
  )
  const bottoms = sortPool(availableItems.filter((item) => includesCategory(item, 'bottom')), availableItems, baseItemId)
  const dresses = sortPool(availableItems.filter((item) => includesCategory(item, 'dress')), availableItems, baseItemId)
  const midlayers = sortPool(
    availableItems.filter(
      (item) =>
        includesCategory(item, 'midlayer') || getFashionAttributes(item).layerRole === 'mid',
    ),
    availableItems,
    baseItemId,
  )
  const outers = sortPool(
    availableItems.filter(
      (item) =>
        includesCategory(item, 'outer') || getFashionAttributes(item).layerRole === 'outer',
    ),
    availableItems,
    baseItemId,
  )
  const shoes = sortPool(availableItems.filter((item) => includesCategory(item, 'shoes')), availableItems, baseItemId)
  const accessories = sortPool(
    availableItems.filter((item) => includesCategory(item, 'accessory')),
    availableItems,
    baseItemId,
  )
  const combinations = new Map<string, T[]>()

  const push = (selectedItems: T[]) => {
    if (baseItemId !== undefined && !selectedItems.some((item) => item.id === baseItemId)) return
    const uniqueItems = [...new Map(selectedItems.map((item) => [item.id, item])).values()]
    if (uniqueItems.length !== selectedItems.length || uniqueItems.length > 5) return
    if (
      apparentTemperatureC !== undefined &&
      !isWeatherCompatibleCombination(
        uniqueItems,
        apparentTemperatureC,
        baseItemId,
      )
    ) {
      return
    }
    const key = uniqueItems.map((item) => item.id).sort().join(':')
    combinations.set(key, uniqueItems)
  }

  const withShoes = (core: T[]) => {
    if (shoes.length === 0) return [core]
    return shoes.slice(0, 3).map((item) => [...core, item])
  }

  const pushCore = (core: T[]) => {
    withShoes(core).forEach((selected) => {
      push(selected)
      if (selected.length < 5 && accessories[0]) push([...selected, accessories[0]])
    })
  }

  for (const top of tops) {
    for (const bottom of bottoms) {
      const base = [top, bottom]
      pushCore(base)

      midlayers.slice(0, 3).forEach((midlayer) => pushCore([...base, midlayer]))
      outers.forEach((outer) => pushCore([...base, outer]))
      midlayers.slice(0, 2).forEach((midlayer) => {
        outers.slice(0, 2).forEach((outer) => pushCore([...base, midlayer, outer]))
      })
    }
  }

  for (const dress of dresses) {
    pushCore([dress])
    outers.forEach((outer) => pushCore([dress, outer]))
  }

  const scoredCombinations = [...combinations.values()]
    .map((selectedItems) => ({
      id: '',
      items: selectedItems,
      score: scoreCombination(
        selectedItems,
        season,
        apparentTemperatureC,
      ),
    }))
    .sort((left, right) => right.score - left.score)

  return selectDiverseCombinations(scoredCombinations, 18)
    .map((combination, index) => ({
      ...combination,
      id: `combination-${index + 1}`,
    })) satisfies OutfitCombination<T>[]
}
