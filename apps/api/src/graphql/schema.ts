export const typeDefs = `#graphql
  enum ClothingCategory {
    top
    bottom
    outer
    midlayer
    dress
    shoes
    accessory
    other
  }

  enum ClassificationStatus {
    pending
    classified
    failed
  }

  enum ColorMode {
    solid
    patterned
    multicolor
  }

  enum FashionLayerRole {
    base
    mid
    outer
    single
    unknown
  }

  enum FashionSilhouette {
    slim
    regular
    relaxed
    oversized
    unknown
  }

  enum FashionPattern {
    solid
    stripe
    check
    graphic
    floral
    other
    unknown
  }

  enum FashionMaterial {
    cotton
    denim
    knit
    wool
    leather
    linen
    synthetic
    other
    unknown
  }

  enum FashionTexture {
    smooth
    twill
    corduroy
    ribbed
    cableKnit
    fuzzy
    boucle
    quilted
    suede
    glossy
    distressed
    other
    unknown
  }

  enum FashionWarmth {
    light
    medium
    heavy
    unknown
  }

  enum FashionTrimPresence {
    present
    absent
    unknown
  }

  enum FashionBottomLegShape {
    skinny
    straight
    wide
    tapered
    flared
    unknown
  }

  enum FashionPocketStyle {
    none
    slant
    welt
    patch
    cargo
    kangaroo
    zippered
    mixed
    unknown
  }

  enum FashionNecklineStyle {
    crew
    vNeck
    mock
    turtleneck
    collar
    hood
    scoop
    boat
    square
    other
    unknown
  }

  enum FashionFrontOpeningStyle {
    none
    buttons
    halfButtons
    zipper
    halfZip
    wrap
    other
    unknown
  }

  enum FashionBottomWaistStyle {
    structured
    elastic
    drawstring
    mixed
    unknown
  }

  type FashionItemAttributes {
    layerRole: FashionLayerRole!
    silhouette: FashionSilhouette!
    pattern: FashionPattern!
    material: FashionMaterial!
    texture: FashionTexture
    ribbedCuffs: FashionTrimPresence
    ribbedHem: FashionTrimPresence
    ribbedNeckline: FashionTrimPresence
    necklineStyle: FashionNecklineStyle
    frontOpeningStyle: FashionFrontOpeningStyle
    pocketStyle: FashionPocketStyle
    bottomLegShape: FashionBottomLegShape
    bottomWaistStyle: FashionBottomWaistStyle
    bottomFrontPleats: FashionTrimPresence
    warmth: FashionWarmth!
    formality: Float!
    confidence: Float!
  }

  input FashionItemAttributesInput {
    layerRole: FashionLayerRole!
    silhouette: FashionSilhouette!
    pattern: FashionPattern!
    material: FashionMaterial!
    texture: FashionTexture
    ribbedCuffs: FashionTrimPresence
    ribbedHem: FashionTrimPresence
    ribbedNeckline: FashionTrimPresence
    necklineStyle: FashionNecklineStyle
    frontOpeningStyle: FashionFrontOpeningStyle
    pocketStyle: FashionPocketStyle
    bottomLegShape: FashionBottomLegShape
    bottomWaistStyle: FashionBottomWaistStyle
    bottomFrontPleats: FashionTrimPresence
    warmth: FashionWarmth!
    formality: Float!
    confidence: Float!
  }

  enum PreferredFit {
    wide
    regular
    skinny
  }

  enum Gender {
    male
    female
  }

  enum BodyBuild {
    slim
    average
    athletic
    broad
  }

  enum Season {
    spring
    summer
    autumn
    winter
  }

  enum OutfitStyle {
    minimal
    casual
    street
    classic
    vintage
    sporty
  }

  enum OutfitSource {
    manual
    ai
  }

  enum ImageAssetKind {
    wardrobeOriginal
    wardrobeCutout
    outfitGenerated
  }

  enum ImageUploadStatus {
    pending
    ready
    failed
  }

  enum GenerationStatus {
    queued
    processing
    completed
    failed
  }

  type ApiHealth {
    service: String!
    status: String!
    classifier: String!
  }

  type ViewerStyleProfile {
    gender: Gender
    bodyBuild: BodyBuild
    heightCm: Float
    weightKg: Float
    chestCircumferenceCm: Float
    waistCircumferenceCm: Float
    hipCircumferenceCm: Float
    shoulderWidthCm: Float
    inseamCm: Float
    preferredFit: PreferredFit!
    preferredStyles: [OutfitStyle!]!
  }

  type WearReminderPreferences {
    enabled: Boolean!
    intervalDays: Int!
    combinationReminderEnabled: Boolean!
    itemReminderEnabled: Boolean!
  }

  type Viewer {
    id: ID!
    displayName: String
    email: String
    isTemporary: Boolean!
    styleProfile: ViewerStyleProfile!
    wearReminderPreferences: WearReminderPreferences!
  }

  input TestLoginInput {
    loginId: String!
    password: String!
    displayName: String
  }

  type AuthPayload {
    accessToken: String!
    viewer: Viewer!
  }

  input UpdateMyStyleProfileInput {
    gender: Gender!
    bodyBuild: BodyBuild!
    heightCm: Float
    weightKg: Float
    chestCircumferenceCm: Float
    waistCircumferenceCm: Float
    hipCircumferenceCm: Float
    shoulderWidthCm: Float
    inseamCm: Float
    preferredFit: PreferredFit!
    preferredStyles: [OutfitStyle!]!
  }

  input UpdateWearReminderPreferencesInput {
    enabled: Boolean!
    intervalDays: Int!
    combinationReminderEnabled: Boolean!
    itemReminderEnabled: Boolean!
  }

  type ImageAsset {
    id: ID!
    cloudflareImageId: String!
    kind: ImageAssetKind!
    uploadStatus: ImageUploadStatus!
    deliveryVariant: String
    deliveryUrl: String
    originalFilename: String
    storageFilename: String
    mimeType: String
    width: Int
    height: Int
  }

  input PrepareImageUploadInput {
    kind: ImageAssetKind!
    originalFilename: String
    mimeType: String!
  }

  type PreparedImageUpload {
    asset: ImageAsset!
    uploadUrl: String!
    uploadFilename: String!
  }

  type WardrobeItem {
    id: ID!
    name: String!
    displayImageAsset: ImageAsset
    originalImageAsset: ImageAsset
    category: ClothingCategory
    additionalCategories: [ClothingCategory!]!
    subcategory: String
    colorName: String
    colorDetailName: String
    colorHex: String
    colorMode: ColorMode
    fashionAttributes: FashionItemAttributes
    seasons: [Season!]!
    tags: [String!]!
    sizeLabel: String
    shoulderWidthCm: Float
    chestWidthCm: Float
    sleeveLengthCm: Float
    totalLengthCm: Float
    waistWidthCm: Float
    hipWidthCm: Float
    inseamCm: Float
    thighWidthCm: Float
    riseCm: Float
    hemWidthCm: Float
    classificationStatus: ClassificationStatus!
    classificationConfidence: Float
    classificationModel: String
    wearCount: Int!
    lastWornAt: String
    createdAt: String!
    updatedAt: String!
  }

  input CreateWardrobeItemInput {
    name: String!
    displayImageAssetId: ID!
    originalImageAssetId: ID
    category: ClothingCategory
    additionalCategories: [ClothingCategory!]
    subcategory: String
    colorName: String
    colorDetailName: String
    colorHex: String
    colorMode: ColorMode
    fashionAttributes: FashionItemAttributesInput
    seasons: [Season!]!
    tags: [String!]
    sizeLabel: String
    shoulderWidthCm: Float
    chestWidthCm: Float
    sleeveLengthCm: Float
    totalLengthCm: Float
    waistWidthCm: Float
    hipWidthCm: Float
    inseamCm: Float
    thighWidthCm: Float
    riseCm: Float
    hemWidthCm: Float
    classificationStatus: ClassificationStatus
    classificationConfidence: Float
    classificationModel: String
  }

  input UpdateWardrobeItemInput {
    name: String
    category: ClothingCategory
    additionalCategories: [ClothingCategory!]
    subcategory: String
    colorName: String
    colorDetailName: String
    colorHex: String
    colorMode: ColorMode
    seasons: [Season!]
    tags: [String!]
    sizeLabel: String
    shoulderWidthCm: Float
    chestWidthCm: Float
    sleeveLengthCm: Float
    totalLengthCm: Float
    waistWidthCm: Float
    hipWidthCm: Float
    inseamCm: Float
    thighWidthCm: Float
    riseCm: Float
    hemWidthCm: Float
  }

  type OutfitItem {
    id: ID!
    wardrobeItemId: ID!
    slot: ClothingCategory!
    layerOrder: Int!
    wardrobeItem: WardrobeItem!
  }

  type OutfitGeneration {
    id: ID!
    status: GenerationStatus!
    model: String
    prompt: String
    errorMessage: String
    requestedAt: String!
    completedAt: String
    imageAsset: ImageAsset
  }

  type OutfitRecommendationColor {
    name: String!
    hex: String!
    reason: String!
    role: String!
  }

  type OutfitRecommendationCandidate {
    item: WardrobeItem!
    reason: String!
    relation: String!
  }

  type OutfitRecommendation {
    targetCategory: ClothingCategory!
    headline: String!
    summary: String!
    recommendedColors: [OutfitRecommendationColor!]!
    candidates: [OutfitRecommendationCandidate!]!
    model: String!
    source: String!
  }

  type TodayOutfitRecommendation {
    date: String!
    season: Season!
    ready: Boolean!
    headline: String!
    summary: String!
    style: String!
    items: [WardrobeItem!]!
    reasons: [String!]!
    profileSummary: [String!]!
    model: String!
    source: String!
    weather: WeatherSnapshot
  }

  type OutfitPreview {
    imageBase64: String!
    mimeType: String!
    model: String!
  }

  type Outfit {
    id: ID!
    name: String!
    style: String!
    seasons: [Season!]!
    source: OutfitSource!
    plannerOnly: Boolean!
    note: String
    items: [OutfitItem!]!
    generations: [OutfitGeneration!]!
    createdAt: String!
    updatedAt: String!
  }

  input CreateOutfitItemInput {
    wardrobeItemId: ID!
    layerOrder: Int!
  }

  input OutfitPreviewImageInput {
    imageBase64: String!
    mimeType: String!
    model: String!
  }

  input CreateOutfitInput {
    name: String!
    style: String!
    seasons: [Season!]!
    source: OutfitSource
    note: String
    items: [CreateOutfitItemInput!]!
    previewImage: OutfitPreviewImageInput
  }

  input UpdateOutfitInput {
    name: String!
    style: String!
    seasons: [Season!]!
    items: [CreateOutfitItemInput!]!
    previewImage: OutfitPreviewImageInput
  }

  input OutfitRecommendationInput {
    selectedItemIds: [ID!]!
    targetCategory: ClothingCategory!
  }

  input TodayOutfitRecommendationInput {
    date: String!
    season: Season!
    baseItemId: ID
    style: OutfitStyle
    variation: Int
    excludedOuterItemIds: [ID!]
    weather: WeatherSnapshotInput
  }

  input WeatherForecastInput {
    latitude: Float!
    longitude: Float!
    date: String!
  }

  input WeatherSnapshotInput {
    date: String!
    temperatureC: Float!
    minTemperatureC: Float!
    maxTemperatureC: Float!
    apparentTemperatureC: Float!
    precipitationProbability: Float
    weatherCode: Int!
    summary: String!
    recommendedSeason: Season!
    source: String!
    attribution: String!
    attributionUrl: String!
  }

  type WeatherSnapshot {
    date: String!
    temperatureC: Float!
    minTemperatureC: Float!
    maxTemperatureC: Float!
    apparentTemperatureC: Float!
    precipitationProbability: Float
    weatherCode: Int!
    summary: String!
    recommendedSeason: Season!
    source: String!
    attribution: String!
    attributionUrl: String!
  }

  input OutfitPreviewInput {
    selectedItemIds: [ID!]!
    style: String
  }

  type PlannerEntry {
    id: ID!
    date: String!
    title: String
    occasion: String
    weatherSummary: String
    temperatureC: Float
    outfit: Outfit
    createdAt: String!
    updatedAt: String!
  }

  type PlannerWeek {
    id: ID!
    weekStartsOn: String!
    entries: [PlannerEntry!]!
  }

  type OutfitWearRecord {
    outfitId: ID!
    date: String!
  }

  enum RecentWearConflictKind {
    exact
    combination
    item
  }

  type RecentWearConflict {
    kind: RecentWearConflictKind!
    wornDate: String!
    itemIds: [ID!]!
    outfitName: String
  }

  input RecentWearConflictInput {
    itemIds: [ID!]!
    targetDate: String!
    intervalDays: Int!
    combinationReminderEnabled: Boolean!
    itemReminderEnabled: Boolean!
    includeTargetDate: Boolean = false
  }

  input SetPlannerEntryInput {
    weekStartsOn: String!
    date: String!
    outfitId: ID!
    title: String
    occasion: String
    weatherSummary: String
    temperatureC: Float
  }

  input SetDirectPlannerEntryInput {
    weekStartsOn: String!
    date: String!
    itemIds: [ID!]!
    previewImage: OutfitPreviewImageInput
    recommendationName: String
    recommendationStyle: OutfitStyle
    weatherSummary: String
    temperatureC: Float
  }

  input MovePlannerEntryInput {
    weekStartsOn: String!
    sourceDate: String!
    targetDate: String!
  }

  input ClassifyWardrobeImageInput {
    imageBase64: String!
    mimeType: String!
    filename: String
  }

  input AnalyzeGarmentSizeChartInput {
    imageBase64: String!
    mimeType: String!
    filename: String
    category: ClothingCategory!
  }

  type ClassificationCandidate {
    category: ClothingCategory!
    subcategory: String!
    label: String!
    score: Float!
  }

  type ClothingClassification {
    category: ClothingCategory!
    categoryLabel: String!
    subcategory: String!
    subcategoryLabel: String!
    suggestedName: String!
    colorName: String!
    colorDetailName: String!
    colorHex: String!
    colorRgb: [Int!]!
    colorMode: ColorMode!
    fashionAttributes: FashionItemAttributes
    confidence: Float!
    model: String!
    candidates: [ClassificationCandidate!]!
    cutoutImageBase64: String
    cutoutMimeType: String
  }

  type GarmentSizeChartRow {
    sizeLabel: String!
    shoulderWidthCm: Float
    chestWidthCm: Float
    sleeveLengthCm: Float
    totalLengthCm: Float
    waistWidthCm: Float
    hipWidthCm: Float
    inseamCm: Float
    thighWidthCm: Float
    riseCm: Float
    hemWidthCm: Float
  }

  type GarmentSizeChartAnalysis {
    rows: [GarmentSizeChartRow!]!
    notes: [String!]!
    model: String!
  }

  enum CatalogSort { latest oldest }
  input WardrobePageInput {
    limit: Int = 20
    cursor: String
    sort: CatalogSort = latest
    category: ClothingCategory
    subcategory: String
    season: Season
    color: String
    tag: String
    search: String
  }
  input OutfitPageInput {
    limit: Int = 20
    cursor: String
    sort: CatalogSort = latest
    style: String
    season: Season
    color: String
    wardrobeItemIds: [ID!]
    search: String
  }
  type WardrobePage { items: [WardrobeItem!]! totalCount: Int! hasNextPage: Boolean! nextCursor: String }
  type OutfitPage { items: [Outfit!]! totalCount: Int! hasNextPage: Boolean! nextCursor: String }
  type CatalogColor { name: String! hex: String! }
  type WardrobeFilterOptions {
    totalCount: Int!
    categories: [ClothingCategory!]!
    subcategories: [String!]!
    colors: [CatalogColor!]!
    tags: [String!]!
  }
  type OutfitFilterOptions { totalCount: Int! styles: [String!]! colors: [CatalogColor!]! }
  type StatisticsBucket { key: String! label: String! count: Int! color: String }
  type MostWornItem { id: ID! name: String! wearCount: Int! imageUrl: String }
  type MostWornOutfit { id: ID! name: String! wearCount: Int! imageUrl: String itemImageUrls: [String!]! }
  type WardrobeStatistics {
    totalItems: Int!
    totalOutfits: Int!
    wearRecordCount: Int!
    unwornCount: Int!
    unwornOutfitCount: Int!
    throughDate: String!
    categories: [StatisticsBucket!]!
    colors: [StatisticsBucket!]!
    wornStyles: [StatisticsBucket!]!
    mostWorn: [MostWornItem!]!
    mostWornOutfits: [MostWornOutfit!]!
  }

  type Query {
    wardrobePage(input: WardrobePageInput): WardrobePage!
    outfitPage(input: OutfitPageInput): OutfitPage!
    wardrobeFilterOptions(category: ClothingCategory, subcategory: String): WardrobeFilterOptions!
    outfitFilterOptions: OutfitFilterOptions!
    wardrobeStatistics: WardrobeStatistics!
    health: ApiHealth!
    me: Viewer!
    wardrobeItems(category: ClothingCategory, subcategory: String): [WardrobeItem!]!
    wardrobeItem(id: ID!): WardrobeItem!
    outfits(style: String, wardrobeItemIds: [ID!]): [Outfit!]!
    outfit(id: ID!): Outfit!
    outfitRecommendation(input: OutfitRecommendationInput!): OutfitRecommendation!
    todayOutfitRecommendation(input: TodayOutfitRecommendationInput!): TodayOutfitRecommendation!
    plannerWeek(weekStartsOn: String!): PlannerWeek
    plannerEntries(from: String!, to: String!): [PlannerEntry!]!
    outfitWearHistory(outfitIds: [ID!]!): [OutfitWearRecord!]!
    recentWearConflict(input: RecentWearConflictInput!): RecentWearConflict
    weatherForecast(input: WeatherForecastInput!): WeatherSnapshot!
  }

  type Mutation {
    testLogin(input: TestLoginInput!): AuthPayload!
    logout: Boolean!
    updateMyStyleProfile(input: UpdateMyStyleProfileInput!): Viewer!
    updateWearReminderPreferences(input: UpdateWearReminderPreferencesInput!): Viewer!
    prepareImageUpload(input: PrepareImageUploadInput!): PreparedImageUpload!
    confirmImageUpload(assetId: ID!): ImageAsset!
    createWardrobeItem(input: CreateWardrobeItemInput!): WardrobeItem!
    updateWardrobeItem(id: ID!, input: UpdateWardrobeItemInput!): WardrobeItem!
    archiveWardrobeItem(id: ID!): WardrobeItem!
    createOutfit(input: CreateOutfitInput!): Outfit!
    updateOutfit(id: ID!, input: UpdateOutfitInput!): Outfit!
    generateOutfitPreview(input: OutfitPreviewInput!): OutfitPreview!
    deleteOutfit(id: ID!): Boolean!
    setPlannerEntry(input: SetPlannerEntryInput!): PlannerWeek!
    setDirectPlannerEntry(input: SetDirectPlannerEntryInput!): PlannerWeek!
    movePlannerEntry(input: MovePlannerEntryInput!): PlannerWeek!
    savePlannerOutfitToLookbook(outfitId: ID!, previewImage: OutfitPreviewImageInput): Outfit!
    clearPlannerEntry(weekStartsOn: String!, date: String!): PlannerWeek
    classifyWardrobeImage(input: ClassifyWardrobeImageInput!): ClothingClassification!
    analyzeGarmentSizeChart(input: AnalyzeGarmentSizeChartInput!): GarmentSizeChartAnalysis!
  }
`
