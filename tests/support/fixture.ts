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
  generations: Array<{ status: string; imageAsset: { deliveryUrl: string | null } | null }>
}

type PlannerEntry = {
  date: string
  title: string | null
  occasion: string | null
  weatherSummary: string | null
  temperatureC: number | null
  outfit: {
    id: string
    name: string
    style: string
    plannerOnly: boolean
    items: Array<{ wardrobeItemId: string }>
    generations: Outfit['generations']
  } | null
}

type GraphqlRequest = { query: string; variables?: Record<string, any> }
type MockApi = {
  wardrobeItems: WardrobeItem[]
  outfits: Outfit[]
  plannerEntries: PlannerEntry[]
  operations: string[]
  uploadKinds: string[]
  classificationFailureMessage: string | null
  cutoutFailureMessage: string | null
  unexpectedRequests: string[]
}

/** Each test receives its own in-memory catalog. Reloads reuse it; other tests cannot see its mutations. */
export function createWardrobeItem(overrides: Partial<WardrobeItem> = {}): WardrobeItem {
  return {
    id: 'item-1', name: '테스트 셔츠', brandName: null,
    createdAt: '2026-01-10T00:00:00.000Z',
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
    operations: [],
    uploadKinds: [],
    classificationFailureMessage: null,
    cutoutFailureMessage: null,
    unexpectedRequests: [],
  }
}

function filterWardrobe(items: WardrobeItem[], input: Record<string, any> = {}) {
  const search = String(input.search ?? '').trim().toLocaleLowerCase()
  return items.filter((item) => {
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

function handleGraphql(api: MockApi, { query, variables = {} }: GraphqlRequest): Record<string, unknown> {
  const operation = query.match(/\b(?:query|mutation)\s+(\w+)/)?.[1] ?? 'unknown'
  api.operations.push(operation)
  const input = variables.input ?? {}

  switch (operation) {
    case 'WardrobePage': {
      const items = filterWardrobe(api.wardrobeItems, input)
      return { wardrobePage: { items, totalCount: items.length, hasNextPage: false, nextCursor: null } }
    }
    case 'WardrobeFilterOptions': {
      const items = filterWardrobe(api.wardrobeItems, { category: variables.category, subcategory: variables.subcategory })
      return { wardrobeFilterOptions: {
        totalCount: api.wardrobeItems.length,
        categories: [...new Set(api.wardrobeItems.flatMap((item) => [item.category, ...item.additionalCategories]).filter(Boolean))],
        subcategories: [...new Set(items.map((item) => item.subcategory).filter(Boolean))],
        tags: [...new Set(items.flatMap((item) => item.tags))],
        colors: [...new Map(items.map((item) => [item.colorName, { name: item.colorName, hex: item.colorHex }])).values()],
      } }
    }
    case 'WardrobeItems': return { wardrobeItems: api.wardrobeItems }
    case 'WardrobeItem': return { wardrobeItem: api.wardrobeItems.find((item) => item.id === variables.id) ?? null }
    case 'WardrobeBrandOptions': return { wardrobeBrandOptions: [...new Set(api.wardrobeItems.map((item) => item.brandName).filter(Boolean))] }
    case 'Outfits': return { outfits: filterOutfits(api, variables).map((outfit) => withWardrobeItems(api, outfit)) }
    case 'OutfitPage': {
      const outfits = filterOutfits(api, input)
      return { outfitPage: { items: outfits.map((outfit) => withWardrobeItems(api, outfit)), totalCount: outfits.length, hasNextPage: false, nextCursor: null } }
    }
    case 'OutfitFilterOptions': return { outfitFilterOptions: {
      totalCount: api.outfits.length,
      styles: [...new Set(api.outfits.map((outfit) => outfit.style))],
      colors: [...new Map(api.wardrobeItems.map((item) => [item.colorName, { name: item.colorName, hex: item.colorHex }])).values()],
    } }
    case 'OutfitWearHistory': return { outfitWearHistory: [] }
    case 'PlannerWeek': return { plannerWeek: {
      id: `week-${variables.weekStartsOn}`,
      weekStartsOn: variables.weekStartsOn,
      entries: api.plannerEntries.filter((entry) => entry.date >= variables.weekStartsOn && entry.date < new Date(new Date(`${variables.weekStartsOn}T00:00:00Z`).getTime() + 7 * 86_400_000).toISOString().slice(0, 10)),
    } }
    case 'PlannerEntries': return { plannerEntries: api.plannerEntries.filter((entry) => entry.date >= variables.from && entry.date <= variables.to) }
    case 'SetPlannerEntry': {
      const outfit = api.outfits.find((candidate) => candidate.id === input.outfitId)
      if (!outfit) throw new Error(`Unknown outfit: ${input.outfitId}`)
      api.plannerEntries = api.plannerEntries.filter((entry) => entry.date !== input.date)
      api.plannerEntries.push({
        date: input.date,
        title: input.title ?? outfit.name,
        occasion: input.occasion ?? null,
        weatherSummary: null,
        temperatureC: null,
        outfit: {
          id: outfit.id, name: outfit.name, style: outfit.style,
          plannerOnly: false,
          items: outfit.items.map((item) => ({ wardrobeItemId: item.wardrobeItemId })),
          generations: outfit.generations,
        },
      })
      return { setPlannerEntry: { id: `planner-${input.date}` } }
    }
    case 'ClearPlannerEntry': {
      api.plannerEntries = api.plannerEntries.filter((entry) => entry.date !== variables.date)
      return { clearPlannerEntry: { id: `planner-${variables.date}` } }
    }
    case 'Me': return { me: {
      id: 'e2e-user', displayName: 'E2E 사용자', email: null, isTemporary: true,
      styleProfile: { gender: null, bodyBuild: null, heightCm: null, weightKg: null, chestCircumferenceCm: null, waistCircumferenceCm: null, hipCircumferenceCm: null, shoulderWidthCm: null, inseamCm: null, preferredFit: 'regular', preferredStyles: [] },
      wearReminderPreferences: { enabled: false, intervalDays: 7, combinationReminderEnabled: false, itemReminderEnabled: false },
    } }
    case 'UpdateWardrobeItem': {
      const index = api.wardrobeItems.findIndex((item) => item.id === variables.id)
      if (index < 0) throw new Error(`Unknown wardrobe item: ${variables.id}`)
      api.wardrobeItems[index] = { ...api.wardrobeItems[index], ...input }
      return { updateWardrobeItem: api.wardrobeItems[index] }
    }
    case 'ArchiveWardrobeItem': {
      api.wardrobeItems = api.wardrobeItems.filter((item) => item.id !== variables.id)
      return { archiveWardrobeItem: { id: variables.id } }
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
      api.outfits[index] = { ...api.outfits[index], ...input }
      return { updateOutfit: withWardrobeItems(api, api.outfits[index]) }
    }
    case 'DeleteOutfit': {
      api.outfits = api.outfits.filter((outfit) => outfit.id !== variables.id)
      return { deleteOutfit: true }
    }
    case 'CreateOutfit': {
      const outfit = createOutfit({ ...input, id: `outfit-${api.outfits.length + 1}`, createdAt: new Date().toISOString() })
      api.outfits = [outfit, ...api.outfits]
      return { createOutfit: outfit }
    }
    default:
      api.unexpectedRequests.push(`Unhandled GraphQL operation: ${operation}`)
      throw new Error(`Unhandled GraphQL operation: ${operation}`)
  }
}

async function installMockRoutes(page: Page, api: MockApi) {
  await page.addInitScript(() => {
    window.localStorage.setItem('closet-test-access-token', 'e2e-local-only')
  })

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
        await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ errors: [{ message: String(error) }] }) })
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

type Fixtures = { mockApi: MockApi }

export const test = base.extend<Fixtures>({
  mockApi: async ({ page }, use, testInfo: TestInfo) => {
    const api = createMockApi()
    const browserErrors: string[] = []
    page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()) })
    page.on('pageerror', (error) => browserErrors.push(`Page error: ${error.message}`))
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
