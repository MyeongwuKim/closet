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
  TodayOutfitColorScheme,
  ThermalRecommendationContext,
} from '@closet/types'
import { getColorHarmonyScore, getColorSchemeFitScore } from './outfit-color-rules.js'

export { getColorHarmonyScore, getColorSchemeFitScore } from './outfit-color-rules.js'

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
 * 비슷한 기온의 개인 체감이 있을 때 옷의 보온감과 겹쳐 입는 구성을 보조 평가한다.
 * 기존 선택용 속성 판정을 재사용하고 신발·가방·액세서리는 제외한다. 실제 날씨의 후보 제외 규칙은 바꾸지 않는다.
 * 한 기록의 영향은 체감 이력 서비스에서 줄이며, 이 점수도 최대 6점으로 제한한다.
 */
function getThermalPreferenceScore<T extends StyleRuleItem>(items: T[], context?: ThermalRecommendationContext) {
  if (!context || context.direction === 'neutral' || !Number.isFinite(context.strength)) return 0
  const warmth = items.reduce((total, item) => {
    const isUpper = ['top', 'dress', 'midlayer', 'outer'].some((category) => includesCategory(item, category as ClothingCategory))
    const weight = isUpper ? 1 : includesCategory(item, 'bottom') ? 0.5 : 0
    const level = getFashionAttributes(item).warmth
    const points = level === 'heavy' ? 2 : level === 'medium' ? 1 : 0
    return total + (points + 0.5) * weight
  }, 0)
  const score = Math.min(6, Math.max(0, Math.min(0.6, context.strength)) * 2.5 * warmth)
  return context.direction === 'warmer' ? score : -score
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
  colorScheme: TodayOutfitColorScheme = 'auto',
  thermalContext?: ThermalRecommendationContext,
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
    summerWarmthPenalty +
    (colorScheme === 'auto' ? 0 : getColorSchemeFitScore(items, colorScheme) * 4) +
    getThermalPreferenceScore(items, thermalContext)
  )
}

/**
 * 각 역할의 후보를 색 궁합·최근 착용과 개인 체감 보정으로 정렬해 최대 8개 남긴다.
 * 기준 옷이 있으면 그 옷과의 색 궁합을, 없으면 다른 종류 옷과의 평균 궁합을 비교한다.
 * 기준 옷은 점수와 무관하게 맨 앞에 두어 후보 제한으로 빠지지 않게 한다.
 * 색감을 선택했다면 기본 순위 4개와 다른 역할의 옷과 색 조합을 이루는 후보 최대 4개를 함께 남긴다.
 * 기준 옷이 있으면 제한된 후보 안에 그 옷과 색감이 맞는 옷을 먼저 포함한다.
 */
function sortPool<T extends StyleRuleItem>(
  items: T[],
  wardrobeItems: T[],
  baseItemId?: string,
  colorScheme: TodayOutfitColorScheme = 'auto',
  thermalContext?: ThermalRecommendationContext,
) {
  const baseItem = wardrobeItems.find((item) => item.id === baseItemId)
  const scores = new Map(items.map((item) => {
    const partners = baseItem && baseItem.id !== item.id
      ? [baseItem]
      : wardrobeItems.filter((other) => other.id !== item.id && other.category !== item.category)
    const colorScore = partners.length > 0
      ? partners.reduce((sum, partner) => sum + getColorHarmonyScore(item, partner), 0) / partners.length
      : 0
    return [item.id, colorScore + getRotationScore(item) + getThermalPreferenceScore([item], thermalContext)]
  }))
  const sorted = [...items]
    .sort((left, right) =>
      Number(right.id === baseItemId) - Number(left.id === baseItemId) ||
      scores.get(right.id)! - scores.get(left.id)!,
    )
  if (colorScheme === 'auto') return sorted.slice(0, 8)

  // 색감에 맞는 옷이 일반 색 궁합 순위에서 밀려도 역할별 후보 8개 안에 남긴다.
  const baseline = sorted.slice(0, 4)
  const baselineIds = new Set(baseline.map((item) => item.id))
  const fitWithBase = (item: T) => baseItem && baseItem.category !== item.category
    ? getColorSchemeFitScore([item, baseItem], colorScheme)
    : 0
  const matching = sorted.filter((item) => !baselineIds.has(item.id) && wardrobeItems.some(
    (partner) => partner.id !== item.id &&
      partner.category !== item.category &&
      getColorSchemeFitScore([item, partner], colorScheme) > 0,
  )).sort((left, right) => fitWithBase(right) - fitWithBase(left))
  return [...new Map([...baseline, ...matching.slice(0, 4), ...sorted]
    .map((item) => [item.id, item])).values()].slice(0, 8)
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
 * 색감을 만족하는 조합에서 최대 18개를 반환하고, 개인 체감이 있으면 보온성 순위를 보조 보정한다.
 * 만족하는 조합이 없으면 일반 추천으로 돌아가며, 스타일 이름이나 선호 핏으로 옷을 제한하지 않는다.
 */
export function buildOutfitCombinations<T extends StyleRuleItem>(
  items: T[],
  season: Season,
  baseItemId?: string,
  apparentTemperatureC?: number,
  colorScheme: TodayOutfitColorScheme = 'auto',
  thermalContext?: ThermalRecommendationContext,
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
    colorScheme,
    thermalContext,
  )
  const bottoms = sortPool(availableItems.filter((item) => includesCategory(item, 'bottom')), availableItems, baseItemId, colorScheme, thermalContext)
  const dresses = sortPool(availableItems.filter((item) => includesCategory(item, 'dress')), availableItems, baseItemId, colorScheme, thermalContext)
  const midlayers = sortPool(
    availableItems.filter(
      (item) =>
        includesCategory(item, 'midlayer') || getFashionAttributes(item).layerRole === 'mid',
    ),
    availableItems,
    baseItemId,
    colorScheme,
    thermalContext,
  )
  const outers = sortPool(
    availableItems.filter(
      (item) =>
        includesCategory(item, 'outer') || getFashionAttributes(item).layerRole === 'outer',
    ),
    availableItems,
    baseItemId,
    colorScheme,
    thermalContext,
  )
  const shoes = sortPool(availableItems.filter((item) => includesCategory(item, 'shoes')), availableItems, baseItemId, colorScheme, thermalContext)
  const accessories = sortPool(
    availableItems.filter((item) => includesCategory(item, 'accessory')),
    availableItems,
    baseItemId,
    colorScheme,
    thermalContext,
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
    const rankedShoes = colorScheme === 'auto'
      ? shoes
      : [...shoes].sort((left, right) =>
          Number(right.id === baseItemId) - Number(left.id === baseItemId) ||
          getColorSchemeFitScore([...core, right], colorScheme) -
            getColorSchemeFitScore([...core, left], colorScheme),
        )
    return rankedShoes.slice(0, 3).map((item) => [...core, item])
  }

  const pushCore = (core: T[]) => {
    withShoes(core).forEach((selected) => {
      push(selected)
      if (selected.length >= 5 || accessories.length === 0) return
      const accessory = colorScheme === 'auto'
        ? accessories[0]
        : [...accessories].sort((left, right) =>
            Number(right.id === baseItemId) - Number(left.id === baseItemId) ||
            getColorSchemeFitScore([...selected, right], colorScheme) -
              getColorSchemeFitScore([...selected, left], colorScheme),
          )[0]
      if (accessory) push([...selected, accessory])
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
        colorScheme,
        thermalContext,
      ),
    }))
    .sort((left, right) => right.score - left.score)

  const matchingCombinations = colorScheme === 'auto'
    ? scoredCombinations
    : scoredCombinations.filter((combination) =>
        getColorSchemeFitScore(combination.items, colorScheme) > 0,
      )
  if (colorScheme !== 'auto' && matchingCombinations.length === 0) {
    return buildOutfitCombinations(items, season, baseItemId, apparentTemperatureC, 'auto', thermalContext)
  }

  return selectDiverseCombinations(matchingCombinations, 18)
    .map((combination, index) => ({
      ...combination,
      id: `combination-${index + 1}`,
    })) satisfies OutfitCombination<T>[]
}
