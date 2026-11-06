import { expect, test as base, type Page, type TestInfo } from '@playwright/test'
import { readFileSync } from 'node:fs'

const webOrigin = 'http://127.0.0.1:4173'
const mockApiOrigin = 'http://127.0.0.1:49999'
const mockGraphqlUrl = `${mockApiOrigin}/graphql`
const mockShirtCutoutBase64 = readFileSync('tests/support/mock-shirt.png').toString('base64')

type WardrobeItem = {
  id: string
  name: string
  brandName: string | null
  createdAt: string
  archivedAt: string | null
  category: string | null
  additionalCategories: string[]
  subcategory: string | null
  colorName: string
  colorDetailName: string | null
  colorHex: string
  colorMode: string | null
  fashionAttributes: Record<string, unknown> | null
  seasons: string[]
  tags: string[]
  sizeLabel: string | null
  shoulderWidthCm: number | null
  chestWidthCm: number | null
  sleeveLengthCm: number | null
  totalLengthCm: number | null
  waistWidthCm: number | null
  hipWidthCm: number | null
  inseamCm: number | null
  thighWidthCm: number | null
  riseCm: number | null
  hemWidthCm: number | null
  classificationStatus: string
  wearCount: number
  lastWornAt: string | null
  displayImageAsset: { id?: string; deliveryUrl: string | null } | null
  originalImageAsset: { deliveryUrl: string | null } | null
}

type Outfit = {
  id: string
  name: string
  style: string
  seasons: string[]
  createdAt: string
  items: Array<{ wardrobeItemId: string; layerOrder: number; wardrobeItem?: WardrobeItem }>
  generations: Array<{ status: string; imageAsset: { id?: string; deliveryUrl: string | null } | null }>
}

type PlannerEntry = {
  date: string
  wornAt?: string | null
  wearFeeling?: 'cold' | 'comfortable' | 'hot' | null
  title: string | null
  occasion: string | null
  weatherSummary: string | null
  temperatureC: number | null
  wearTemperatureC?: number | null
  outfit: {
    id: string
    name: string
    style: string
    plannerOnly: boolean
    items: Array<{ wardrobeItemId: string; wardrobeItem?: WardrobeItem }>
    generations: Outfit['generations']
  } | null
}

type GraphqlRequest = { query: string; variables?: Record<string, any> }

class MockGraphqlError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
  }
}

export type MockApi = {
  wardrobeItems: WardrobeItem[]
  outfits: Outfit[]
  plannerEntries: PlannerEntry[]
  rediscoveryItems: Array<{ item: WardrobeItem; reason: 'no_wear_record' | 'long_unworn'; daysSinceLastWorn: number | null }>
  rediscoverySeenIds: string[]
  operations: string[]
  uploadKinds: string[]
  classificationFailureMessage: string | null
  cutoutFailureMessage: string | null
  unexpectedRequests: string[]
  snapshotSequence: number
  previewImages: Record<string, string>
}

/** Each test receives its own in-memory catalog. Reloads reuse it; other tests cannot see its mutations. */
export function createWardrobeItem(overrides: Partial<WardrobeItem> = {}): WardrobeItem {
  return {
    id: 'item-1', name: '테스트 셔츠', brandName: null,
    createdAt: '2026-01-10T00:00:00.000Z',
    archivedAt: null,
    category: 'top', additionalCategories: [], subcategory: '셔츠',
    colorName: '네이비', colorDetailName: null, colorHex: '#24364a', colorMode: 'solid',
    fashionAttributes: null, seasons: ['spring'], tags: [],
    sizeLabel: null, shoulderWidthCm: null, chestWidthCm: null,
    sleeveLengthCm: null, totalLengthCm: null, waistWidthCm: null,
    hipWidthCm: null, inseamCm: null, thighWidthCm: null,
    riseCm: null, hemWidthCm: null, classificationStatus: 'classified',
    wearCount: 0, lastWornAt: null,
    displayImageAsset: null, originalImageAsset: null,
    ...overrides,
  }
}

export function createOutfit(overrides: Partial<Outfit> = {}): Outfit {
  return {
    id: 'outfit-1', name: '기본 코디', style: 'casual', seasons: ['spring'],
    createdAt: '2026-03-10T00:00:00.000Z',
    items: [
      { wardrobeItemId: 'item-1', layerOrder: 0 },
      { wardrobeItemId: 'item-2', layerOrder: 1 },
    ],
    generations: [],
    ...overrides,
  }
}

function createMockApi(): MockApi {
  return {
    wardrobeItems: [
      createWardrobeItem(),
      createWardrobeItem({ id: 'item-2', name: '테스트 바지', category: 'bottom', subcategory: '슬랙스', colorName: '차콜', colorHex: '#343536', seasons: ['spring', 'winter'] }),
    ],
    outfits: [createOutfit()],
    plannerEntries: [],
    rediscoveryItems: [],
    rediscoverySeenIds: [],
    operations: [],
    uploadKinds: [],
    classificationFailureMessage: null,
    cutoutFailureMessage: null,
    unexpectedRequests: [],
    snapshotSequence: 1,
    previewImages: {},
  }
}

function filterWardrobe(items: WardrobeItem[], input: Record<string, any> = {}) {
  const search = String(input.search ?? '').trim().toLocaleLowerCase()
  return items.filter((item) => {
    if (item.archivedAt) return false
    if (input.category && item.category !== input.category && !item.additionalCategories.includes(input.category)) return false
    if (input.subcategory && item.subcategory !== input.subcategory) return false
    if (input.season && !item.seasons.includes(input.season)) return false
    if (input.color && item.colorName !== input.color) return false
    if (input.tag && !item.tags.includes(input.tag)) return false
    if (input.brandName && item.brandName !== input.brandName) return false
    if (input.unbrandedOnly && item.brandName) return false
    if (search && ![item.name, item.brandName, item.subcategory, item.colorName, ...item.tags]
      .filter(Boolean).join(' ').toLocaleLowerCase().includes(search)) return false
    return true
  }).sort((a, b) => input.sort === 'oldest'
    ? a.createdAt.localeCompare(b.createdAt)
    : b.createdAt.localeCompare(a.createdAt))
}

function withWardrobeItems(api: MockApi, outfit: Outfit): Outfit {
  return {
    ...outfit,
    items: outfit.items.map((item) => ({
      ...item,
      wardrobeItem: api.wardrobeItems.find((candidate) => candidate.id === item.wardrobeItemId),
    })),
  }
}

function filterOutfits(api: MockApi, input: Record<string, any> = {}) {
  const search = String(input.search ?? '').trim().toLocaleLowerCase()
  return api.outfits.filter((outfit) => {
    if (input.style && input.style !== 'all' && outfit.style !== input.style) return false
    if (input.season && !outfit.seasons.includes(input.season)) return false
    if (input.wardrobeItemIds?.length && !input.wardrobeItemIds.every((id: string) => outfit.items.some((item) => item.wardrobeItemId === id))) return false
    if (input.color && !outfit.items.some((item) => api.wardrobeItems.find((candidate) => candidate.id === item.wardrobeItemId)?.colorName === input.color)) return false
    if (search && ![outfit.name, ...outfit.items.flatMap((item) => {
      const wardrobeItem = api.wardrobeItems.find((candidate) => candidate.id === item.wardrobeItemId)
      return wardrobeItem ? [wardrobeItem.name, wardrobeItem.colorName] : []
    })].join(' ').toLocaleLowerCase().includes(search)) return false
    return true
  }).sort((a, b) => input.sort === 'oldest'
    ? a.createdAt.localeCompare(b.createdAt)
    : b.createdAt.localeCompare(a.createdAt))
}

/** 날짜별 코디는 코디북 객체와 배열을 공유하지 않는 별도 저장값으로 만든다. */
function plannerSnapshot(api: MockApi, outfit: Pick<Outfit, 'name' | 'style' | 'items' | 'generations'>): NonNullable<PlannerEntry['outfit']> {
  return structuredClone({
    id: `900000000000000000${String(api.snapshotSequence++).padStart(6, '0')}`,
    name: outfit.name, style: outfit.style, plannerOnly: true,
    items: outfit.items.map((item) => ({ wardrobeItemId: item.wardrobeItemId })),
    generations: outfit.generations,
  })
}

function sameOutfitItems(left: Array<{ wardrobeItemId: string }>, right: Array<{ wardrobeItemId: string }>) {
  const key = (items: Array<{ wardrobeItemId: string }>) => [...new Set(items.map((item) => item.wardrobeItemId))].sort().join('|')
  return left.length > 0 && key(left) === key(right)
}

/** 옷장에서는 숨긴 옷도 날짜 코디의 관계 조회에는 남긴다. 새로고침마다 현재 보관 상태를 읽는다. */
function withPlannerWardrobeItems(api: MockApi, entry: PlannerEntry): PlannerEntry {
  return {
    ...entry,
    outfit: entry.outfit ? {
      ...entry.outfit,
      items: entry.outfit.items.map((item) => ({
        ...item,
        wardrobeItem: api.wardrobeItems.find((candidate) => candidate.id === item.wardrobeItemId),
      })),
    } : null,
  }
}

function plannerWeekPayload(api: MockApi, weekStartsOn: string) {
  const end = new Date(Date.parse(`${weekStartsOn}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10)
  return { id: `week-${weekStartsOn}`, weekStartsOn, entries: api.plannerEntries.filter((entry) => entry.date >= weekStartsOn && entry.date < end).map((entry) => withPlannerWardrobeItems(api, entry)) }
}

/** 서버가 쓰기 시점에 확인하는 착용 보호 상태를 모의 GraphQL 오류로 반환한다. */
function assertPlannerWearEditable(entry: PlannerEntry | undefined) {
  if (entry?.wornAt) {
    throw new MockGraphqlError(
      '착용 완료한 날짜예요. 코디를 바꾸려면 먼저 착용 기록을 취소해 주세요.',
      'PLANNER_WEAR_CONFIRMED',
    )
  }
}

function handleGraphql(api: MockApi, { query, variables = {} }: GraphqlRequest): Record<string, unknown> {
  const operation = query.match(/\b(?:query|mutation)\s+(\w+)/)?.[1] ?? 'unknown'
  api.operations.push(operation)
  const input = variables.input ?? {}

  switch (operation) {
    case 'ThermalRecommendationContext': return { thermalRecommendationContext: { revision: 'fixture-thermal-neutral', direction: 'neutral', strength: 0, sampleCount: 0 } }
    case 'WardrobeRediscovery': return { wardrobeRediscovery: {
      day: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date()),
      items: api.rediscoveryItems.filter((entry) => api.wardrobeItems.some((item) => item.id === entry.item.id && !item.archivedAt)),
    } }
    case 'MarkWardrobeRediscoverySeen': {
      api.rediscoverySeenIds.push(...variables.itemIds)
      return { markWardrobeRediscoverySeen: true }
    }
    case 'WardrobePage': {
      const items = filterWardrobe(api.wardrobeItems, input)
      return { wardrobePage: { items, totalCount: items.length, hasNextPage: false, nextCursor: null } }
    }
    case 'WardrobeFilterOptions': {
      const items = filterWardrobe(api.wardrobeItems, { category: variables.category, subcategory: variables.subcategory })
      return { wardrobeFilterOptions: {
        totalCount: filterWardrobe(api.wardrobeItems).length,
        categories: [...new Set(filterWardrobe(api.wardrobeItems).flatMap((item) => [item.category, ...item.additionalCategories]).filter(Boolean))],
        subcategories: [...new Set(items.map((item) => item.subcategory).filter(Boolean))],
        tags: [...new Set(items.flatMap((item) => item.tags))],
        colors: [...new Map(items.map((item) => [item.colorName, { name: item.colorName, hex: item.colorHex }])).values()],
      } }
    }
    case 'WardrobeItems': return { wardrobeItems: filterWardrobe(api.wardrobeItems) }
    case 'WardrobeItem': return { wardrobeItem: api.wardrobeItems.find((item) => item.id === variables.id && !item.archivedAt) ?? null }
    case 'WardrobeBrandOptions': return { wardrobeBrandOptions: [...new Set(filterWardrobe(api.wardrobeItems).map((item) => item.brandName).filter(Boolean))] }
    case 'Outfits': return { outfits: filterOutfits(api, variables).map((outfit) => withWardrobeItems(api, outfit)) }
    case 'Outfit': {
      const outfit = api.outfits.find((candidate) => candidate.id === variables.id)
      if (!outfit) throw new Error('코디를 찾을 수 없습니다.')
      return { outfit: { ...withWardrobeItems(api, outfit), plannerOnly: false } }
    }
    case 'OutfitPage': {
      const outfits = filterOutfits(api, input)
      return { outfitPage: { items: outfits.map((outfit) => withWardrobeItems(api, outfit)), totalCount: outfits.length, hasNextPage: false, nextCursor: null } }
    }
    case 'OutfitFilterOptions': return { outfitFilterOptions: {
      totalCount: api.outfits.length,
      styles: [...new Set(api.outfits.map((outfit) => outfit.style))],
      colors: [...new Map(api.wardrobeItems.map((item) => [item.colorName, { name: item.colorName, hex: item.colorHex }])).values()],
    } }
    case 'OutfitWearHistory': return { outfitWearHistory: variables.outfitIds.flatMap((id: string) => {
      const outfit = api.outfits.find((candidate) => candidate.id === id) ?? api.plannerEntries.find((entry) => entry.outfit?.id === id)?.outfit
      if (!outfit) return []
      return api.plannerEntries.flatMap((entry) => entry.outfit && sameOutfitItems(entry.outfit.items, outfit.items)
        ? [{ outfitId: id, date: entry.date, wornAt: entry.wornAt ?? null, temperatureC: entry.wornAt ? entry.wearTemperatureC ?? null : null }] : [])
    }) }
    case 'SyncWearWeatherLocation': return { syncWearWeatherLocation: true }
    case 'PlannerWeek': return { plannerWeek: plannerWeekPayload(api, variables.weekStartsOn) }
    case 'PlannerEntries': return { plannerEntries: api.plannerEntries.filter((entry) => entry.date >= variables.from && entry.date <= variables.to).map((entry) => withPlannerWardrobeItems(api, entry)) }
    case 'SetPlannerEntry': {
      const outfit = api.outfits.find((candidate) => candidate.id === input.outfitId)
      if (!outfit) throw new Error(`Unknown outfit: ${input.outfitId}`)
      const previous = api.plannerEntries.find((entry) => entry.date === input.date)
      const sameItems = Boolean(previous?.outfit && sameOutfitItems(previous.outfit.items, outfit.items))
      if (!sameItems) assertPlannerWearEditable(previous)
      const sameSnapshot = sameItems && previous?.outfit?.name === outfit.name && previous.outfit.style === outfit.style
        && JSON.stringify(previous.outfit.generations) === JSON.stringify(outfit.generations)
      api.plannerEntries = api.plannerEntries.filter((entry) => entry.date !== input.date)
      api.plannerEntries.push({
        date: input.date,
        wornAt: sameItems ? previous?.wornAt ?? null : null,
        wearFeeling: sameItems ? previous?.wearFeeling ?? null : null,
        wearTemperatureC: sameItems ? previous?.wearTemperatureC ?? null : null,
        title: input.title ?? outfit.name,
        occasion: input.occasion ?? null, weatherSummary: null, temperatureC: null,
        outfit: sameSnapshot ? previous!.outfit : plannerSnapshot(api, outfit),
      })
      return { setPlannerEntry: plannerWeekPayload(api, input.weekStartsOn) }
    }
    case 'SetDirectPlannerEntry': {
      const previous = api.plannerEntries.find((entry) => entry.date === input.date)
      const items = input.itemIds.map((wardrobeItemId: string, layerOrder: number) => ({ wardrobeItemId, layerOrder }))
      const sameItems = Boolean(previous?.outfit && sameOutfitItems(previous.outfit.items, items))
      if (!sameItems) assertPlannerWearEditable(previous)
      let generations = sameItems ? previous?.outfit?.generations ?? [] : []
      if (input.previewImage?.assetId) {
        const assetId = input.previewImage.assetId
        const image = api.previewImages[assetId] ?? [...api.outfits.flatMap((outfit) => outfit.generations), ...api.plannerEntries.flatMap((entry) => entry.outfit?.generations ?? [])].find((generation) => generation.imageAsset?.id === assetId)?.imageAsset?.deliveryUrl
        if (!image) throw new Error(`Unknown preview image: ${assetId}`)
        generations = [{ status: 'completed', imageAsset: { id: assetId, deliveryUrl: image } }]
      }
      const outfit = plannerSnapshot(api, {
        name: input.recommendationName ?? previous?.outfit?.name ?? '직접 고른 코디',
        style: input.recommendationStyle ?? previous?.outfit?.style ?? '직접 구성',
        items, generations,
      })
      api.plannerEntries = api.plannerEntries.filter((entry) => entry.date !== input.date)
      api.plannerEntries.push({ date: input.date, title: outfit.name, occasion: null,
        weatherSummary: input.weatherSummary ?? null, temperatureC: input.temperatureC ?? previous?.temperatureC ?? null,
        wornAt: sameItems ? previous?.wornAt ?? null : null, wearFeeling: sameItems ? previous?.wearFeeling ?? null : null,
        wearTemperatureC: sameItems ? previous?.wearTemperatureC ?? null : null, outfit })
      return { setDirectPlannerEntry: plannerWeekPayload(api, input.weekStartsOn) }
    }
    case 'SavePlannerOutfitToLookbook': {
      const source = api.plannerEntries.find((entry) => entry.outfit?.id === variables.outfitId)?.outfit
      if (!source) throw new Error('저장할 날짜 코디가 없습니다.')
      const existing = api.outfits.find((outfit) => sameOutfitItems(outfit.items, source.items))
      if (existing) return { savePlannerOutfitToLookbook: { id: existing.id } }
      const copy = createOutfit({ id: `800000000000000000${String(api.snapshotSequence++).padStart(6, '0')}`, name: source.name, style: source.style,
        items: source.items.map((item, layerOrder) => ({ ...item, layerOrder })), generations: structuredClone(source.generations) })
      api.outfits.push(copy)
      return { savePlannerOutfitToLookbook: { id: copy.id } }
    }
    case 'SetPlannerEntryWorn': {
      const entry = api.plannerEntries.find((entry) => entry.date === input.date && entry.outfit?.id === input.outfitId)
      if (!entry) throw new Error('착용을 확인할 코디가 없습니다.')
      if (!input.worn || !entry.wornAt) entry.wearFeeling = null
      entry.wornAt = input.worn ? entry.wornAt ?? new Date().toISOString() : null
      if (!input.worn) entry.wearTemperatureC = null
      for (const item of api.wardrobeItems) {
        const dates = api.plannerEntries.filter((record) => record.wornAt && record.outfit?.items.some((candidate) => candidate.wardrobeItemId === item.id)).map((record) => record.date)
        item.wearCount = new Set(dates).size
        item.lastWornAt = dates.sort().at(-1) ?? null
      }
      return { setPlannerEntryWorn: plannerWeekPayload(api, input.weekStartsOn) }
    }
    case 'SetPlannerEntryWearFeeling': {
      const entry = api.plannerEntries.find((entry) => entry.date === input.date && entry.outfit?.id === input.outfitId)
      if (!entry?.wornAt || entry.wornAt !== input.wornAt) throw new Error('현재 착용 완료 상태를 다시 확인해주세요.')
      entry.wearFeeling = input.feeling ?? null
      return { setPlannerEntryWearFeeling: plannerWeekPayload(api, input.weekStartsOn) }
    }
    case 'ClearPlannerEntry': {
      assertPlannerWearEditable(api.plannerEntries.find((entry) => entry.date === variables.date))
      api.plannerEntries = api.plannerEntries.filter((entry) => entry.date !== variables.date)
      return { clearPlannerEntry: { id: `planner-${variables.date}` } }
    }
    case 'OutfitPreviewJobs': return { outfitPreviewJobs: [] }
    case 'OutfitPreviewForItems': return { outfitPreviewForItems: null }
    case 'OutfitPreviewAsset': {
      const id = String(variables.id)
      const generations = [...api.outfits.flatMap((outfit) => outfit.generations), ...api.plannerEntries.flatMap((entry) => entry.outfit?.generations ?? [])]
      const imageUrl = api.previewImages[id] ?? generations.find((generation) => generation.imageAsset?.id === id)?.imageAsset?.deliveryUrl
      if (!imageUrl) throw new Error(`Unknown preview asset: ${id}`)
      return { outfitPreviewAsset: { assetId: id, imageUrl, mimeType: 'image/png', model: 'fixture-model' } }
    }
    case 'PreviewCredits': return { previewCredits: { freeRemaining: 5, rewardRemaining: 0, totalRemaining: 5, capacity: 5, nextRefillAt: null, serverNow: new Date().toISOString(), adRewardsRemaining: null, rewardMode: 'test', resetsAt: new Date(Date.now() + 86_400_000).toISOString(), pendingRewardSessionId: null } }
    case 'AcknowledgeOutfitPreviewJob': return { acknowledgeOutfitPreviewJob: true }
    case 'Me': return { me: {
      id: 'e2e-user', displayName: 'E2E 사용자', email: null, isTemporary: true,
      styleProfile: { gender: null, bodyBuild: null, heightCm: null, weightKg: null, chestCircumferenceCm: null, waistCircumferenceCm: null, hipCircumferenceCm: null, thighCircumferenceCm: null, shoulderWidthCm: null, inseamCm: null, preferredFit: 'regular', preferredStyles: [] },
      wearReminderPreferences: { enabled: false, intervalDays: 7, combinationReminderEnabled: false, itemReminderEnabled: false },
    } }
    case 'UpdateWardrobeItem': {
      const index = api.wardrobeItems.findIndex((item) => item.id === variables.id)
      if (index < 0) throw new Error(`Unknown wardrobe item: ${variables.id}`)
      api.wardrobeItems[index] = { ...api.wardrobeItems[index], ...input }
      return { updateWardrobeItem: api.wardrobeItems[index] }
    }
    case 'ArchiveWardrobeItem': {
      const item = api.wardrobeItems.find((item) => item.id === variables.id)
      if (!item) throw new Error(`Unknown wardrobe item: ${variables.id}`)
      item.archivedAt = new Date().toISOString()
      return { archiveWardrobeItem: item }
    }
    case 'CreateWardrobeItem': {
      const item = createWardrobeItem({ ...input, id: `item-${api.wardrobeItems.length + 1}`, createdAt: new Date().toISOString(), displayImageAsset: { id: input.displayImageAssetId, deliveryUrl: null } })
      api.wardrobeItems = [item, ...api.wardrobeItems]
      return { createWardrobeItem: item }
    }
    case 'ClassifyWardrobeImage': {
      if (api.classificationFailureMessage) throw new Error(api.classificationFailureMessage)
      return { classifyWardrobeImage: {
      category: 'top', categoryLabel: '상의', subcategory: 'shirt', subcategoryLabel: '셔츠',
      suggestedName: '새 셔츠', colorName: '네이비', colorDetailName: '네이비',
      colorHex: '#24364a', colorRgb: [36, 54, 74], colorMode: 'solid',
      fashionAttributes: null, confidence: 0.9, model: 'e2e-mock',
      cutoutImageBase64: null, cutoutMimeType: null, candidates: [],
    } }
    }
    case 'RemoveWardrobeImageBackground': {
      if (api.cutoutFailureMessage) throw new Error(api.cutoutFailureMessage)
      return { removeWardrobeImageBackground: {
        imageBase64: mockShirtCutoutBase64,
        mimeType: 'image/png',
      } }
    }
    case 'PrepareImageUpload': {
      api.uploadKinds.push(input.kind)
      return { prepareImageUpload: {
      asset: { id: 'e2e-upload-1', deliveryUrl: null },
      uploadUrl: `${mockApiOrigin}/upload`, uploadFilename: 'e2e-item.png',
      } }
    }
    case 'ConfirmImageUpload': return { confirmImageUpload: { id: variables.assetId, deliveryUrl: null } }
    case 'UpdateOutfit': {
      const index = api.outfits.findIndex((outfit) => outfit.id === variables.id)
      if (index < 0) throw new Error(`Unknown outfit: ${variables.id}`)
      const previous = api.outfits[index]
      let generations = sameOutfitItems(previous.items, input.items) ? previous.generations : []
      if (input.previewImage?.assetId) {
        const id = input.previewImage.assetId
        generations = [{ status: 'completed', imageAsset: { id, deliveryUrl: api.previewImages[id] ?? null } }]
      }
      api.outfits[index] = { ...previous, ...input, generations }
      return { updateOutfit: withWardrobeItems(api, api.outfits[index]) }
    }
    case 'DeleteOutfit': {
      api.outfits = api.outfits.filter((outfit) => outfit.id !== variables.id)
      return { deleteOutfit: true }
    }
    case 'CreateOutfit': {
      const assetId = input.previewImageAssetId ?? input.previewImage?.assetId
      const generations = assetId
        ? [{ status: 'completed', imageAsset: { id: assetId, deliveryUrl: api.previewImages[assetId] ?? null } }]
        : []
      const outfit = createOutfit({ ...input, generations, id: `outfit-${api.outfits.length + 1}`, createdAt: new Date().toISOString() })
      api.outfits = [outfit, ...api.outfits]
      return { createOutfit: withWardrobeItems(api, outfit) }
    }
    default:
      api.unexpectedRequests.push(`Unhandled GraphQL operation: ${operation}`)
      throw new Error(`Unhandled GraphQL operation: ${operation}`)
  }
}

async function installMockRoutes(page: Page, api: MockApi) {
  await page.routeWebSocket('**/*', async (socket) => {
    const url = new URL(socket.url())
    if (url.host === new URL(webOrigin).host) {
      socket.connectToServer()
      return
    }
    api.unexpectedRequests.push(`WebSocket ${socket.url()}`)
    await socket.close()
  })

  // Only the Vite server is reachable. API calls, uploads, and all other hosts are intercepted or blocked.
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = request.url()
    if (url.startsWith(`${webOrigin}/`) && ['GET', 'HEAD'].includes(request.method())) {
      await route.continue()
      return
    }
    if (url === mockGraphqlUrl && request.method() === 'POST') {
      try {
        const data = handleGraphql(api, request.postDataJSON() as GraphqlRequest)
        await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ data }) })
      } catch (error) {
        const graphQLError = error instanceof MockGraphqlError
          ? { message: error.message, extensions: { code: error.code } }
          : { message: String(error) }
        await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ errors: [graphQLError] }) })
      }
      return
    }
    if (url === `${mockApiOrigin}/upload` && request.method() === 'POST') {
      await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: '{}' })
      return
    }
    api.unexpectedRequests.push(`${request.method()} ${url}`)
    await route.abort('blockedbyclient')
  })
}

type Fixtures = {
  mockApi: MockApi
  seedMockSession: boolean
}

export const test = base.extend<Fixtures>({
  seedMockSession: [true, { option: true }],
  mockApi: async ({ page, seedMockSession }, use, testInfo: TestInfo) => {
    const api = createMockApi()
    const browserErrors: string[] = []
    page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()) })
    page.on('pageerror', (error) => browserErrors.push(`Page error: ${error.message}`))
    if (seedMockSession) {
      await page.addInitScript(() => {
        window.localStorage.setItem('closet-test-access-token', 'e2e-local-only')
      })
    }
    await installMockRoutes(page, api)
    await use(api)
    if (testInfo.status !== testInfo.expectedStatus || browserErrors.length || api.unexpectedRequests.length) {
      await testInfo.attach('browser-and-network-errors', {
        body: [
          ...browserErrors,
          ...api.unexpectedRequests,
          `GraphQL operations: ${api.operations.join(', ')}`,
        ].join('\n') || 'No browser errors captured',
        contentType: 'text/plain',
      })
    }
    expect(api.unexpectedRequests, 'Unexpected network requests or missing GraphQL mocks').toEqual([])
    expect(browserErrors, 'Browser console or page errors').toEqual([])
  },
})

export { expect }
