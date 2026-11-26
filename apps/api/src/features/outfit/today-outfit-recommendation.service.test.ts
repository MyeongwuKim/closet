import { recommendationCreditRepository } from '../preview-credits/recommendation-credit.repository.js'
import { aiExecutor, createAiExecutor } from '../../lib/ai/ai-execution.js'
import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import type { ClothingCategory } from '@prisma/client'
import { ServiceError } from '../../graphql/errors.js'
import { userRepository } from '../user/user.repository.js'
import { wardrobeRepository } from '../wardrobe/wardrobe.repository.js'
import { outfitRecommendationService } from './outfit-recommendation.service.js'
import { todayOutfitRecommendationService } from './today-outfit-recommendation.service.js'
import { thermalRecommendationRepository } from './thermal-recommendation.repository.js'
import { getThermalRecommendationContext } from './thermal-recommendation.service.js'

type WardrobeItem = Awaited<ReturnType<typeof wardrobeRepository.findMany>>[number]

const userId = 'viewer'
const input = { date: '2026-08-28', season: 'autumn' as const }

test('전날과 같은 핵심 구성은 신발이 달라도 제외하고 기준 아우터는 유지한다', async (t) => {
  const items = [
    createItem('outer', 'outer'),
    createItem('top-a', 'top'),
    createItem('top-b', 'top'),
    createItem('bottom', 'bottom'),
    createItem('shoe-a', 'shoes'),
    createItem('shoe-b', 'shoes'),
  ]
  setupWardrobe(t, items)
  const requested = { ...input, baseItemId: 'outer', previousDayOutfitItemIds: [['top-a', 'outer', 'bottom']] }
  for (const variation of [0, 1, 10]) {
    const result = await todayOutfitRecommendationService.recommend(userId, { ...requested, variation })
    assert.equal(result.ready, true)
    assert.ok(result.items.some((item) => item.id === 'top-b'))
    assert.ok(result.items.some((item) => item.id === 'outer'))
  }

  const reserve = t.mock.method(recommendationCreditRepository, 'reserve', async () => { throw new Error('빈 결과에는 사용권을 예약하지 않는다') })
  const empty = await todayOutfitRecommendationService.recommend(userId, {
    ...requested,
    previousDayOutfitItemIds: [...requested.previousDayOutfitItemIds, ['top-b', 'bottom', 'outer']],
  })
  assert.equal(empty.ready, false)
  assert.equal(empty.headline, '전날과 다른 코디를 찾지 못했어요')
  assert.equal(reserve.mock.callCount(), 0)
})

test('같은 날짜에 본 조합도 전날 조합과 함께 제외하고 후보를 모두 봤으면 사용권을 예약하지 않는다', async (t) => {
  setupWardrobe(t, [
    createItem('outer', 'outer'), createItem('bottom', 'bottom'),
    ...['top-a', 'top-b', 'top-c'].map((id) => createItem(id, 'top')),
    createItem('shoes', 'shoes'),
  ])
  const requested = {
    ...input, baseItemId: 'outer',
    previousDayOutfitItemIds: [['top-a', 'outer', 'bottom']],
    seenOutfitItemIds: [['top-b', 'bottom', 'outer']],
  }
  const result = await todayOutfitRecommendationService.recommend(userId, requested)
  assert.equal(result.ready, true)
  assert.deepEqual(result.items.map((item) => item.id).sort(), ['bottom', 'outer', 'shoes', 'top-c'])
  const reserve = t.mock.method(recommendationCreditRepository, 'reserve', async () => { throw new Error('빈 결과에는 사용권을 예약하지 않는다') })
  const empty = await todayOutfitRecommendationService.recommend(userId, {
    ...requested, seenOutfitItemIds: [...requested.seenOutfitItemIds, ['outer', 'top-c', 'bottom']],
  })
  assert.equal(empty.ready, false)
  assert.equal('seenOutfitsOnly' in empty && empty.seenOutfitsOnly, true)
  assert.equal(reserve.mock.callCount(), 0)
})

test('기준 코트의 톤온톤 재추천은 본 조합과 최근 신발을 피하면서 색 조건을 우선한다', async (t) => {
  setupWardrobe(t, [
    createItem('coat', 'outer'),
    createItem('top-a', 'top', { colorName: '블루', colorHex: '#254F82' }),
    createItem('top-b', 'top', { colorName: '블루', colorHex: '#2B568C' }),
    createItem('denim', 'bottom', { colorName: '블루', colorHex: '#85AEDA' }),
    createItem('derby', 'shoes'),
    createItem('sneaker', 'shoes', { colorName: '화이트', colorHex: '#EFEFEF' }),
    createItem('red-boot', 'shoes', { colorName: '레드', colorHex: '#BD352D' }),
  ])
  const requested = {
    ...input, baseItemId: 'coat', colorScheme: 'tone-on-tone',
    seenOutfitItemIds: [['coat', 'top-a', 'denim']],
    recentShoeItemIds: ['derby'],
  }
  const fresh = await todayOutfitRecommendationService.recommend(userId, requested)
  assert.equal(fresh.colorSchemeApplied, true)
  assert.deepEqual(fresh.items.map(({ id }) => id).sort(), ['coat', 'denim', 'sneaker', 'top-b'])
  const rotated = await todayOutfitRecommendationService.recommend(userId, {
    ...requested, recentShoeItemIds: ['sneaker', 'derby'],
  })
  assert.equal(rotated.colorSchemeApplied, true)
  assert.deepEqual(rotated.items.map(({ id }) => id).sort(), ['coat', 'denim', 'derby', 'top-b'])
  const exhausted = await todayOutfitRecommendationService.recommend(userId, {
    ...requested, seenOutfitItemIds: [...requested.seenOutfitItemIds, ['coat', 'top-b', 'denim']],
  })
  assert.equal(exhausted.ready, false)
  assert.equal('seenOutfitsOnly' in exhausted && exhausted.seenOutfitsOnly, true)
})

test('기준 코트 톤인톤은 아직 덜 나온 상하의를 고르고 톤인톤을 다 보면 사용권을 더 쓰지 않는다', async (t) => {
  setupWardrobe(t, [
    createItem('coat', 'outer', { colorHex: '#322E31' }),
    createItem('navy', 'top', { colorHex: '#202D45' }),
    createItem('blue', 'top', { colorHex: '#32445F' }),
    createItem('olive', 'bottom', { colorHex: '#47482B' }),
    createItem('forest', 'bottom', { colorHex: '#374A37' }),
    createItem('gray', 'bottom', { colorHex: '#2B3531' }),
  ])
  const requested = { ...input, colorScheme: 'tone-in-tone', baseItemId: 'coat' }
  const firstSeen = ['coat', 'navy', 'olive']
  const retry = await todayOutfitRecommendationService.recommend(userId, { ...requested, seenOutfitItemIds: [firstSeen] })
  assert.equal(retry.colorSchemeApplied, true)
  assert.deepEqual(retry.items.map(({ id }) => id).sort(), ['blue', 'coat', 'forest'])
  assert.ok(retry.reasons.some((reason) => reason.includes('blue') && reason.includes('forest')))
  const reserve = t.mock.method(recommendationCreditRepository, 'reserve', async () => { throw new Error('빈 결과는 사용권을 예약하지 않는다') })
  const allSeen = [firstSeen, ['coat', 'navy', 'forest'], ['coat', 'blue', 'olive'], ['coat', 'blue', 'forest']]
  const exhausted = await todayOutfitRecommendationService.recommend(userId, { ...requested, seenOutfitItemIds: allSeen })
  assert.equal(exhausted.ready, false)
  assert.equal(exhausted.headline, '톤인톤으로 맞춘 새 코디가 없어요')
  assert.equal(reserve.mock.callCount(), 0)
})

function createItem(
  id: string,
  category: ClothingCategory,
  overrides: Partial<WardrobeItem> = {},
): WardrobeItem {
  return {
    id,
    userId,
    name: id,
    brandName: null, storageLocation: null, registrationRequestId: null, wearAvoidanceReason: null, recommendationResumeOn: null,
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
  t.mock.method(recommendationCreditRepository, 'reserve', async () => ({ id: 'credit-test', token: 'token', resultText: null }))
  t.mock.method(recommendationCreditRepository, 'settle', async () => true)
  t.mock.method(aiExecutor, 'run', createAiExecutor().run)
  t.mock.method(userRepository, 'findViewerById', async () => null)
  const wardrobeLookup = t.mock.method(wardrobeRepository, 'findMany', async (requestedUserId: string) => {
    assert.equal(requestedUserId, userId)
    return items
  })
  const previousKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = ''
  t.after(() => {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previousKey
  })
  return wardrobeLookup
}

test('보류한 옷은 자동 추천에서 제외하고 재개 날짜와 직접 고른 기준 옷은 허용한다', async (t) => {
  setupWardrobe(t, [createItem('top', 'top', { wearAvoidanceReason: 'temporarily_unused', recommendationResumeOn: '2026-08-29' }), createItem('pants', 'bottom')])
  assert.equal((await todayOutfitRecommendationService.recommend(userId, input)).ready, false)
  assert.equal((await todayOutfitRecommendationService.recommend(userId, { ...input, date: '2026-08-29' })).ready, true)
  const explicit = await todayOutfitRecommendationService.recommend(userId, { ...input, baseItemId: 'top' })
  assert.equal(explicit.ready, true)
  assert.ok(explicit.items.some((item) => item.id === 'top'))
})

test('선택 옷의 스타일 추천도 보류한 후보를 제외한다', async (t) => {
  const top = createItem('top', 'top')
  setupWardrobe(t, [createItem('paused', 'bottom', { wearAvoidanceReason: 'fit_issue' }), createItem('ready', 'bottom')])
  t.mock.method(wardrobeRepository, 'findManyOwnedByIds', async () => [top])
  const result = await outfitRecommendationService.recommend(userId, { selectedItemIds: ['top'], targetCategory: 'bottom' })
  assert.ok(result.candidates.every((candidate) => candidate.item.id !== 'paused'))
  assert.ok(result.candidates.some((candidate) => candidate.item.id === 'ready'))
})

test('개인 체감은 일평균으로 비교하고 실제 현재·체감 기온과 기준 옷을 유지한다', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-08-28T03:00:00Z') })
  setupWardrobe(t, [createItem('base', 'top', { seasons: ['spring'] }), createItem('pants', 'bottom', { seasons: ['spring'] })])
  const history = t.mock.method(thermalRecommendationRepository, 'findHistory', async (owner: string, _target: Date, _today: Date, mean: number) => {
    assert.equal(owner, userId)
    assert.equal(mean, 18)
    return [{ id: 'wear-1', date: new Date('2026-08-27'), wornAt: new Date('2026-08-27T04:00:00Z'), wearFeeling: 'cold' as const, wearTemperatureC: 18 }]
  })
  const weather = { date: input.date, temperatureC: 21, meanTemperatureC: 18, minTemperatureC: 14, maxTemperatureC: 23, apparentTemperatureC: 20, precipitationProbability: 0, weatherCode: 0, summary: '맑음', recommendedSeason: 'spring' as const, source: 'open-meteo' as const, attribution: 'Open-Meteo', attributionUrl: 'https://open-meteo.com/' }
  const result = await todayOutfitRecommendationService.recommend(userId, { ...input, season: 'spring', baseItemId: 'base', weather })
  assert.equal(history.mock.callCount(), 1)
  assert.equal(result.thermalContext?.direction, 'warmer')
  assert.equal(result.weather?.temperatureC, 21)
  assert.equal(result.weather?.apparentTemperatureC, 20)
  assert.equal(result.weather?.meanTemperatureC, 18)
  assert.ok(result.items.some((entry) => entry.id === 'base'))
  assert.ok(result.reasons.some((reason) => reason.includes('체감 기록')))
})

test('체감 근거가 바뀐 오래된 요청은 사용권 예약 전에 거절하고 기온 없는 추천은 이력을 읽지 않는다', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-08-28T03:00:00Z') })
  setupWardrobe(t, [createItem('top', 'top'), createItem('bottom', 'bottom')])
  const history = t.mock.method(thermalRecommendationRepository, 'findHistory', async () => [])
  const reserve = t.mock.method(recommendationCreditRepository, 'reserve', async () => { throw new Error('stale request must not reserve credits') })
  const weather = { date: input.date, temperatureC: 18, meanTemperatureC: 18, minTemperatureC: 14, maxTemperatureC: 23, apparentTemperatureC: 18, precipitationProbability: 0, weatherCode: 0, summary: '맑음', recommendedSeason: 'autumn' as const, source: 'open-meteo' as const, attribution: 'Open-Meteo', attributionUrl: 'https://open-meteo.com/' }
  await assert.rejects(todayOutfitRecommendationService.recommend(userId, { ...input, weather, thermalContextRevision: 'outdated' }), { code: 'THERMAL_CONTEXT_CHANGED' })
  assert.equal(reserve.mock.callCount(), 0)
  history.mock.resetCalls()
  const context = await getThermalRecommendationContext(userId, input.date)
  assert.equal(context.direction, 'neutral')
  assert.equal(history.mock.callCount(), 0)
})

test('옷과 날씨가 같아도 체감 기록이 바뀌면 이전 추천 설명 캐시를 재사용하지 않는다', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-08-28T03:00:00Z') })
  setupWardrobe(t, [createItem('top', 'top', { seasons: ['spring'] }), createItem('bottom', 'bottom', { seasons: ['spring'] })])
  let feeling: 'cold' | 'hot' = 'cold'
  t.mock.method(thermalRecommendationRepository, 'findHistory', async () => [
    { id: 'wear', date: new Date('2026-08-27'), wornAt: new Date('2026-08-27T04:00:00Z'), wearFeeling: feeling, wearTemperatureC: 18 },
  ])
  const reservations: Array<{ thermalContextRevision?: string }> = []
  t.mock.method(recommendationCreditRepository, 'reserve', async (_owner: string, key: { thermalContextRevision?: string }) => {
    reservations.push(key)
    return { id: 'test-credit', token: 'test', resultText: null }
  })
  const weather = { date: input.date, temperatureC: 21, meanTemperatureC: 18, minTemperatureC: 14, maxTemperatureC: 23, apparentTemperatureC: 20, precipitationProbability: 0, weatherCode: 0, summary: '맑음', recommendedSeason: 'spring' as const, source: 'open-meteo' as const, attribution: 'Open-Meteo', attributionUrl: 'https://open-meteo.com/' }
  const first = await todayOutfitRecommendationService.recommend(userId, { ...input, season: 'spring', weather })
  feeling = 'hot'
  const second = await todayOutfitRecommendationService.recommend(userId, { ...input, season: 'spring', weather })
  assert.equal(first.thermalContext?.direction, 'warmer')
  assert.equal(second.thermalContext?.direction, 'cooler')
  assert.equal(reservations.length, 2)
  assert.notEqual(reservations[0].thermalContextRevision, reservations[1].thermalContextRevision)
  assert.ok(second.reasons.some((reason) => reason.includes('가볍게')))
})

/** 실제 API 계약처럼 서버가 전달한 근거 안에서만 AI 응답을 만든다. 외부 요청은 수행하지 않는다. */
function groundedAiResponse(options: RequestInit) {
  const body = JSON.parse(String(options.body))
  const prompt = JSON.parse(body.input.find((message: { role: string }) => message.role === 'user').content)
  if (prompt.wardrobe) return Response.json({ output_text: JSON.stringify({ candidateId: prompt.candidates[0].id }) })
  const grounded = prompt.groundedRecommendation
  return Response.json({ output_text: JSON.stringify({
    ...grounded,
    recommendedColors: grounded.recommendedColors.map(({ name, reason, role }: { name: string; reason: string; role: string }) => ({ name, reason, role })),
    candidates: grounded.candidates.slice(0, 5),
  }) })
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

test('선택한 색감 조합이 있으면 그 조합을 추천하고 충족 여부를 표시한다', async (t) => {
  setupWardrobe(t, [
    createItem('black-top', 'top', { colorHex: '#242424' }),
    createItem('blue-top', 'top', { colorHex: '#254F82' }),
    createItem('blue-bottom', 'bottom', { colorHex: '#82ACE0' }),
  ])
  const result = await todayOutfitRecommendationService.recommend(userId, {
    ...input,
    colorScheme: 'tone-on-tone',
  })

  assert.equal(result.ready, true)
  assert.equal(result.colorSchemeApplied, true)
  assert.equal(result.headline, '톤온톤 · blue-top 중심 코디')
  assert.ok(result.items.some((item) => item.id === 'blue-top'))
  assert.ok(result.items.some((item) => item.id === 'blue-bottom'))
})

test('톤인톤으로 맞춘 조합의 제목 앞에 선택한 색감을 표시한다', async (t) => {
  setupWardrobe(t, [
    createItem('blue-top', 'top', { colorHex: '#a8b3c5' }),
    createItem('purple-bottom', 'bottom', { colorHex: '#b5a4bb' }),
  ])
  const result = await todayOutfitRecommendationService.recommend(userId, { ...input, colorScheme: 'tone-in-tone' })

  assert.equal(result.colorSchemeApplied, true)
  assert.equal(result.headline, '톤인톤 · blue-top 중심 코디')
})

test('신발이 만들어낸 색상 차이만 있는 코디에는 톤인톤 제목을 붙이지 않는다', async (t) => {
  setupWardrobe(t, [
    createItem('charcoal-coat', 'outer', { colorHex: '#2E2B2E' }),
    createItem('blue-hoodie', 'top', { colorHex: '#315970' }),
    createItem('blue-denim', 'bottom', { colorHex: '#354654' }),
    createItem('brown-boots', 'shoes', { colorHex: '#725C3C' }),
  ])
  const result = await todayOutfitRecommendationService.recommend(userId, {
    ...input, baseItemId: 'charcoal-coat', colorScheme: 'tone-in-tone',
  })

  assert.equal(result.colorSchemeApplied, false)
  assert.equal(result.headline, '기본 추천 · charcoal-coat 중심 코디')
})

test('색감 조합이 없으면 기준 옷을 유지하고 일반 추천으로 돌아간다', async (t) => {
  setupWardrobe(t, [
    createItem('base-black-top', 'top', { colorHex: '#242424' }),
    createItem('white-bottom', 'bottom', { colorHex: '#F2F1EC' }),
  ])
  const result = await todayOutfitRecommendationService.recommend(userId, {
    ...input,
    baseItemId: 'base-black-top',
    colorScheme: 'tone-on-tone',
  })

  assert.equal(result.ready, true)
  assert.equal(result.colorSchemeApplied, false)
  assert.equal(result.headline, '기본 추천 · base-black-top 중심 코디')
  assert.ok(result.items.some((item) => item.id === 'base-black-top'))
  assert.doesNotMatch(result.summary, /톤온톤/)
})

test('지원하지 않는 색감 값은 거절한다', async (t) => {
  setupWardrobe(t, [createItem('top', 'top'), createItem('bottom', 'bottom')])
  await assert.rejects(
    todayOutfitRecommendationService.recommend(userId, {
      ...input,
      colorScheme: 'neon',
    }),
    (error: unknown) => error instanceof ServiceError && error.code === 'INVALID_COLOR_SCHEME',
  )
})

test('색감 선택을 생략하거나 자동으로 고르면 기존 추천과 같다', async (t) => {
  setupWardrobe(t, [createItem('top', 'top'), createItem('bottom', 'bottom')])
  const original = await todayOutfitRecommendationService.recommend(userId, input)
  const automatic = await todayOutfitRecommendationService.recommend(userId, {
    ...input,
    colorScheme: 'auto',
  })

  assert.deepEqual(automatic, original)
  assert.equal(automatic.colorSchemeApplied, true)
})

test('AI 후보에 기준 아이템을 전달하고 응답에도 같은 기준 옷을 유지한다', async (t) => {
  const baseItem = createItem('base-outer', 'outer')
  setupWardrobe(t, [baseItem, createItem('top', 'top'), createItem('bottom', 'bottom')])
  process.env.OPENAI_API_KEY = 'test-key'
  let prompt: { baseItemNumber: number; wardrobe: Array<{ number: number; 이름: string }>; candidates: Array<{ itemNumbers: number[] }> } | undefined
  t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
    const body = JSON.parse(String(options.body)) as { input: Array<{ role: string; content: string }> }
    const userMessage = body.input.find((message) => message.role === 'user')
    assert.ok(userMessage)
    prompt = JSON.parse(userMessage.content)
    return groundedAiResponse(options)
  })
  const result = await todayOutfitRecommendationService.recommend(userId, {
    ...input,
    baseItemId: baseItem.id,
  })

  assert.ok(prompt)
  const { baseItemNumber, wardrobe, candidates } = prompt
  assert.equal(wardrobe.find(({ number }) => number === baseItemNumber)?.이름, baseItem.name)
  assert.ok(candidates.every(({ itemNumbers }) => itemNumbers.includes(baseItemNumber)))
  assert.equal(result.source, 'ai')
  assert.equal(result.headline, 'base-outer 중심 코디')
  assert.match(result.summary, /겉에는 base-outer까지 매치했어요/)
  assert.ok(result.reasons.some((reason) => reason.includes('무채색')))
  assert.ok(result.items.some((item) => item.id === baseItem.id))
})

test('AI가 목록 밖 후보를 반환하면 서버 코디를 유지하고 사용권을 반환한다', async (t) => {
  setupWardrobe(t, [createItem('top', 'top'), createItem('bottom', 'bottom')])
  process.env.OPENAI_API_KEY = 'test-key'
  const settle = t.mock.method(recommendationCreditRepository, 'settle', async () => true)
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    output_text: JSON.stringify({ candidateId: 'combination-99' }),
  }))

  const result = await todayOutfitRecommendationService.recommend(userId, input)
  assert.equal(result.source, 'fallback')
  assert.equal(result.ready, true)
  assert.deepEqual(result.items.map((item) => item.id).sort(), ['bottom', 'top'])
  assert.ok(result.reasons.length > 0)
  assert.equal(settle.mock.calls[0].arguments[3], null)
})

test('코디 후보를 한 번에 보내고 AI가 고른 옷 구성과 설명을 재사용한다', async (t) => {
  const items = [
    createItem('coat', 'outer', { name: '듀크 코트' }),
    createItem('hoodie', 'top', { name: '후드' }),
    createItem('knit', 'top', { name: '울 니트' }),
    createItem('fleece', 'bottom', { name: '플리스 팬츠' }),
    createItem('denim', 'bottom', { name: '데님' }),
    createItem('shoe', 'shoes', { name: '가죽 더비' }),
    createItem('sneaker', 'shoes', { name: '스니커즈' }),
    createItem('seen', 'bottom', { name: '이미 본 하의' }),
  ]
  setupWardrobe(t, items)
  process.env.OPENAI_API_KEY = 'test-key'
  let resultText: string | null = null
  t.mock.method(recommendationCreditRepository, 'reserve', async () => ({ id: 'credit-test', token: 'token', resultText }))
  const settle = t.mock.method(recommendationCreditRepository, 'settle', async (_user: string, _id: string, _token: string, text: string | null) => {
    resultText = text
    return true
  })
  const fetch = t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
    const body = JSON.parse(String(options.body))
    const prompt = JSON.parse(body.input.find(({ role }: { role: string }) => role === 'user').content) as {
      wardrobe: Array<{ number: number; 이름: string }>
      candidates: Array<{ id: string; itemNumbers: number[] }>
    }
    assert.ok(prompt.candidates.length > 1 && prompt.candidates.length <= 6)
    assert.equal(new Set(prompt.wardrobe.map(({ 이름 }) => 이름)).size, prompt.wardrobe.length)
    assert.ok(prompt.wardrobe.some(({ 이름 }) => 이름 === '스니커즈'))
    assert.ok(!prompt.wardrobe.some(({ 이름 }) => 이름 === '이미 본 하의'))
    const chosen = prompt.candidates.find(({ itemNumbers }) => {
      const names = prompt.wardrobe.filter(({ number }) => itemNumbers.includes(number)).map(({ 이름 }) => 이름)
      return names.includes('울 니트') && names.includes('데님')
    })
    assert.ok(chosen)
    assert.notEqual(chosen.id, prompt.candidates[0].id)
    return Response.json({ output_text: JSON.stringify({ candidateId: chosen.id }) })
  })

  const requested = {
    ...input, baseItemId: 'coat', colorScheme: 'achromatic',
    seenOutfitItemIds: [['coat', 'hoodie', 'seen'], ['coat', 'knit', 'seen']],
  }
  const result = await todayOutfitRecommendationService.recommend(userId, requested)
  assert.equal(result.source, 'ai')
  assert.equal(result.headline, '무채색 · 듀크 코트 중심 코디')
  assert.match(result.summary, /울 니트에 데님/)
  assert.ok(result.items.some(({ id }) => id === 'knit'))
  assert.ok(result.items.some(({ id }) => id === 'denim'))
  assert.deepEqual(await todayOutfitRecommendationService.recommend(userId, requested), result)
  assert.equal(fetch.mock.callCount(), 1)
  assert.equal(settle.mock.callCount(), 1)
})

test('OpenAI 응답이 시간 제한을 넘기면 재시도 없이 서버 조합으로 돌아간다', async (t) => {
  setupWardrobe(t, [createItem('top', 'top'), createItem('bottom', 'bottom')])
  process.env.OPENAI_API_KEY = 'test-key'
  const settle = t.mock.method(recommendationCreditRepository, 'settle', async () => true)
  const controller = new AbortController()
  t.mock.method(AbortSignal, 'timeout', (ms: number) => {
    assert.equal(ms, 5_000)
    return controller.signal
  })
  const fetch = t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
    assert.equal(options.signal, controller.signal)
    controller.abort()
    options.signal?.throwIfAborted()
    throw new Error('fixture must abort')
  })

  const result = await todayOutfitRecommendationService.recommend(userId, input)
  assert.equal(result.source, 'fallback')
  assert.deepEqual(result.items.map(({ id }) => id), ['top', 'bottom'])
  assert.equal(fetch.mock.callCount(), 1)
  assert.equal(settle.mock.calls[0].arguments[3], null)
})

test('기준을 지정하지 않은 기존 추천은 null 입력과 동일하게 동작한다', async (t) => {
  setupWardrobe(t, [createItem('top', 'top'), createItem('bottom', 'bottom')])
  const original = await todayOutfitRecommendationService.recommend(userId, input)
  const withoutBase = await todayOutfitRecommendationService.recommend(userId, {
    ...input,
    baseItemId: null,
  })

  assert.equal(original.ready, true)
  assert.equal(original.headline, 'top 중심 코디')
  assert.deepEqual(withoutBase, original)
})

test('추천 카드에서는 실제 옷을 말하고 색 대비 설명에서도 비교한 옷을 직접 부른다', async (t) => {
  setupWardrobe(t, [
    createItem('knit', 'top', { name: '아이보리 니트', colorHex: '#F2EFE1' }),
    createItem('pants', 'bottom', { name: '브라운 팬츠', colorHex: '#503725' }),
    createItem('coat', 'outer', { name: '올리브 코트', colorHex: '#45472C' }),
  ])
  const result = await todayOutfitRecommendationService.recommend(userId, { ...input, baseItemId: 'coat' })
  assert.equal(result.headline, '올리브 코트 중심 코디')
  assert.equal(result.summary, '아이보리 니트에 브라운 팬츠, 겉에는 올리브 코트까지 매치했어요.')
  assert.ok(result.reasons.includes('아이보리 니트에 더 짙은 브라운 팬츠까지 매치했어요.'))
})

test('요청한 톤온톤 설명은 색의 차이를 설명하고 같은 핏과 레이어 구성을 반복하지 않는다', async (t) => {
  const regular = {
    silhouette: 'regular', pattern: 'solid', material: 'cotton',
    texture: 'smooth', warmth: 'medium', formality: 0.5, confidence: 0.9,
  }
  setupWardrobe(t, [
    createItem('knit', 'top', { name: '회색 니트', colorHex: '#909090', fashionAttributes: { ...regular, layerRole: 'base' } }),
    createItem('denim', 'bottom', { name: '워시드 블루 데님', colorHex: '#6F8CAA', fashionAttributes: { ...regular, layerRole: 'single' } }),
    createItem('coat', 'outer', { name: '네이비 피코트', colorHex: '#25344A' }),
  ])

  const result = await todayOutfitRecommendationService.recommend(userId, { ...input, baseItemId: 'coat', colorScheme: 'tone-on-tone' })
  assert.equal(result.colorSchemeApplied, true)
  assert.deepEqual(result.reasons, ['짙은 네이비 피코트에서 한층 밝은 워시드 블루 데님까지, 같은 계열 안에서 밝기 차이를 줬어요.'])
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

test('AI 후보에는 목표 스타일과 선호 핏 없이 등록된 옷의 관찰 속성만 전달한다', async (t) => {
  setupWardrobe(t, [createItem('top', 'top'), createItem('bottom', 'bottom')])
  process.env.OPENAI_API_KEY = 'test-key'
  t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
    const body = JSON.parse(String(options.body)) as { input: Array<{ role: string; content: string }> }
    const userMessage = body.input.find((message) => message.role === 'user')!
    const prompt = JSON.parse(userMessage.content)
    assert.equal(prompt.targetStyle, undefined)
    assert.equal(prompt.styleGuide, undefined)
    assert.equal(prompt.profile, undefined)
    assert.equal(prompt.wardrobe.length, 2)
    assert.equal(prompt.wardrobe[0].관찰속성, null)
    return groundedAiResponse(options)
  })
  const result = await todayOutfitRecommendationService.recommend(userId, input)
  assert.equal(result.source, 'ai')
  assert.equal(result.style, null)
})


test('수동 매칭은 고른 옷과 후보의 디자인 속성을 전달하며 선호 스타일·핏을 조회하지 않는다', async (t) => {
  const selected = [createItem('top', 'top', {
    fashionAttributes: {
      layerRole: 'base', silhouette: 'oversized', pattern: 'solid', material: 'cotton',
      texture: 'smooth', warmth: 'light', formality: 0.2, confidence: 0.9,
    },
  }), createItem('outer', 'outer')]
  setupWardrobe(t, [createItem('bottom', 'bottom', {
    fashionAttributes: {
      layerRole: 'single', silhouette: 'slim', pattern: 'solid', material: 'denim',
      texture: 'twill', warmth: 'medium', formality: 0.3, confidence: 0.8,
    },
  })])
  t.mock.method(wardrobeRepository, 'findManyOwnedByIds', async () => selected)
  const profileRead = t.mock.method(userRepository, 'findViewerById', async () => {
    throw new Error('색상 추천은 스타일 프로필을 읽지 않아야 한다')
  })
  process.env.OPENAI_API_KEY = 'test-key'
  t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
    const body = JSON.parse(String(options.body)) as { input: Array<{ role: string; content: string }> }
    const prompt = JSON.parse(body.input.find((message) => message.role === 'user')!.content)
    const systemPrompt = body.input.find((message) => message.role === 'system')!.content
    assert.deepEqual(prompt.selectedItems.map((item: { id: string }) => item.id), ['top', 'outer'])
    assert.equal(prompt.targetCategory, 'bottom')
    assert.equal(prompt.styleProfile, undefined)
    assert.equal(prompt.selectedItems[0].fashionAttributes.silhouette, 'oversized')
    assert.equal(prompt.wardrobeCandidates[0].fashionAttributes.material, 'denim')
    assert.match(systemPrompt, /실루엣 균형.*패턴.*소재/)
    return groundedAiResponse(options)
  })
  const result = await outfitRecommendationService.recommend(userId, { selectedItemIds: ['top', 'outer'], targetCategory: 'bottom' })
  assert.equal(profileRead.mock.callCount(), 0)
  assert.equal(result.source, 'ai')
  assert.equal(result.recommendedColors.length, 3)
  assert.equal(result.candidates[0]?.item.id, 'bottom')
  assert.equal(result.candidates[0]?.relation, 'design-balance')
})

const styleColors = [
  { name: '화이트', role: 'safe', reason: '밝게 이어져요.' },
  { name: '그레이', role: 'harmony', reason: '차분하게 이어져요.' },
  { name: '레드', role: 'accent', reason: '포인트를 줘요.' },
]

for (const mode of ['colors', 'items'] as const) {
  test(`이전 앱의 ${mode} 요청도 컬러와 옷을 함께 반환하고 사용권은 한 번 예약한다`, async (t) => {
    const wardrobeLookup = setupWardrobe(t, [createItem('bottom', 'bottom')])
    t.mock.method(wardrobeRepository, 'findManyOwnedByIds', async () => [createItem('top', 'top')])
    process.env.OPENAI_API_KEY = 'test-key'
    const reserve = t.mock.method(recommendationCreditRepository, 'reserve', async () => ({ id: 'style', token: 'one', resultText: null }))
    const settle = t.mock.method(recommendationCreditRepository, 'settle', async () => true)
    const aiRequest = t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
      const body = JSON.parse(String(options.body))
      const prompt = JSON.parse(body.input.find((message: { role: string }) => message.role === 'user').content)
      assert.equal(prompt.wardrobeCandidates[0].id, 'bottom')
      assert.equal(prompt.selectedItems[0].fashionAttributes, null)
      assert.deepEqual(body.text.format.schema.required, ['headline', 'summary', 'recommendedColors', 'candidates'])
      return groundedAiResponse(options)
    })
    const result = await outfitRecommendationService.recommend(userId, { selectedItemIds: ['top'], targetCategory: 'bottom', mode })
    assert.equal(aiRequest.mock.callCount(), 1)
    assert.equal(wardrobeLookup.mock.callCount(), 1)
    assert.equal(reserve.mock.callCount(), 1)
    assert.equal(settle.mock.callCount(), 1)
    assert.notEqual(settle.mock.calls[0].arguments[3], null)
    assert.equal(result.source, 'ai')
    assert.equal(result.recommendedColors.length, 3)
    assert.equal(result.candidates[0]?.item.id, 'bottom')
  })
}

test('옷 후보가 없어도 컬러 추천을 함께 받을 수 있다', async (t) => {
  setupWardrobe(t, [])
  t.mock.method(wardrobeRepository, 'findManyOwnedByIds', async () => [createItem('top', 'top')])
  process.env.OPENAI_API_KEY = 'test-key'
  t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => groundedAiResponse(options))
  const result = await outfitRecommendationService.recommend(userId, { selectedItemIds: ['top'], targetCategory: 'bottom' })
  assert.equal(result.source, 'ai')
  assert.equal(result.recommendedColors.length, 3)
  assert.deepEqual(result.candidates, [])
})

test('스타일 추천 사용권 소진은 AI 실행 전에 거절하고 기본 추천으로 우회하지 않는다', async (t) => {
  setupWardrobe(t, [createItem('bottom', 'bottom')])
  t.mock.method(wardrobeRepository, 'findManyOwnedByIds', async () => [createItem('top', 'top')])
  process.env.OPENAI_API_KEY = 'test-key'
  t.mock.method(recommendationCreditRepository, 'reserve', async () => { throw new ServiceError('사용권 소진', 'RECOMMENDATION_CREDITS_EXHAUSTED') })
  const aiRequest = t.mock.method(globalThis, 'fetch', async () => { throw new Error('AI가 실행되면 안 됨') })
  await assert.rejects(outfitRecommendationService.recommend(userId, { selectedItemIds: ['top'], targetCategory: 'bottom' }), { code: 'RECOMMENDATION_CREDITS_EXHAUSTED' })
  assert.equal(aiRequest.mock.callCount(), 0)
})

test('스타일 AI 실패는 사용권을 반환하고 컬러·옷의 기본 추천을 제공한다', async (t) => {
  setupWardrobe(t, [createItem('bottom', 'bottom')])
  t.mock.method(wardrobeRepository, 'findManyOwnedByIds', async () => [createItem('top', 'top')])
  process.env.OPENAI_API_KEY = 'test-key'
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('fixture failure') })
  const settle = t.mock.method(recommendationCreditRepository, 'settle', async () => true)
  const result = await outfitRecommendationService.recommend(userId, { selectedItemIds: ['top'], targetCategory: 'bottom' })
  assert.equal(result.source, 'fallback')
  assert.equal(result.recommendedColors.length, 3)
  assert.equal(result.candidates[0]?.item.id, 'bottom')
  assert.equal(settle.mock.callCount(), 1)
  assert.equal(settle.mock.calls[0].arguments[3], null)
})

test('외부 후보·중복 후보·빈 후보·빈 설명은 AI 결과로 표시하지 않는다', async (t) => {
  const top = createItem('top', 'top')
  setupWardrobe(t, [createItem('bottom', 'bottom')])
  t.mock.method(wardrobeRepository, 'findManyOwnedByIds', async () => [top])
  process.env.OPENAI_API_KEY = 'test-key'
  const valid = { wardrobeItemId: 'bottom', reason: '색과 핏이 이어져요.', relation: 'design-balance' }
  let response: unknown
  t.mock.method(globalThis, 'fetch', async () => Response.json({ output_text: JSON.stringify(response) }))
  for (const invalid of [
    { candidates: [{ ...valid, wardrobeItemId: 'other-user-item' }] },
    { candidates: [valid, valid] },
    { candidates: [] },
    { candidates: [valid], summary: ' ' },
    { candidates: [valid], headline: 'x'.repeat(81) },
    { candidates: [null] },
  ]) {
    response = { headline: '추천', summary: '조합 설명', recommendedColors: styleColors, ...invalid }
    const result = await outfitRecommendationService.recommend(userId, { selectedItemIds: ['top'], targetCategory: 'bottom', mode: 'items' })
    assert.equal(result.source, 'fallback')
    assert.deepEqual(result.candidates.map(({ item }) => item.id), ['bottom'])
  }
})

test('잘못된 색상 응답의 자료형과 이름·역할 중복을 거절한다', async (t) => {
  const top = createItem('top', 'top')
  setupWardrobe(t, [])
  t.mock.method(wardrobeRepository, 'findManyOwnedByIds', async () => [top])
  process.env.OPENAI_API_KEY = 'test-key'
  let colors: unknown
  t.mock.method(globalThis, 'fetch', async () => Response.json({ output_text: JSON.stringify({ headline: '추천', summary: '색 조합', recommendedColors: colors, candidates: [] }) }))
  const safe = { name: '화이트', role: 'safe', reason: '차분하게 연결돼요.' }
  const harmony = { name: '그레이', role: 'harmony', reason: '톤을 연결해요.' }
  for (colors of [null, {}, [null], [safe, harmony, { ...safe, role: 'accent' }], [safe, harmony, { name: '없는 색', role: 'accent', reason: '포인트예요.' }]]) {
    const result = await outfitRecommendationService.recommend(userId, { selectedItemIds: ['top'], targetCategory: 'bottom', mode: 'colors' })
    assert.equal(result.source, 'fallback')
    assert.equal(result.recommendedColors.length, 3)
  }
})

test('검증된 추천은 재사용하고 후보 옷의 색이 바뀌면 다시 AI를 호출한다', async (t) => {
  const top = createItem('top', 'top')
  const bottom = createItem('bottom', 'bottom')
  setupWardrobe(t, [bottom])
  t.mock.method(wardrobeRepository, 'findManyOwnedByIds', async () => [top])
  process.env.OPENAI_API_KEY = 'test-key'
  const fetch = t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => groundedAiResponse(options))
  const request = { selectedItemIds: ['top'], targetCategory: 'bottom' as const, mode: 'items' as const }
  assert.equal((await outfitRecommendationService.recommend(userId, request)).source, 'ai')
  assert.equal((await outfitRecommendationService.recommend(userId, request)).source, 'ai')
  assert.equal(fetch.mock.callCount(), 1)
  bottom.colorName = '화이트'
  bottom.colorHex = '#ffffff'
  assert.equal((await outfitRecommendationService.recommend(userId, request)).source, 'ai')
  assert.equal(fetch.mock.callCount(), 2)
})


test('상의와 하의가 같으면 신발·액세서리만 다른 조합을 한 벌로 센다', async (t) => {
  setupWardrobe(t, [
    createItem('top', 'top'), createItem('bottom', 'bottom'),
    createItem('shoe-a', 'shoes'), createItem('shoe-b', 'shoes'), createItem('accessory', 'accessory'),
  ])
  const result = await todayOutfitRecommendationService.recommend(userId, input)
  assert.equal(result.ready, true)
  assert.equal(result.combinationCount, 1)
})


test('추천권 소진은 기본 추천으로 우회하지 않고 AI 호출 전에 거절한다', async (t) => {
  setupWardrobe(t, [createItem('top', 'top'), createItem('bottom', 'bottom')])
  t.mock.method(recommendationCreditRepository, 'reserve', async () => {
    throw new ServiceError('추천권 소진', 'RECOMMENDATION_CREDITS_EXHAUSTED')
  })
  await assert.rejects(todayOutfitRecommendationService.recommend(userId, input), { code: 'RECOMMENDATION_CREDITS_EXHAUSTED' })
})

test('완성 가능한 추천 조합이 없으면 추천권을 예약하지 않는다', async (t) => {
  setupWardrobe(t, [createItem('top', 'top')])
  const reserve = t.mock.method(recommendationCreditRepository, 'reserve', async () => { throw new Error('예약되면 안 됨') })
  assert.equal((await todayOutfitRecommendationService.recommend(userId, input)).ready, false)
  assert.equal(reserve.mock.callCount(), 0)
})

test('오늘의 코디는 유효한 후보 번호에 별도 AI 문구가 섞여도 서버 근거로 돌아간다', async (t) => {
  setupWardrobe(t, [
    createItem('black-top', 'top', { colorHex: '#242424' }),
    createItem('white-bottom', 'bottom', { colorHex: '#F2F1EC' }),
  ])
  process.env.OPENAI_API_KEY = 'test-key'
  const settle = t.mock.method(recommendationCreditRepository, 'settle', async () => true)
  t.mock.method(globalThis, 'fetch', async () => Response.json({ output_text: JSON.stringify({
    candidateId: 'combination-1',
    summary: '검정 상의와 흰 하의는 같은 밝기의 파란색이에요.',
  }) }))
  const result = await todayOutfitRecommendationService.recommend(userId, { ...input, colorScheme: 'tone-on-tone' })
  assert.equal(result.source, 'fallback')
  assert.equal(result.colorSchemeApplied, false)
  assert.ok(result.reasons.some((reason) => reason.includes('조건을 충족하지 못해')))
  assert.doesNotMatch(result.summary + result.reasons.join(' '), /파란색|톤온톤/)
  assert.equal(settle.mock.calls[0].arguments[3], null)
})

test('수동 컬러 추천도 잘못된 톤온톤 표시와 AI가 만든 색 설명을 거절한다', async (t) => {
  setupWardrobe(t, [createItem('beige-bottom', 'bottom', { colorName: '베이지', colorHex: '#C9B28F' })])
  t.mock.method(wardrobeRepository, 'findManyOwnedByIds', async () => [createItem('black-top', 'top')])
  process.env.OPENAI_API_KEY = 'test-key'
  const settle = t.mock.method(recommendationCreditRepository, 'settle', async () => true)
  t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
    const response = await groundedAiResponse(options).json() as { output_text: string }
    const output = JSON.parse(response.output_text)
    output.candidates[0].relation = 'tone-on-tone'
    output.candidates[0].reason = '검정과 베이지는 같은 파란색의 톤온톤이에요.'
    return Response.json({ output_text: JSON.stringify(output) })
  })
  const result = await outfitRecommendationService.recommend(userId, { selectedItemIds: ['black-top'], targetCategory: 'bottom' })
  assert.equal(result.source, 'fallback')
  assert.notEqual(result.candidates[0].relation, 'tone-on-tone')
  assert.doesNotMatch(result.candidates[0].reason, /파란색|톤온톤/)
  assert.equal(settle.mock.calls[0].arguments[3], null)
})

test('선명한 색이 이미 있으면 AI 성공 응답도 포인트 역할을 억지로 추가하지 않는다', async (t) => {
  setupWardrobe(t, [])
  t.mock.method(wardrobeRepository, 'findManyOwnedByIds', async () => [
    createItem('blue-top', 'top', { colorName: '블루', colorHex: '#0055FF' }),
  ])
  process.env.OPENAI_API_KEY = 'test-key'
  t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => groundedAiResponse(options))
  const result = await outfitRecommendationService.recommend(userId, { selectedItemIds: ['blue-top'], targetCategory: 'bottom' })
  assert.equal(result.source, 'ai')
  assert.ok(result.recommendedColors.length > 0)
  assert.ok(result.recommendedColors.every((color) => color.role !== 'accent'))
})

test('다른 후보에 해당하는 실제 근거를 바꿔 붙인 AI 응답도 거절한다', async (t) => {
  setupWardrobe(t, [
    createItem('light-blue-bottom', 'bottom', { colorHex: '#82ACE0' }),
    createItem('pink-bottom', 'bottom', { colorHex: '#D77C7C' }),
  ])
  t.mock.method(wardrobeRepository, 'findManyOwnedByIds', async () => [createItem('blue-top', 'top', { colorHex: '#254F82' })])
  process.env.OPENAI_API_KEY = 'test-key'
  t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
    const response = await groundedAiResponse(options).json() as { output_text: string }
    const output = JSON.parse(response.output_text)
    assert.notEqual(output.candidates[0].reason, output.candidates[1].reason)
    ;[output.candidates[0].reason, output.candidates[1].reason] = [output.candidates[1].reason, output.candidates[0].reason]
    return Response.json({ output_text: JSON.stringify(output) })
  })
  const result = await outfitRecommendationService.recommend(userId, { selectedItemIds: ['blue-top'], targetCategory: 'bottom' })
  assert.equal(result.source, 'fallback')
})
