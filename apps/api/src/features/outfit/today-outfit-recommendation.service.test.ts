import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import type { ClothingCategory } from '@prisma/client'
import { ServiceError } from '../../graphql/errors.js'
import { userRepository } from '../user/user.repository.js'
import { wardrobeRepository } from '../wardrobe/wardrobe.repository.js'
import { outfitRecommendationService } from './outfit-recommendation.service.js'
import { todayOutfitRecommendationService } from './today-outfit-recommendation.service.js'

type WardrobeItem = Awaited<ReturnType<typeof wardrobeRepository.findMany>>[number]

const userId = 'viewer'
const input = { date: '2026-08-28', season: 'autumn' as const }

function createItem(
  id: string,
  category: ClothingCategory,
  overrides: Partial<WardrobeItem> = {},
): WardrobeItem {
  return {
    id,
    userId,
    name: id,
    brandName: null,
    category,
    additionalCategories: [],
    subcategory: null,
    colorName: '블랙',
    colorDetailName: '블랙',
    colorHex: '#242424',
    colorMode: 'solid',
    fashionAttributes: null,
    seasons: ['autumn'],
    tags: [],
    sizeLabel: null,
    shoulderWidthCm: null,
    chestWidthCm: null,
    sleeveLengthCm: null,
    totalLengthCm: null,
    waistWidthCm: null,
    hipWidthCm: null,
    inseamCm: null,
    thighWidthCm: null,
    riseCm: null,
    hemWidthCm: null,
    classificationStatus: 'classified',
    classificationConfidence: 0.9,
    classificationModel: null,
    classificationCandidates: null,
    wearCount: 0,
    lastWornAt: null,
    archivedAt: null,
    displayImageAssetId: null,
    originalImageAssetId: null,
    displayImageAsset: null,
    originalImageAsset: null,
    createdAt: new Date('2026-08-28'),
    updatedAt: new Date('2026-08-28'),
    ...overrides,
  }
}

function setupWardrobe(t: TestContext, items: WardrobeItem[]) {
  t.mock.method(userRepository, 'findViewerById', async () => null)
  t.mock.method(wardrobeRepository, 'findMany', async (requestedUserId: string) => {
    assert.equal(requestedUserId, userId)
    return items
  })
  const previousKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = ''
  t.after(() => {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previousKey
  })
}

test('재추천과 직전 아우터 제외에도 기준 아우터를 유지하며 나머지 옷을 바꾼다', async (t) => {
  const baseItem = createItem('base-outer', 'outer')
  setupWardrobe(t, [
    baseItem,
    createItem('previous-outer', 'outer'),
    createItem('top-a', 'top'),
    createItem('top-b', 'top'),
    createItem('bottom-a', 'bottom'),
    createItem('bottom-b', 'bottom'),
    createItem('shoes-a', 'shoes'),
    createItem('shoes-b', 'shoes'),
  ])
  const selectedCombinations = new Set<string>()

  for (let variation = 0; variation <= 20; variation += 1) {
    const result = await todayOutfitRecommendationService.recommend(userId, {
      ...input,
      baseItemId: baseItem.id,
      variation,
      excludedOuterItemIds: [baseItem.id, 'previous-outer'],
    })
    assert.equal(result.ready, true)
    assert.equal(result.source, 'fallback')
    assert.ok(result.items.some((item) => item.id === baseItem.id))
    assert.ok(result.items.every((item) => item.id !== 'previous-outer'))
    selectedCombinations.add(result.items.map((item) => item.id).sort().join(':'))
  }

  assert.ok(selectedCombinations.size > 1)
})

test('존재하지 않거나 내 활성 분류 아이템이 아닌 기준은 거절한다', async (t) => {
  const invalidCases: Array<{ name: string; item?: WardrobeItem; baseItemId?: string }> = [
    { name: '존재하지 않는 아이템' },
    { name: '빈 아이템 ID', baseItemId: '' },
    { name: '다른 사용자 아이템', item: createItem('base', 'top', { userId: 'another-viewer' }) },
    { name: '삭제된 아이템', item: createItem('base', 'top', { archivedAt: new Date('2026-08-28') }) },
    { name: '분류 중인 아이템', item: createItem('base', 'top', { classificationStatus: 'pending' }) },
    { name: '분류 실패 아이템', item: createItem('base', 'top', { classificationStatus: 'failed' }) },
    { name: '카테고리 없는 아이템', item: createItem('base', 'top', { category: null }) },
    { name: '기타 아이템', item: createItem('base', 'other') },
  ]

  for (const invalid of invalidCases) {
    await t.test(invalid.name, async (t) => {
      setupWardrobe(t, [createItem('dress', 'dress'), ...(invalid.item ? [invalid.item] : [])])
      await assert.rejects(
        todayOutfitRecommendationService.recommend(userId, {
          ...input,
          baseItemId: invalid.baseItemId ?? 'base',
        }),
        (error: unknown) => error instanceof ServiceError && error.code === 'INVALID_OUTFIT_RECOMMENDATION',
      )
    })
  }
})

test('기준 옷의 계절이 맞지 않으면 기준을 빼고 다른 코디를 반환하지 않는다', async (t) => {
  const baseItem = createItem('겨울 코트', 'outer', { seasons: ['winter'] })
  setupWardrobe(t, [baseItem, createItem('top', 'top'), createItem('bottom', 'bottom')])
  const result = await todayOutfitRecommendationService.recommend(userId, {
    ...input,
    baseItemId: baseItem.id,
  })

  assert.equal(result.ready, false)
  assert.deepEqual(result.items, [])
  assert.match(result.summary, /가을 계절 정보가 등록되어 있지 않아요/)
})

test('기준 옷과 조합할 수 없으면 다른 완성 코디가 있어도 준비되지 않은 결과를 반환한다', async (t) => {
  const baseItem = createItem('base-bottom', 'bottom')
  setupWardrobe(t, [baseItem, createItem('dress', 'dress')])
  const result = await todayOutfitRecommendationService.recommend(userId, {
    ...input,
    baseItemId: baseItem.id,
  })

  assert.equal(result.ready, false)
  assert.deepEqual(result.items, [])
  assert.match(result.summary, /코디를 완성할 옷이 부족해요/)
})

test('AI 설명에 기준 아이템을 전달하고 응답에도 같은 기준 옷을 유지한다', async (t) => {
  const baseItem = createItem('base-outer', 'outer')
  setupWardrobe(t, [baseItem, createItem('top', 'top'), createItem('bottom', 'bottom')])
  process.env.OPENAI_API_KEY = 'test-key'
  let prompt: { baseItemId: string; outfit: { items: Array<{ id: string }> } } | undefined
  t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
    const body = JSON.parse(String(options.body)) as { input: Array<{ role: string; content: string }> }
    const userMessage = body.input.find((message) => message.role === 'user')
    assert.ok(userMessage)
    prompt = JSON.parse(userMessage.content)
    return new Response(JSON.stringify({
      output_text: JSON.stringify({
        headline: '선택한 재킷 중심 코디',
        summary: '재킷의 색에 맞춰 이너와 하의를 골랐어요.',
        reasons: ['재킷과 이너의 실루엣을 맞췄어요.'],
      }),
    }), { status: 200 })
  })
  const result = await todayOutfitRecommendationService.recommend(userId, {
    ...input,
    baseItemId: baseItem.id,
  })

  assert.equal(prompt?.baseItemId, baseItem.id)
  assert.ok(prompt?.outfit.items.some((item) => item.id === baseItem.id))
  assert.equal(result.source, 'ai')
  assert.equal(result.headline, '선택한 재킷 중심 코디')
  assert.equal(result.summary, '재킷의 색에 맞춰 이너와 하의를 골랐어요.')
  assert.deepEqual(result.reasons, ['재킷과 이너의 실루엣을 맞췄어요.'])
  assert.ok(result.items.some((item) => item.id === baseItem.id))
})

test('AI 설명에 코드·반복 기호·과도한 길이가 있으면 옷 구성은 유지하고 설명만 대체한다', async (t) => {
  setupWardrobe(t, [createItem('top', 'top'), createItem('bottom', 'bottom')])
  process.env.OPENAI_API_KEY = 'test-key'
  const invalidReasons = [
    '기본 핏을 연결해요. 」java.lang.String;}}}}}}}}',
    '기본 핏을 연결해요. }}}}}}}}',
    '색'.repeat(161),
  ]
  let reason = invalidReasons[0]
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    output_text: JSON.stringify({
      headline: '차분한 옷장 조합',
      summary: '상하의 색을 연결했어요.',
      reasons: [reason],
    }),
  }), { status: 200 }))

  for (reason of invalidReasons) {
    const result = await todayOutfitRecommendationService.recommend(userId, input)
    assert.equal(result.source, 'fallback')
    assert.equal(result.ready, true)
    assert.deepEqual(result.items.map((item) => item.id).sort(), ['bottom', 'top'])
    assert.ok(result.reasons.length > 0)
    assert.doesNotMatch(result.reasons.join(' '), /java\.lang|\}{6,}/u)
  }
})

test('기준을 지정하지 않은 기존 추천은 null 입력과 동일하게 동작한다', async (t) => {
  setupWardrobe(t, [createItem('top', 'top'), createItem('bottom', 'bottom')])
  const original = await todayOutfitRecommendationService.recommend(userId, input)
  const withoutBase = await todayOutfitRecommendationService.recommend(userId, {
    ...input,
    baseItemId: null,
  })

  assert.equal(original.ready, true)
  assert.equal(original.headline, '오늘은 이 조합으로 입어보세요')
  assert.deepEqual(withoutBase, original)
})

test('현재 위치 날씨를 추천 결과에 유지한다', async (t) => {
  setupWardrobe(t, [createItem('top', 'top'), createItem('bottom', 'bottom')])
  const weather = {
    date: input.date,
    temperatureC: 18.3,
    minTemperatureC: 14,
    maxTemperatureC: 21,
    apparentTemperatureC: 17.5,
    precipitationProbability: 20,
    weatherCode: 2,
    summary: '클라이언트 문구는 서버에서 다시 정리',
    recommendedSeason: 'winter' as const,
    source: 'open-meteo' as const,
    attribution: '변조된 출처',
    attributionUrl: 'https://example.com',
  }

  const result = await todayOutfitRecommendationService.recommend(userId, {
    ...input,
    weather,
  })

  assert.equal(result.weather?.summary, '구름 조금')
  assert.equal(result.weather?.recommendedSeason, 'summer')
  assert.equal(result.weather?.attributionUrl, 'https://open-meteo.com/')
})

test('체감 23도인 현재 날씨 추천에는 자동으로 아우터를 추가하지 않는다', async (t) => {
  setupWardrobe(t, [
    createItem('top', 'top'),
    createItem('bottom', 'bottom'),
    createItem('outer', 'outer'),
  ])

  const result = await todayOutfitRecommendationService.recommend(userId, {
    ...input,
    weather: {
      date: input.date,
      temperatureC: 24,
      minTemperatureC: 19,
      maxTemperatureC: 27,
      apparentTemperatureC: 23,
      precipitationProbability: 10,
      weatherCode: 1,
      summary: '대체로 맑음',
      recommendedSeason: 'autumn',
      source: 'open-meteo',
      attribution: 'Weather data by Open-Meteo.com',
      attributionUrl: 'https://open-meteo.com/',
    },
  })

  assert.equal(result.ready, true)
  assert.ok(result.items.every((item) => item.id !== 'outer'))
})

test('추천 날짜와 다른 날씨 정보는 거절한다', async () => {
  await assert.rejects(
    todayOutfitRecommendationService.recommend(userId, {
      ...input,
      weather: {
        date: '2026-08-27',
        temperatureC: 18,
        minTemperatureC: 14,
        maxTemperatureC: 21,
        apparentTemperatureC: 17,
        precipitationProbability: 20,
        weatherCode: 2,
        summary: '구름 조금',
        recommendedSeason: 'autumn',
        source: 'open-meteo',
        attribution: 'Weather data by Open-Meteo.com',
        attributionUrl: 'https://open-meteo.com/',
      },
    }),
    (error: unknown) =>
      error instanceof ServiceError && error.code === 'INVALID_WEATHER_SNAPSHOT',
  )
})


test('이전 스타일 입력과 저장된 취향을 읽지 않고 같은 옷장 조합을 반환한다', async (t) => {
  setupWardrobe(t, [createItem('plain-shirt', 'top', { subcategory: '셔츠' }), createItem('plain-slacks', 'bottom', { subcategory: '슬랙스' })])
  const profileRead = t.mock.method(userRepository, 'findViewerById', async () => {
    throw new Error('추천은 저장된 스타일과 선호 핏을 읽지 않아야 한다')
  })
  const ordinary = await todayOutfitRecommendationService.recommend(userId, input)
  for (const style of ['vintage', 'sporty', 'street'] as const) {
    assert.deepEqual(await todayOutfitRecommendationService.recommend(userId, { ...input, style }), ordinary)
  }
  assert.equal(profileRead.mock.callCount(), 0)
  assert.equal(ordinary.style, null)
  assert.deepEqual(ordinary.profileSummary, [])
  assert.ok(ordinary.reasons.length > 0)
  assert.doesNotMatch(ordinary.summary + ordinary.reasons.join(' '), /빈티지|스포티|캐주얼|선호/)
})

test('AI 설명에는 목표 스타일과 선호 핏 없이 선택된 옷의 관찰 속성만 전달한다', async (t) => {
  setupWardrobe(t, [createItem('top', 'top'), createItem('bottom', 'bottom')])
  process.env.OPENAI_API_KEY = 'test-key'
  t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
    const body = JSON.parse(String(options.body)) as { input: Array<{ role: string; content: string }> }
    const userMessage = body.input.find((message) => message.role === 'user')!
    const prompt = JSON.parse(userMessage.content)
    assert.equal(prompt.targetStyle, undefined)
    assert.equal(prompt.styleGuide, undefined)
    assert.equal(prompt.profile, undefined)
    assert.equal(prompt.outfit.items.length, 2)
    assert.ok(prompt.outfit.items[0].관찰속성)
    return new Response(JSON.stringify({ output_text: JSON.stringify({ headline: '옷장 조합', summary: '두 옷의 색을 연결했어요.', reasons: ['기본 구성을 맞췄어요.'] }) }), { status: 200 })
  })
  const result = await todayOutfitRecommendationService.recommend(userId, input)
  assert.equal(result.source, 'ai')
  assert.equal(result.style, null)
})


test('수동 매칭의 색상 추천은 고른 옷 전체를 전달하며 선호 스타일·핏을 조회하지 않는다', async (t) => {
  const selected = [createItem('top', 'top'), createItem('outer', 'outer')]
  setupWardrobe(t, [createItem('bottom', 'bottom')])
  t.mock.method(wardrobeRepository, 'findManyOwnedByIds', async () => selected)
  const profileRead = t.mock.method(userRepository, 'findViewerById', async () => {
    throw new Error('색상 추천은 스타일 프로필을 읽지 않아야 한다')
  })
  process.env.OPENAI_API_KEY = 'test-key'
  t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
    const body = JSON.parse(String(options.body)) as { input: Array<{ role: string; content: string }> }
    const prompt = JSON.parse(body.input.find((message) => message.role === 'user')!.content)
    assert.deepEqual(prompt.selectedItems.map((item: { id: string }) => item.id), ['top', 'outer'])
    assert.equal(prompt.targetCategory, 'bottom')
    assert.equal(prompt.styleProfile, undefined)
    return new Response(JSON.stringify({ output_text: JSON.stringify({
      headline: '고른 옷에 맞는 하의 색', summary: '두 옷의 대표색을 함께 비교했어요.',
      recommendedColors: [
        { name: '화이트', role: 'safe', reason: '색 대비를 만들어요.' },
        { name: '그레이', role: 'harmony', reason: '차분하게 연결해요.' },
        { name: '레드', role: 'accent', reason: '포인트를 더해요.' },
      ], candidates: [],
    }) }), { status: 200 })
  })
  const result = await outfitRecommendationService.recommend(userId, { selectedItemIds: ['top', 'outer'], targetCategory: 'bottom' })
  assert.equal(profileRead.mock.callCount(), 0)
  assert.equal(result.source, 'ai')
  assert.equal(result.recommendedColors.length, 3)
  assert.ok(result.candidates.every((candidate) => candidate.item.id === 'bottom'))
})
