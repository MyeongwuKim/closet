import type {
  ClothingCategory,
  OutfitStyle,
  PreferredFit,
  Season,
} from '@prisma/client'
import type {
  FashionItemAttributes,
  FashionMaterial,
  FashionPattern,
  FashionSilhouette,
} from '@closet/types'

export interface StyleRuleItem {
  id: string
  name: string
  category: ClothingCategory | null
  additionalCategories?: ClothingCategory[]
  subcategory: string | null
  colorName: string | null
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

interface StyleDefinition {
  description: string
  keywords: string[]
  subcategories: string[]
  silhouettes: FashionSilhouette[]
  patterns: FashionPattern[]
  materials: FashionMaterial[]
  formality: [number, number]
  neutralColorBonus: boolean
}

export const styleDefinitions: Record<OutfitStyle, StyleDefinition> = {
  minimal: {
    description: '무지와 중성색, 장식이 적은 단정한 실루엣을 중심으로 구성',
    keywords: ['무지', '셔츠', '슬랙스', '니트', '코트', '로퍼', '블레이저'],
    subcategories: ['셔츠', '니트', '슬랙스', '일반 긴바지', '블레이저', '코트', '로퍼'],
    silhouettes: ['slim', 'regular', 'relaxed'],
    patterns: ['solid', 'stripe'],
    materials: ['cotton', 'knit', 'wool'],
    formality: [0.4, 0.82],
    neutralColorBonus: true,
  },
  casual: {
    description: '티셔츠·맨투맨·데님처럼 편안한 기본 아이템과 자연스러운 핏으로 구성',
    keywords: ['티셔츠', '반팔', '긴팔', '데님', '청바지', '스니커즈', '후드', '맨투맨', '치노'],
    subcategories: ['반팔', '긴팔', '맨투맨', '후드', '폴로 셔츠', '데님', '치노 팬츠', '일반 긴바지', '스니커즈', '재킷', '가디건'],
    silhouettes: ['regular', 'relaxed'],
    patterns: ['solid', 'stripe', 'check', 'graphic'],
    materials: ['cotton', 'denim', 'knit'],
    formality: [0.08, 0.62],
    neutralColorBonus: false,
  },
  street: {
    description: '오버핏·와이드·카고·조거와 레이어드가 드러나는 여유로운 조합',
    keywords: ['오버핏', '와이드', '카고', '후드', '조거', '스니커즈', '그래픽', '집업', '패딩'],
    subcategories: ['맨투맨', '후드', '와이드 팬츠', '조거 팬츠', '집업', '패딩', '스니커즈', '모자'],
    silhouettes: ['relaxed', 'oversized'],
    patterns: ['solid', 'graphic', 'other'],
    materials: ['cotton', 'denim', 'synthetic', 'leather'],
    formality: [0, 0.42],
    neutralColorBonus: false,
  },
  classic: {
    description: '셔츠·슬랙스·블레이저처럼 구조적이고 포멀한 아이템으로 구성',
    keywords: ['셔츠', '슬랙스', '블레이저', '재킷', '코트', '로퍼', '구두', '니트'],
    subcategories: ['셔츠', '니트', '슬랙스', '블레이저', '코트', '로퍼', '구두'],
    silhouettes: ['slim', 'regular'],
    patterns: ['solid', 'stripe', 'check'],
    materials: ['cotton', 'knit', 'wool', 'leather'],
    formality: [0.58, 1],
    neutralColorBonus: true,
  },
  vintage: {
    description: '워싱·체크·코듀로이·레더처럼 질감과 시간이 느껴지는 아이템으로 구성',
    keywords: ['워싱', '코듀로이', '레더', '가죽', '체크', '데님', '브라운', '올리브'],
    subcategories: ['셔츠', '데님', '재킷', '부츠', '로퍼'],
    silhouettes: ['regular', 'relaxed', 'oversized'],
    patterns: ['solid', 'stripe', 'check', 'floral', 'other'],
    materials: ['denim', 'leather', 'wool', 'cotton'],
    formality: [0.18, 0.72],
    neutralColorBonus: false,
  },
  sporty: {
    description: '트랙·조거·바람막이·러닝화처럼 활동적인 기능성 아이템으로 구성',
    keywords: ['트랙', '조거', '레깅스', '러닝', '스니커즈', '바람막이', '집업', '후드'],
    subcategories: ['후드', '집업', '조거 팬츠', '레깅스', '스니커즈'],
    silhouettes: ['slim', 'regular', 'relaxed'],
    patterns: ['solid', 'graphic', 'other'],
    materials: ['synthetic', 'cotton', 'knit'],
    formality: [0, 0.3],
    neutralColorBonus: false,
  },
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

const layerRoles = new Set(['base', 'mid', 'outer', 'single', 'unknown'])
const silhouettes = new Set(['slim', 'regular', 'relaxed', 'oversized', 'unknown'])
const patterns = new Set(['solid', 'stripe', 'check', 'graphic', 'floral', 'other', 'unknown'])
const materials = new Set(['cotton', 'denim', 'knit', 'wool', 'leather', 'linen', 'synthetic', 'other', 'unknown'])
const warmthLevels = new Set(['light', 'medium', 'heavy', 'unknown'])

function includesCategory(item: StyleRuleItem, category: ClothingCategory) {
  return item.category === category || item.additionalCategories?.includes(category) === true
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
    warmth,
    formality,
    confidence: 0.35,
  }
}

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
    warmth: value.warmth,
    formality: value.formality,
    confidence: value.confidence ?? inferred.confidence,
  }
}

function getColorScore(left: StyleRuleItem, right: StyleRuleItem) {
  const leftColor = left.colorName?.trim() ?? ''
  const rightColor = right.colorName?.trim() ?? ''
  if (leftColor && leftColor === rightColor) return 2
  if (colorMatches[leftColor]?.includes(rightColor)) return 6
  if (colorMatches[rightColor]?.includes(leftColor)) return 6
  if (neutralColors.has(leftColor) || neutralColors.has(rightColor)) return 4
  return 1
}

function getRotationScore(item: StyleRuleItem) {
  const lastWornAt = item.lastWornAt?.getTime() ?? 0
  const daysSinceWorn = lastWornAt
    ? Math.floor((Date.now() - lastWornAt) / (24 * 60 * 60 * 1000))
    : 30
  return Math.min(Math.max(daysSinceWorn, 0), 30) / 15 - Math.min(item.wearCount, 10) / 10
}

function getFitScore(attributes: FashionItemAttributes, fit: PreferredFit) {
  const preferredByFit: Record<PreferredFit, FashionSilhouette[]> = {
    wide: ['relaxed', 'oversized'],
    regular: ['regular', 'relaxed'],
    skinny: ['slim', 'regular'],
  }
  return preferredByFit[fit].includes(attributes.silhouette) ? 2 : 0
}

export function getItemStyleScore(
  item: StyleRuleItem,
  style: OutfitStyle,
  fit: PreferredFit,
) {
  const definition = styleDefinitions[style]
  const attributes = getFashionAttributes(item)
  const text = `${item.name} ${item.subcategory ?? ''}`.toLocaleLowerCase()
  const keywordScore = Math.min(
    definition.keywords.filter((keyword) => text.includes(keyword.toLocaleLowerCase())).length * 2.5,
    7.5,
  )
  const subcategoryScore = definition.subcategories.some(
    (subcategory) => item.subcategory === subcategory || text.includes(subcategory.toLocaleLowerCase()),
  )
    ? 4
    : 0
  const silhouetteScore = definition.silhouettes.includes(attributes.silhouette) ? 2.5 : 0
  const patternScore = definition.patterns.includes(attributes.pattern) ? 1.5 : 0
  const materialScore = definition.materials.includes(attributes.material) ? 2 : 0
  const [minFormality, maxFormality] = definition.formality
  const formalityScore =
    attributes.formality >= minFormality && attributes.formality <= maxFormality
      ? 3
      : Math.max(
          0,
          3 - Math.min(
            Math.abs(attributes.formality - minFormality),
            Math.abs(attributes.formality - maxFormality),
          ) * 6,
        )
  const colorScore =
    definition.neutralColorBonus && neutralColors.has(item.colorName?.trim() ?? '')
      ? 1.5
      : 0

  return (
    keywordScore +
    subcategoryScore +
    silhouetteScore +
    patternScore +
    materialScore +
    formalityScore +
    colorScore +
    getFitScore(attributes, fit)
  )
}

function scoreCombination<T extends StyleRuleItem>(
  items: T[],
  style: OutfitStyle,
  fit: PreferredFit,
  season: Season,
) {
  const averageStyle =
    items.reduce((sum, item) => sum + getItemStyleScore(item, style, fit), 0) /
    items.length
  const pairs: Array<[T, T]> = []
  items.forEach((item, index) => {
    items.slice(index + 1).forEach((other) => pairs.push([item, other]))
  })
  const averageColor =
    pairs.length > 0
      ? pairs.reduce((sum, [left, right]) => sum + getColorScore(left, right), 0) /
        pairs.length
      : 0
  const averageRotation =
    items.reduce((sum, item) => sum + getRotationScore(item), 0) / items.length
  const hasShoes = items.some((item) => includesCategory(item, 'shoes'))
  const hasOuter = items.some(
    (item) => includesCategory(item, 'outer') || getFashionAttributes(item).layerRole === 'outer',
  )
  const patternedCount = items.filter((item) => {
    const pattern = getFashionAttributes(item).pattern
    return pattern !== 'solid' && pattern !== 'unknown'
  }).length
  const patternPenalty = patternedCount > 1 ? (patternedCount - 1) * 1.5 : 0
  const summerWarmthPenalty =
    season === 'summer'
      ? items.filter((item) => getFashionAttributes(item).warmth === 'heavy').length * 4
      : 0
  const layerBonus =
    hasOuter && (season === 'autumn' || season === 'winter') ? 1.5 : 0

  return (
    averageStyle * 2.4 +
    averageColor * 1.7 +
    averageRotation +
    (hasShoes ? 2 : 0) +
    layerBonus -
    patternPenalty -
    summerWarmthPenalty
  )
}

function sortPool<T extends StyleRuleItem>(
  items: T[],
  style: OutfitStyle,
  fit: PreferredFit,
) {
  return [...items]
    .sort(
      (left, right) =>
        getItemStyleScore(right, style, fit) + getRotationScore(right) -
        (getItemStyleScore(left, style, fit) + getRotationScore(left)),
    )
    .slice(0, 8)
}

export function buildOutfitCombinations<T extends StyleRuleItem>(
  items: T[],
  style: OutfitStyle,
  fit: PreferredFit,
  season: Season,
) {
  const tops = sortPool(
    items.filter((item) => {
      const role = getFashionAttributes(item).layerRole
      return includesCategory(item, 'top') && role !== 'outer' && role !== 'mid'
    }),
    style,
    fit,
  )
  const bottoms = sortPool(items.filter((item) => includesCategory(item, 'bottom')), style, fit)
  const dresses = sortPool(items.filter((item) => includesCategory(item, 'dress')), style, fit)
  const midlayers = sortPool(
    items.filter(
      (item) =>
        includesCategory(item, 'midlayer') || getFashionAttributes(item).layerRole === 'mid',
    ),
    style,
    fit,
  )
  const outers = sortPool(
    items.filter(
      (item) =>
        includesCategory(item, 'outer') || getFashionAttributes(item).layerRole === 'outer',
    ),
    style,
    fit,
  )
  const shoes = sortPool(items.filter((item) => includesCategory(item, 'shoes')), style, fit)
  const accessories = sortPool(
    items.filter((item) => includesCategory(item, 'accessory')),
    style,
    fit,
  )
  const combinations = new Map<string, T[]>()

  const push = (selectedItems: T[]) => {
    const uniqueItems = [...new Map(selectedItems.map((item) => [item.id, item])).values()]
    if (uniqueItems.length !== selectedItems.length || uniqueItems.length > 5) return
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
      outers.slice(0, 3).forEach((outer) => pushCore([...base, outer]))
      midlayers.slice(0, 2).forEach((midlayer) => {
        outers.slice(0, 2).forEach((outer) => pushCore([...base, midlayer, outer]))
      })
    }
  }

  for (const dress of dresses) {
    pushCore([dress])
    outers.slice(0, 3).forEach((outer) => pushCore([dress, outer]))
  }

  return [...combinations.values()]
    .map((selectedItems) => ({
      id: '',
      items: selectedItems,
      score: scoreCombination(selectedItems, style, fit, season),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 18)
    .map((combination, index) => ({
      ...combination,
      id: `combination-${index + 1}`,
    })) satisfies OutfitCombination<T>[]
}
