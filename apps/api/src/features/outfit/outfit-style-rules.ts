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

interface StyleDefinition {
  description: string
  keywords: string[]
  subcategories: string[]
  silhouettes: FashionSilhouette[]
  patterns: FashionPattern[]
  materials: FashionMaterial[]
  textures: FashionTexture[]
  formality: [number, number]
  neutralColorBonus: boolean
}

export const styleDefinitions: Record<OutfitStyle, StyleDefinition> = {
  minimal: {
    description:
      '아이템 종류보다 전체 코디의 절제된 인상을 본다. 색과 패턴 수가 적고 장식이 과하지 않으며, 상하의 볼륨이 정돈된 조합을 우선한다. 여유로운 옷도 선이 깔끔하고 색 구성이 단순하면 미니멀로 볼 수 있다.',
    keywords: ['무지', '셔츠', '슬랙스', '니트', '코트', '로퍼', '블레이저'],
    subcategories: ['셔츠', '니트', '슬랙스', '일반 긴바지', '블레이저', '코트', '로퍼'],
    silhouettes: ['slim', 'regular', 'relaxed'],
    patterns: ['solid', 'stripe'],
    materials: ['cotton', 'knit', 'wool'],
    textures: ['smooth', 'twill', 'ribbed'],
    formality: [0.4, 0.82],
    neutralColorBonus: true,
  },
  casual: {
    description:
      '특정 아이템 종류가 아니라 전체 코디에서 느껴지는 편안함과 자연스러운 실루엣을 본다. 셔츠·니트·코트처럼 단정한 아이템도 데님·치노·스니커즈나 여유로운 이너와 조합되면 캐주얼이며, 슬랙스도 편안한 상의·와이드 실루엣·편한 신발과 맞추면 캐주얼이 될 수 있다. 반대로 코트·셔츠·니트·슬랙스가 하나 들어갔다는 이유만으로 클래식으로 판단하지 않는다.',
    keywords: ['티셔츠', '반팔', '긴팔', '데님', '청바지', '스니커즈', '후드', '맨투맨', '치노'],
    subcategories: ['반팔', '긴팔', '맨투맨', '후드', '폴로 셔츠', '데님', '치노 팬츠', '일반 긴바지', '스니커즈', '재킷', '가디건'],
    silhouettes: ['regular', 'relaxed'],
    patterns: ['solid', 'stripe', 'check', 'graphic'],
    materials: ['cotton', 'denim', 'knit'],
    textures: ['smooth', 'twill', 'corduroy', 'ribbed', 'quilted', 'distressed'],
    formality: [0.08, 0.62],
    neutralColorBonus: false,
  },
  street: {
    description:
      '상의와 하의의 오버사이즈·와이드 볼륨, 레이어드, 그래픽이나 스포티한 디테일이 전체 조합에서 분명하게 드러나는지 본다. 와이드 아이템 하나만으로 스트릿으로 판단하지 않고 다른 아이템과 만든 실루엣을 함께 본다.',
    keywords: ['오버핏', '와이드', '카고', '후드', '조거', '스니커즈', '그래픽', '집업', '패딩'],
    subcategories: ['맨투맨', '후드', '와이드 팬츠', '조거 팬츠', '집업', '패딩', '스니커즈', '모자'],
    silhouettes: ['relaxed', 'oversized'],
    patterns: ['solid', 'graphic', 'other'],
    materials: ['cotton', 'denim', 'synthetic', 'leather'],
    textures: ['smooth', 'twill', 'quilted', 'distressed'],
    formality: [0, 0.42],
    neutralColorBonus: false,
  },
  classic: {
    description:
      '구조적인 소재와 정돈된 레귤러·슬림 실루엣, 셔츠·테일러드 슬랙스·블레이저·로퍼 같은 아이템의 결합으로 전체 격식이 높아지는 조합을 본다. 셔츠나 슬랙스 하나만 포함됐다는 이유로 클래식으로 판단하지 않는다.',
    keywords: ['셔츠', '슬랙스', '블레이저', '재킷', '코트', '로퍼', '구두', '니트'],
    subcategories: ['셔츠', '니트', '슬랙스', '블레이저', '코트', '로퍼', '구두'],
    silhouettes: ['slim', 'regular'],
    patterns: ['solid', 'stripe', 'check'],
    materials: ['cotton', 'knit', 'wool', 'leather'],
    textures: ['smooth', 'twill', 'ribbed'],
    formality: [0.58, 1],
    neutralColorBonus: true,
  },
  vintage: {
    description:
      '워싱, 체크, 코듀로이, 레더처럼 시간이 느껴지는 질감과 색이 여러 아이템 사이에서 자연스럽게 이어지는지 본다. 특정 소재 하나보다 전체 조합의 시대감과 질감 조화를 우선한다.',
    keywords: ['워싱', '코듀로이', '레더', '가죽', '체크', '데님', '브라운', '올리브'],
    subcategories: ['셔츠', '데님', '재킷', '부츠', '로퍼'],
    silhouettes: ['regular', 'relaxed', 'oversized'],
    patterns: ['solid', 'stripe', 'check', 'floral', 'other'],
    materials: ['denim', 'leather', 'wool', 'cotton'],
    textures: ['twill', 'corduroy', 'suede', 'distressed'],
    formality: [0.18, 0.72],
    neutralColorBonus: false,
  },
  sporty: {
    description:
      '기능성 소재, 활동하기 좋은 실루엣, 트랙·조거·바람막이·러닝화 같은 요소가 전체 조합에서 운동복의 인상을 만드는지 본다. 스니커즈나 후드 하나만 포함됐다는 이유로 스포티로 판단하지 않는다.',
    keywords: ['트랙', '조거', '레깅스', '러닝', '스니커즈', '바람막이', '집업', '후드'],
    subcategories: ['후드', '집업', '조거 팬츠', '레깅스', '스니커즈'],
    silhouettes: ['slim', 'regular', 'relaxed'],
    patterns: ['solid', 'graphic', 'other'],
    materials: ['synthetic', 'cotton', 'knit'],
    textures: ['smooth', 'quilted', 'glossy'],
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

function isNeutralItemColor(item: StyleRuleItem) {
  const color = colorHexToOklch(item.colorHex)
  return color
    ? color.chroma <= NEUTRAL_CHROMA_MAX
    : neutralColors.has(item.colorName?.trim() ?? '')
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
  const keywordMatchCount = definition.keywords.filter((keyword) =>
    text.includes(keyword.toLocaleLowerCase()),
  ).length
  const keywordScore = style === 'casual'
    ? Math.min(keywordMatchCount, 1) * 1.25
    : Math.min(keywordMatchCount * 2.5, 7.5)
  const subcategoryScore = definition.subcategories.some(
    (subcategory) => item.subcategory === subcategory || text.includes(subcategory.toLocaleLowerCase()),
  )
    ? style === 'casual' ? 2.5 : 4
    : 0
  const silhouetteScore = definition.silhouettes.includes(attributes.silhouette) ? 2.5 : 0
  const patternScore = definition.patterns.includes(attributes.pattern) ? 1.5 : 0
  const materialScore = definition.materials.includes(attributes.material) ? 2 : 0
  const textureScore = definition.textures.includes(attributes.texture ?? 'unknown')
    ? 1.5
    : 0
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
    definition.neutralColorBonus && isNeutralItemColor(item)
      ? 1.5
      : 0

  return (
    keywordScore +
    subcategoryScore +
    silhouetteScore +
    patternScore +
    materialScore +
    textureScore +
    formalityScore +
    colorScore +
    getFitScore(attributes, fit)
  )
}

function isCasualAnchor(item: StyleRuleItem) {
  const definition = styleDefinitions.casual
  const attributes = getFashionAttributes(item)
  const text = `${item.name} ${item.subcategory ?? ''}`.toLocaleLowerCase()
  const hasCasualKeyword = definition.keywords.some((keyword) =>
    text.includes(keyword.toLocaleLowerCase()),
  )
  const hasCasualSubcategory = definition.subcategories.some(
    (subcategory) =>
      item.subcategory === subcategory ||
      text.includes(subcategory.toLocaleLowerCase()),
  )
  const hasRelaxedEverydayShape =
    ['relaxed', 'oversized'].includes(attributes.silhouette) &&
    attributes.formality <= definition.formality[1]

  return (
    hasCasualKeyword ||
    hasCasualSubcategory ||
    attributes.formality <= 0.3 ||
    hasRelaxedEverydayShape
  )
}

function getStyleRelationshipScore<T extends StyleRuleItem>(
  items: T[],
  style: OutfitStyle,
) {
  if (style !== 'casual') return 0

  const casualAnchorCount = items.filter(isCasualAnchor).length
  const structuredItemCount = items.filter(
    (item) => getFashionAttributes(item).formality > 0.62,
  ).length
  const casualCoherenceScore = Math.min(casualAnchorCount, 3) * 0.8
  const mixedFormalityScore =
    casualAnchorCount >= 2 ? Math.min(structuredItemCount, 2) * 3 : 0

  return casualCoherenceScore + mixedFormalityScore
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
      ? pairs.reduce(
          (sum, [left, right]) => sum + getColorHarmonyScore(left, right),
          0,
        ) /
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
    getStyleRelationshipScore(items, style) +
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
  baseItemId?: string,
) {
  // Keep the requested item ahead of both the pool limit and per-role limits.
  return [...items]
    .sort(
      (left, right) =>
        Number(right.id === baseItemId) - Number(left.id === baseItemId) ||
        getItemStyleScore(right, style, fit) + getRotationScore(right) -
        (getItemStyleScore(left, style, fit) + getRotationScore(left)),
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

export function buildOutfitCombinations<T extends StyleRuleItem>(
  items: T[],
  style: OutfitStyle,
  fit: PreferredFit,
  season: Season,
  baseItemId?: string,
) {
  if (baseItemId !== undefined && !items.some((item) => item.id === baseItemId)) {
    return []
  }
  const tops = sortPool(
    items.filter((item) => {
      const role = getFashionAttributes(item).layerRole
      return includesCategory(item, 'top') && role !== 'outer' && role !== 'mid'
    }),
    style,
    fit,
    baseItemId,
  )
  const bottoms = sortPool(items.filter((item) => includesCategory(item, 'bottom')), style, fit, baseItemId)
  const dresses = sortPool(items.filter((item) => includesCategory(item, 'dress')), style, fit, baseItemId)
  const midlayers = sortPool(
    items.filter(
      (item) =>
        includesCategory(item, 'midlayer') || getFashionAttributes(item).layerRole === 'mid',
    ),
    style,
    fit,
    baseItemId,
  )
  const outers = sortPool(
    items.filter(
      (item) =>
        includesCategory(item, 'outer') || getFashionAttributes(item).layerRole === 'outer',
    ),
    style,
    fit,
    baseItemId,
  )
  const shoes = sortPool(items.filter((item) => includesCategory(item, 'shoes')), style, fit, baseItemId)
  const accessories = sortPool(
    items.filter((item) => includesCategory(item, 'accessory')),
    style,
    fit,
    baseItemId,
  )
  const combinations = new Map<string, T[]>()

  const push = (selectedItems: T[]) => {
    if (baseItemId !== undefined && !selectedItems.some((item) => item.id === baseItemId)) return
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
      score: scoreCombination(selectedItems, style, fit, season),
    }))
    .sort((left, right) => right.score - left.score)

  return selectDiverseCombinations(scoredCombinations, 18)
    .map((combination, index) => ({
      ...combination,
      id: `combination-${index + 1}`,
    })) satisfies OutfitCombination<T>[]
}
