import assert from 'node:assert/strict'
import test from 'node:test'
import type { Season, WardrobeItem } from '@closet/types'
import { QueryClient } from '@tanstack/react-query'
import type { OutfitStyle } from '../src/constants/styleOptions'
import { queryKeys } from '../src/lib/queryKeys'
import {
  matchesTodayRecommendationBaseItem,
  readAllRecentTodayRecommendationHistory,
  readRecentTodayRecommendationHistory,
  readTodayRecommendationHistory,
  storeTodayRecommendation,
  type TodayRecommendationHistoryEntry,
} from '../src/features/plan/utils/todayRecommendationHistory'

class MemoryStorage {
  private readonly values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

function withStorage(run: (storage: MemoryStorage) => void) {
  const storage = new MemoryStorage()
  const originalWindow = globalThis.window
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: storage },
  })

  try {
    run(storage)
  } finally {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    })
  }
}

function createEntry(
  index: number,
  season: Season,
  style: OutfitStyle,
  baseItemId?: string,
): TodayRecommendationHistoryEntry {
  const item: WardrobeItem = {
    id: `item-${index}`,
    name: `추천 아이템 ${index}`,
    createdAt: '2026-08-20T00:00:00.000Z',
    category: 'top',
    additionalCategories: [],
    subcategory: '니트',
    classificationStatus: 'classified',
    colorName: '그레이',
    colorHex: '#888888',
    seasons: [season],
    tags: [],
    wearCount: 0,
  }

  return {
    id: `history-${index}`,
    createdAt: new Date(Date.UTC(2026, 7, 26, 0, index)).toISOString(),
    date: '2026-08-26',
    season,
    style,
    variation: index,
    ...(baseItemId !== undefined ? { baseItemId } : {}),
    recommendation: {
      date: '2026-08-26',
      season,
      ready: true,
      headline: `추천 ${index}`,
      summary: '추천 설명',
      style,
      items: baseItemId === undefined
        ? [item]
        : [{ ...item, id: baseItemId, name: '기준 아이템' }, item],
      reasons: [`추천 이유 ${index}`],
      profileSummary: [],
      model: 'test',
      source: 'fallback',
    },
  }
}

test('계절과 스타일별 기록을 합쳐 최신 10개만 반환한다', () => {
  withStorage((storage) => {
    const entries = Array.from({ length: 12 }, (_, index) =>
      createEntry(
        index,
        index % 2 === 0 ? 'autumn' : 'winter',
        index % 2 === 0 ? 'casual' : 'minimal',
      ),
    )

    storage.setItem(
      'closet:today-outfit-recommendation:v7:viewer-1:2026-08-26:autumn:casual',
      JSON.stringify(entries.filter((entry) => entry.season === 'autumn')),
    )
    storage.setItem(
      'closet:today-outfit-recommendation:v7:viewer-1:2026-08-26:winter:minimal',
      JSON.stringify(entries.filter((entry) => entry.season === 'winter')),
    )
    storage.setItem(
      'closet:today-outfit-recommendation:v7:other-viewer:2026-08-26:autumn:casual',
      JSON.stringify([createEntry(99, 'autumn', 'casual')]),
    )

    const recent = readRecentTodayRecommendationHistory(
      'viewer-1',
      '2026-08-26',
    )

    assert.equal(recent.length, 10)
    assert.deepEqual(
      recent.map((entry) => entry.id),
      Array.from({ length: 10 }, (_, index) => `history-${11 - index}`),
    )
  })
})

test('전체 기록은 같은 사용자와 날짜의 일반 추천과 기준별 추천을 합쳐 최신 10개만 반환한다', () => {
  withStorage((storage) => {
    const scopes = [undefined, 'base-a', 'base-b'] as const
    const entries = Array.from({ length: 15 }, (_, index) =>
      createEntry(
        index,
        index % 2 === 0 ? 'autumn' : 'winter',
        index % 2 === 0 ? 'casual' : 'minimal',
        scopes[index % scopes.length],
      ),
    )

    for (const baseItemId of scopes) {
      const suffix = baseItemId === undefined ? '' : `:base:${baseItemId}`
      for (const [season, style] of [['autumn', 'casual'], ['winter', 'minimal']] as const) {
        storage.setItem(
          `closet:today-outfit-recommendation:v7:viewer-1:2026-08-26:${season}:${style}${suffix}`,
          JSON.stringify(entries.filter((entry) =>
            entry.baseItemId === baseItemId && entry.season === season && entry.style === style,
          )),
        )
      }
    }

    storage.setItem(
      'closet:today-outfit-recommendation:v7:other-viewer:2026-08-26:autumn:casual',
      JSON.stringify([createEntry(99, 'autumn', 'casual')]),
    )
    const otherDate = createEntry(98, 'autumn', 'casual', 'base-a')
    otherDate.date = '2026-08-27'
    otherDate.recommendation.date = otherDate.date
    storage.setItem(
      'closet:today-outfit-recommendation:v7:viewer-1:2026-08-27:autumn:casual:base:base-a',
      JSON.stringify([otherDate]),
    )

    assert.deepEqual(
      readAllRecentTodayRecommendationHistory('viewer-1', '2026-08-26'),
      entries.slice(-10).reverse(),
    )
    for (const baseItemId of scopes) {
      assert.deepEqual(
        readRecentTodayRecommendationHistory('viewer-1', '2026-08-26', baseItemId),
        entries.filter((entry) => entry.baseItemId === baseItemId).reverse(),
      )
    }
  })
})

test('전체 기록은 잘못된 기준 메타데이터와 저장 범위를 건너뛴다', () => {
  withStorage((storage) => {
    const genericEntry = createEntry(1, 'autumn', 'casual')
    const misplacedEntry = createEntry(2, 'autumn', 'casual', 'base-a')
    const anchoredEntry = createEntry(3, 'autumn', 'casual', 'base:b/아이템')
    storage.setItem(
      'closet:today-outfit-recommendation:v7:viewer-1:2026-08-26:autumn:casual',
      JSON.stringify([genericEntry, misplacedEntry]),
    )
    storage.setItem(
      'closet:today-outfit-recommendation:v7:viewer-1:2026-08-26:autumn:casual:base:base%3Ab%2F%EC%95%84%EC%9D%B4%ED%85%9C',
      JSON.stringify([anchoredEntry]),
    )
    storage.setItem(
      'closet:today-outfit-recommendation:v7:viewer-1:2026-08-26:autumn:casual:base:base-a',
      JSON.stringify([
        { ...misplacedEntry, baseItemId: null },
        { ...misplacedEntry, baseItemId: 42 },
        { ...misplacedEntry, baseItemId: {} },
      ]),
    )
    storage.setItem(
      'closet:today-outfit-recommendation:v7:viewer-1:2026-08-26:winter:minimal:base:base-a',
      JSON.stringify([misplacedEntry]),
    )
    storage.setItem(
      'closet:today-outfit-recommendation:v7:viewer-1:2026-08-26:autumn:casual:base:invalid-unicode',
      JSON.stringify([createEntry(99, 'autumn', 'casual', String.fromCharCode(0xd800))]),
    )

    assert.deepEqual(
      readAllRecentTodayRecommendationHistory('viewer-1', '2026-08-26'),
      [anchoredEntry, genericEntry],
    )
    assert.deepEqual(
      readRecentTodayRecommendationHistory('viewer-1', '2026-08-26'),
      [genericEntry],
    )
    assert.deepEqual(
      readRecentTodayRecommendationHistory('viewer-1', '2026-08-26', anchoredEntry.baseItemId),
      [anchoredEntry],
    )
  })
})

test('같은 조합도 일반 추천과 기준 아이템별 기록을 따로 저장한다', () => {
  withStorage((storage) => {
    const entry = createEntry(1, 'autumn', 'casual')
    const anotherItem = createEntry(2, 'autumn', 'casual').recommendation.items[0]
    const recommendation = {
      ...entry.recommendation,
      items: [...entry.recommendation.items, anotherItem],
    }

    for (const baseItemId of [undefined, 'item-1', 'item-2']) {
      storeTodayRecommendation(
        'viewer-1',
        entry.date,
        entry.season,
        entry.style,
        0,
        recommendation,
        baseItemId,
      )
    }

    assert.equal(storage.length, 3)
    assert.ok(
      storage.getItem(
        'closet:today-outfit-recommendation:v7:viewer-1:2026-08-26:autumn:casual',
      ),
    )

    for (const baseItemId of [undefined, 'item-1', 'item-2']) {
      const history = readTodayRecommendationHistory(
        'viewer-1',
        entry.date,
        entry.season,
        entry.style,
        baseItemId,
      )
      assert.equal(history.length, 1)
      assert.equal(history[0].baseItemId, baseItemId)
      assert.deepEqual(
        readRecentTodayRecommendationHistory('viewer-1', entry.date, baseItemId),
        history,
      )
    }

    assert.deepEqual(
      readRecentTodayRecommendationHistory('viewer-1', entry.date, 'item-3'),
      [],
    )
  })
})

test('추천 설명과 조합 이유를 기록에 저장하고 같은 조합의 최신 설명으로 갱신한다', () => {
  withStorage(() => {
    const entry = createEntry(1, 'autumn', 'casual')
    const firstHistory = storeTodayRecommendation(
      'viewer-1',
      entry.date,
      entry.season,
      entry.style,
      0,
      entry.recommendation,
    )
    const updatedRecommendation = {
      ...entry.recommendation,
      summary: '업데이트된 추천 설명',
      reasons: ['업데이트된 조합 이유', '두 번째 조합 이유'],
    }

    storeTodayRecommendation(
      'viewer-1',
      entry.date,
      entry.season,
      entry.style,
      1,
      updatedRecommendation,
    )

    const [stored] = readTodayRecommendationHistory(
      'viewer-1',
      entry.date,
      entry.season,
      entry.style,
    )
    assert.equal(stored.id, firstHistory[0].id)
    assert.equal(stored.createdAt, firstHistory[0].createdAt)
    assert.equal(stored.variation, 1)
    assert.equal(stored.recommendation.summary, updatedRecommendation.summary)
    assert.deepEqual(
      stored.recommendation.reasons,
      updatedRecommendation.reasons,
    )
  })
})

test('v7 일반 추천 기록을 유지하면서 기준 아이템 기록을 추가한다', () => {
  withStorage((storage) => {
    const legacyEntry = createEntry(1, 'autumn', 'casual')
    const legacyKey =
      'closet:today-outfit-recommendation:v7:viewer-1:2026-08-26:autumn:casual'
    const legacyValue = JSON.stringify([legacyEntry])
    storage.setItem(legacyKey, legacyValue)

    storeTodayRecommendation(
      'viewer-1',
      legacyEntry.date,
      legacyEntry.season,
      legacyEntry.style,
      0,
      legacyEntry.recommendation,
      'item-1',
    )

    assert.equal(storage.getItem(legacyKey), legacyValue)
    assert.deepEqual(
      readTodayRecommendationHistory(
        'viewer-1',
        legacyEntry.date,
        legacyEntry.season,
        legacyEntry.style,
      ),
      [legacyEntry],
    )
    assert.deepEqual(
      readRecentTodayRecommendationHistory('viewer-1', legacyEntry.date),
      [legacyEntry],
    )
  })
})

test('기준 아이템이 빠진 결과나 준비되지 않은 결과는 기록하지 않는다', () => {
  withStorage((storage) => {
    const entry = createEntry(1, 'autumn', 'casual')
    const history = storeTodayRecommendation(
      'viewer-1',
      entry.date,
      entry.season,
      entry.style,
      0,
      entry.recommendation,
      'item-1',
    )
    const originalValue = storage.getItem(storage.key(0)!)
    const invalidRecommendations = [
      createEntry(2, 'autumn', 'casual').recommendation,
      { ...entry.recommendation, ready: false },
      { ...entry.recommendation, items: [] },
      { ...entry.recommendation, items: [null as unknown as WardrobeItem] },
    ]

    for (const recommendation of invalidRecommendations) {
      assert.deepEqual(
        storeTodayRecommendation(
          'viewer-1',
          entry.date,
          entry.season,
          entry.style,
          1,
          recommendation,
          'item-1',
        ),
        history,
      )
      assert.equal(storage.getItem(storage.key(0)!), originalValue)
    }
  })
})

test('기준 정보나 실제 아이템이 일치하지 않는 캐시 기록은 제외한다', () => {
  withStorage((storage) => {
    const entry = createEntry(1, 'autumn', 'casual')
    storeTodayRecommendation(
      'viewer-1',
      entry.date,
      entry.season,
      entry.style,
      0,
      entry.recommendation,
      'item-1',
    )
    const scopedKey = storage.key(0)!
    const matchingEntry = { ...entry, baseItemId: 'item-1' }
    const corruptEntries = [
      entry,
      {
        ...matchingEntry,
        baseItemId: 'item-2',
        recommendation: createEntry(2, 'autumn', 'casual').recommendation,
      },
      {
        ...matchingEntry,
        recommendation: createEntry(2, 'autumn', 'casual').recommendation,
      },
      {
        ...matchingEntry,
        recommendation: { ...entry.recommendation, items: [null] },
      },
      {
        ...matchingEntry,
        recommendation: { ...entry.recommendation, ready: false },
      },
      {
        ...matchingEntry,
        recommendation: { ...entry.recommendation, summary: null },
      },
      {
        ...matchingEntry,
        recommendation: { ...entry.recommendation, reasons: '잘못된 이유' },
      },
      {
        ...matchingEntry,
        recommendation: { ...entry.recommendation, reasons: [null] },
      },
      {
        ...matchingEntry,
        recommendation: { ...entry.recommendation, style: 'minimal' },
      },
    ]
    storage.setItem(scopedKey, JSON.stringify([...corruptEntries, matchingEntry]))

    assert.deepEqual(
      readTodayRecommendationHistory(
        'viewer-1',
        entry.date,
        entry.season,
        entry.style,
        'item-1',
      ),
      [matchingEntry],
    )
    assert.deepEqual(
      readRecentTodayRecommendationHistory('viewer-1', entry.date, 'item-1'),
      [matchingEntry],
    )
    assert.deepEqual(
      readAllRecentTodayRecommendationHistory('viewer-1', entry.date),
      [matchingEntry],
    )
    assert.deepEqual(
      readRecentTodayRecommendationHistory('viewer-1', entry.date),
      [],
    )
    assert.deepEqual(
      readRecentTodayRecommendationHistory('viewer-1', entry.date, 'item-2'),
      [],
    )
  })
})

test('손상된 다른 범위의 캐시가 있어도 유효한 추천 기록은 읽는다', () => {
  withStorage((storage) => {
    const entry = createEntry(1, 'autumn', 'casual')
    storage.setItem(
      'closet:today-outfit-recommendation:v7:viewer-1:2026-08-26:winter:minimal',
      '{invalid json',
    )
    storage.setItem(
      'closet:today-outfit-recommendation:v7:viewer-1:2026-08-26:autumn:casual',
      JSON.stringify([entry]),
    )

    assert.deepEqual(
      readRecentTodayRecommendationHistory('viewer-1', entry.date),
      [entry],
    )
    assert.deepEqual(
      readAllRecentTodayRecommendationHistory('viewer-1', entry.date),
      [entry],
    )
    assert.deepEqual(
      readTodayRecommendationHistory('viewer-1', entry.date, 'winter', 'minimal'),
      [],
    )
  })
})

test('캐시 후보의 기준 아이템 포함 여부를 실제 아이템 ID로 확인한다', () => {
  const recommendation = createEntry(1, 'autumn', 'casual').recommendation

  assert.equal(matchesTodayRecommendationBaseItem(recommendation), true)
  assert.equal(matchesTodayRecommendationBaseItem(recommendation, 'item-1'), true)
  assert.equal(matchesTodayRecommendationBaseItem(recommendation, 'item-2'), false)
  assert.equal(
    matchesTodayRecommendationBaseItem({ ...recommendation, items: [] }, 'item-1'),
    false,
  )
})

test('추천 쿼리 캐시는 일반 추천과 각 기준 아이템을 구분한다', () => {
  const client = new QueryClient()
  const recommendation = createEntry(1, 'autumn', 'casual').recommendation
  const createKey = (baseItemId?: string) =>
    queryKeys.planner.todayRecommendation(
      'viewer-1',
      '2026-08-26',
      'autumn',
      'casual',
      0,
      [],
      baseItemId,
    )

  try {
    client.setQueryData(createKey(), recommendation)
    client.setQueryData(createKey('item-1'), {
      ...recommendation,
      headline: '첫 번째 아이템 중심 코디',
    })

    assert.deepEqual(client.getQueryData(createKey()), recommendation)
    assert.equal(
      client.getQueryData<typeof recommendation>(createKey('item-1'))?.headline,
      '첫 번째 아이템 중심 코디',
    )
    assert.equal(client.getQueryData(createKey('item-2')), undefined)
  } finally {
    client.clear()
  }
})
