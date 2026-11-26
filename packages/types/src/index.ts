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
  | 'standCollar'
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

export type WearAvoidanceReason = 'hard_to_style' | 'fit_issue' | 'temporarily_unused'

export interface WardrobeItem {
  id: string
  name: string
  brandName?: string
  /** 사용자가 직접 입력한 현재 보관 장소. 미입력·구버전 데이터는 null 또는 누락이다. */
  storageLocation?: string | null
  /** 최신 미착용 사유. 실제 착용 기록이나 시스템의 재발견 선정 근거와 별개다. */
  wearAvoidanceReason?: WearAvoidanceReason | null
  /** 일시 보류를 해제하는 한국 날짜. 이 날짜부터 다시 자동 추천에 포함한다. */
  recommendationResumeOn?: string | null
  createdAt: string
  /** 옷장에서 삭제한 시각. 값이 있어도 기존 코디·플래너의 구성 표시에는 유지한다. */
  archivedAt?: string | null
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

/** 옷장 전체에서 선정한 하루 하이라이트. day는 한국 날짜이며, reason은 착용 기록에 근거한다. */
export interface WardrobeRediscovery {
  day: string
  items: Array<{
    item: WardrobeItem
    reason: 'no_wear_record' | 'long_unworn'
    daysSinceLastWorn: number | null
    /** 마지막 착용일 하루의 평균 기온(℃). 착용·기온 기록이 없으면 null이며 이전 날짜의 기온으로 대체하지 않는다. */
    lastWornTemperatureC: number | null
  }>
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
  | 'tone-in-tone'
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

/** 비슷한 하루 평균 기온의 실제 착용 기록에서 계산한 개인 체감 보정. revision은 근거 변경을 구분하는 불투명 값이다. */
export interface ThermalRecommendationContext {
  revision: string
  direction: 'warmer' | 'cooler' | 'neutral'
  strength: number
  sampleCount: number
}

export interface TodayOutfitRecommendation {
  /** 현재 계절·날씨·제외 조건으로 추린 추천 후보 수. 이전 로컬 기록에는 없을 수 있다. */
  combinationCount?: number
  /** 만들 수 있었던 후보들이 모두 전날의 핵심 구성과 겹쳤을 때 true다. */
  previousDayRepeatOnly?: boolean | null
  /** 전날 규칙을 통과한 조합을 대상 날짜에 이미 추천한 경우 true다. */
  seenOutfitsOnly?: boolean | null
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
  thermalContext?: ThermalRecommendationContext | null
}

export interface WeatherSnapshot {
  date: string
  /** 날씨 제공자를 조회한 시점부터 30분 뒤의 만료 시각. 이전 추천 기록에는 없을 수 있다. */
  expiresAt?: string | null
  temperatureC: number
  /** 지난 착용일의 하루 평균 기온과 비교할 예보의 일평균. 현재 기온 temperatureC와 구분하며 이전 기록에는 없을 수 있다. */
  meanTemperatureC?: number | null
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

/** 알림 확인·생성 작업의 만료와 무관하게 계정과 옷 조합으로 다시 찾은 완료 이미지. 이전 이미지에는 작업 번호가 없을 수 있다. */
export interface CompletedOutfitPreview extends StoredOutfitPreview {
  jobId: string | null
  createdAt: string
}

/** 서버에 보관한 AI 이미지 생성 작업. interrupted는 전송 후 결과를 확인하지 못해 자동 재생성을 멈춘 상태다. */
export interface OutfitPreviewJob {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'interrupted'
  selectedItemIds: string[]
  style: string | null
  imageAssetId: string | null
  model: string | null
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
  /** 작업 상태·선택 옷·완료 이미지를 복원할 코디 편집 경로. */
  path: string
}

/** 공통 AI 사용권을 이용하는 진입 기능을 구분한다. 추천과 이미지 생성은 같은 잔액을 사용한다. */
export type AiCreditKind = 'preview' | 'recommendation'

/** 이용권 잔액. 진행 중 예약은 이미 차감된 값이다. capacity가 있으면 시간 충전 지갑이고, 없으면 날짜별 이미지 생성권이다. */
export interface PreviewCredits {
  /** 개발 서버가 광고 없는 테스트 충전을 허용하는지 여부. */
  testRefillAvailable?: boolean
  freeRemaining: number
  rewardRemaining: number
  totalRemaining: number
  /** 오늘 추가로 받을 수 있는 광고 보상 횟수. null은 일일 지급 상한이 없다는 뜻이다. */
  adRewardsRemaining: number | null
  rewardMode: 'test' | 'production' | 'disabled'
  resetsAt: string
  pendingRewardSessionId: string | null
  /** 시간 충전 지갑의 최대 보유량. 이전의 날짜별 생성권에는 값이 없다. */
  capacity?: number | null
  /** 다음 1개 충전 시각. 최대 보유 상태이면 null이다. */
  nextRefillAt?: string | null
  /** 잔액 계산에 사용한 서버 시각. 대기 시간 표시를 기기 시계와 구분할 때 사용한다. */
  serverNow?: string | null
}

/** 서버가 발급한 광고 번호. watchedAt은 앱의 완료 보고이며 granted만 서버가 지급을 확정한 상태다. */
export interface PreviewRewardSession {
  id: string
  mode: 'test' | 'production'
  adUnitId: string
  status: 'pending' | 'granted'
  watchedAt: string | null
  validUntil: string
}

/** 사용자가 실제로 입은 코디에 남기는 추위·적정·더위 체감. */
export type WearFeeling = 'cold' | 'comfortable' | 'hot'

/** 날짜별 착용 기록의 표시 기온과 원본을 구분한다. 직접 입력한 값이 있으면 표시 기온에 우선한다. */
export interface TemperatureWearRecord {
  date: string
  outfitId: string
  wornAt: string
  temperatureC: number | null
  automaticTemperatureC: number | null
  manualTemperatureC: number | null
  feeling: WearFeeling | null
}

/** 기온의 하한은 포함하고 상한은 제외한다. 조건이 없으면 기온 미기록을 포함한 전체 착용을 조회한다. */
export interface TemperatureWearHistoryInput {
  minTemperatureC?: number | null
  maxTemperatureC?: number | null
  feeling?: WearFeeling | null
  unrecordedOnly?: boolean | null
  compositionItemIds?: string[] | null
  outfitFilter?: {
    style?: string | null
    season?: Season | null
    color?: string | null
    wardrobeItemIds?: string[] | null
    search?: string | null
    sort?: 'latest' | 'oldest' | null
  } | null
  limit?: number | null
  cursor?: string | null
}

export interface PlannerEntry {
  id: string
  date: string
  outfitId: Outfit['id']
  /** 실제 착용을 확인한 시각. 기존 일정에 값이 없거나 null이면 착용 기록으로 집계하지 않는다. */
  wornAt?: string | null
  /** 확인된 착용의 체감 기록. 값이 없거나 null이면 아직 기록하지 않았다. */
  wearFeeling?: WearFeeling | null
}

export interface RecommendationRequest {
  baseItemIds: WardrobeItem['id'][]
  occasion?: string
  weather?: string
  useWardrobeOnly: boolean
}
