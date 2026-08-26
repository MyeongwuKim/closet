import assert from 'node:assert/strict'
import test from 'node:test'
import type { Season, WardrobeItem } from '@closet/types'
import type { OutfitStyle } from '../src/constants/styleOptions'
import {
  readRecentTodayRecommendationHistory,
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

function createEntry(
  index: number,
  season: Season,
  style: OutfitStyle,
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
    recommendation: {
      date: '2026-08-26',
      season,
      ready: true,
      headline: `추천 ${index}`,
      summary: '추천 설명',
      style,
      items: [item],
      reasons: [],
      profileSummary: [],
      model: 'test',
      source: 'fallback',
    },
  }
}

test('계절과 스타일별 기록을 합쳐 최신 10개만 반환한다', () => {
  const storage = new MemoryStorage()
  const originalWindow = globalThis.window
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

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: storage },
  })

  try {
    const recent = readRecentTodayRecommendationHistory(
      'viewer-1',
      '2026-08-26',
    )

    assert.equal(recent.length, 10)
    assert.deepEqual(
      recent.map((entry) => entry.id),
      Array.from({ length: 10 }, (_, index) => `history-${11 - index}`),
    )
  } finally {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    })
  }
})
