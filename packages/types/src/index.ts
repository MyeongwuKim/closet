export { isBagItem, MAX_OUTFIT_ITEMS } from './outfitItems.js'

export type ClothingCategory =
  | 'top'
  | 'bottom'
  | 'outer'
  | 'midlayer'
  | 'dress'
  | 'shoes'
  | 'accessory'
  | 'other'

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export type ColorMode = 'solid' | 'patterned' | 'multicolor'

export type FashionLayerRole = 'base' | 'mid' | 'outer' | 'single' | 'unknown'

export type FashionSilhouette =
  | 'slim'
  | 'regular'
  | 'relaxed'
  | 'oversized'
  | 'unknown'

export type FashionPattern =
  | 'solid'
  | 'stripe'
  | 'check'
  | 'graphic'
  | 'floral'
  | 'other'
  | 'unknown'

export type FashionMaterial =
  | 'cotton'
  | 'denim'
  | 'knit'
  | 'wool'
  | 'leather'
  | 'linen'
  | 'synthetic'
  | 'other'
  | 'unknown'

export type FashionTexture =
  | 'smooth'
  | 'twill'
  | 'corduroy'
  | 'ribbed'
  | 'cableKnit'
  | 'fuzzy'
  | 'boucle'
  | 'quilted'
  | 'suede'
  | 'glossy'
  | 'distressed'
  | 'other'
  | 'unknown'

export type FashionWarmth = 'light' | 'medium' | 'heavy' | 'unknown'

export type FashionTrimPresence = 'present' | 'absent' | 'unknown'

export type FashionBottomLegShape =
  | 'skinny'
  | 'straight'
  | 'wide'
  | 'tapered'
  | 'flared'
  | 'unknown'

export type FashionPocketStyle =
  | 'none'
  | 'slant'
  | 'welt'
  | 'patch'
  | 'cargo'
  | 'kangaroo'
  | 'zippered'
  | 'mixed'
  | 'unknown'

export type FashionNecklineStyle =
  | 'crew'
  | 'vNeck'
  | 'mock'
  | 'turtleneck'
  | 'collar'
  | 'hood'
  | 'scoop'
  | 'boat'
  | 'square'
  | 'other'
  | 'unknown'

export type FashionFrontOpeningStyle =
  | 'none'
  | 'buttons'
  | 'halfButtons'
  | 'zipper'
  | 'halfZip'
  | 'wrap'
  | 'other'
  | 'unknown'

export type FashionBottomWaistStyle =
  | 'structured'
  | 'elastic'
  | 'drawstring'
  | 'mixed'
  | 'unknown'

export interface FashionItemAttributes {
  layerRole: FashionLayerRole
  silhouette: FashionSilhouette
  pattern: FashionPattern
  material: FashionMaterial
  texture?: FashionTexture
  ribbedCuffs?: FashionTrimPresence | null
  ribbedHem?: FashionTrimPresence | null
  ribbedNeckline?: FashionTrimPresence | null
  necklineStyle?: FashionNecklineStyle | null
  frontOpeningStyle?: FashionFrontOpeningStyle | null
  pocketStyle?: FashionPocketStyle | null
  bottomLegShape?: FashionBottomLegShape | null
  bottomWaistStyle?: FashionBottomWaistStyle | null
  bottomFrontPleats?: FashionTrimPresence | null
  warmth: FashionWarmth
  formality: number
  confidence: number
}

export interface ClothingClassificationSuggestion {
  category: ClothingCategory
  subcategory: string
  label: string
  score: number
}

export interface ClothingClassificationResult {
  category: ClothingCategory
  categoryLabel: string
  subcategory: string
  subcategoryLabel: string
  suggestedName: string
  colorName: string
  colorDetailName: string
  colorHex: string
  colorRgb: [number, number, number]
  colorMode: ColorMode
  fashionAttributes?: FashionItemAttributes
  confidence: number
  model: string
  candidates: ClothingClassificationSuggestion[]
}

export interface WardrobeItem {
  id: string
  name: string
  brandName?: string
  createdAt: string
  category: ClothingCategory | null
  additionalCategories: ClothingCategory[]
  subcategory?: string
  classificationStatus: 'pending' | 'classified' | 'failed'
  colorName: string
  colorDetailName?: string
  colorHex: string
  colorMode?: ColorMode
  fashionAttributes?: FashionItemAttributes
  seasons: Season[]
  tags: string[]
  sizeLabel?: string
  shoulderWidthCm?: number
  chestWidthCm?: number
  sleeveLengthCm?: number
  totalLengthCm?: number
  waistWidthCm?: number
  hipWidthCm?: number
  inseamCm?: number
  thighWidthCm?: number
  riseCm?: number
  hemWidthCm?: number
  imageUrl?: string
  originalImageUrl?: string
  lastWornAt?: string
  wearCount: number
}

export interface OutfitItem {
  wardrobeItemId: WardrobeItem['id']
  category: ClothingCategory
}

export interface Outfit {
  id: string
  name: string
  items: OutfitItem[]
  source: 'manual' | 'ai'
  createdAt: string
}

export type OutfitMatchRelation =
  | 'clean-contrast'
  | 'tone-on-tone'
  | 'soft-balance'
  | 'accent'
  | 'design-balance'

export interface OutfitRecommendationColor {
  name: string
  hex: string
  reason: string
  role: 'safe' | 'harmony' | 'accent'
}

export interface OutfitRecommendationCandidate {
  item: WardrobeItem
  reason: string
  relation: OutfitMatchRelation
}

export interface OutfitRecommendation {
  targetCategory: ClothingCategory
  headline: string
  summary: string
  recommendedColors: OutfitRecommendationColor[]
  candidates: OutfitRecommendationCandidate[]
  model: string
  source: 'ai' | 'fallback'
}

/** 오늘의 코디에서 계절 선택 다음에 고르는 색 조합 기준이다. */
export type TodayOutfitColorScheme =
  | 'auto'
  | 'tone-on-tone'
  | 'tone-in-tone'
  | 'achromatic'
  | 'accent'

export interface TodayOutfitRecommendation {
  date: string
  season: Season
  ready: boolean
  headline: string
  summary: string
  /** 새 추천은 스타일을 지정하지 않으며, 이전 추천 기록에는 스타일명이 남아 있을 수 있다. */
  style: string | null
  items: WardrobeItem[]
  reasons: string[]
  profileSummary: string[]
  model: string
  source: 'ai' | 'fallback'
  /** 요청한 색 조합을 실제 추천 옷의 대표색으로 확인할 수 있을 때 true다. */
  colorSchemeApplied: boolean
  weather?: WeatherSnapshot | null
}

export interface WeatherSnapshot {
  date: string
  /** 날씨 제공자를 조회한 시점부터 30분 뒤의 만료 시각. 이전 추천 기록에는 없을 수 있다. */
  expiresAt?: string | null
  temperatureC: number
  minTemperatureC: number
  maxTemperatureC: number
  apparentTemperatureC: number
  precipitationProbability: number | null
  weatherCode: number
  summary: string
  recommendedSeason: Season
  source: 'open-meteo'
  attribution: string
  attributionUrl: string
}

export interface OutfitPreview {
  imageBase64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  model: string
  assetId?: string
  imageUrl?: string
}

export interface StoredOutfitPreview {
  assetId: string
  imageUrl: string
  mimeType: OutfitPreview['mimeType']
  model: string
}

export interface PlannerEntry {
  id: string
  date: string
  outfitId: Outfit['id']
}

export interface RecommendationRequest {
  baseItemIds: WardrobeItem['id'][]
  occasion?: string
  weather?: string
  useWardrobeOnly: boolean
}
