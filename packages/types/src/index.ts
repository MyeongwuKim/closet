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

export interface FashionItemAttributes {
  layerRole: FashionLayerRole
  silhouette: FashionSilhouette
  pattern: FashionPattern
  material: FashionMaterial
  texture?: FashionTexture
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

export interface TodayOutfitRecommendation {
  date: string
  season: Season
  ready: boolean
  headline: string
  summary: string
  style: string
  items: WardrobeItem[]
  reasons: string[]
  profileSummary: string[]
  model: string
  source: 'ai' | 'fallback'
}

export interface OutfitPreview {
  imageBase64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
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
