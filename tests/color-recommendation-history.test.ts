import assert from 'node:assert/strict'
import test from 'node:test'
import type { TodayOutfitRecommendation } from '../packages/types/src/index'
import { OUTFIT_COLOR_RULES_VERSION } from '../packages/types/src/outfitColors.js'
import { readTodayRecommendationHistory, readAllRecentTodayRecommendationHistory, storeTodayRecommendation } from '../apps/web/src/features/plan/utils/todayRecommendationHistory'

test('이전 색 판정 기록은 보존하면서 새 추천 캐시와 분리한다', (t) => {
  const values = new Map<string, string>()
  const storage = { get length() { return values.size }, key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) }
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } })
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  })
  const recommendation: TodayOutfitRecommendation = { date: '2026-11-02', season: 'autumn', ready: true, style: null, headline: '이전 코디', summary: '이전 설명',
    items: [{ id: 'top', name: '검정 상의', createdAt: '2026-11-02', category: 'top', additionalCategories: [], classificationStatus: 'classified', colorName: '블랙', colorHex: '#242424', seasons: ['autumn'], tags: [], wearCount: 0 }],
    reasons: ['이전 근거'], colorSchemeApplied: true, profileSummary: [], source: 'fallback', model: 'old' }
  const oldKey = 'closet:today-outfit-recommendation:v8:viewer:2026-11-02:autumn:wardrobe'
  const oldValue = JSON.stringify([{ id: 'old', createdAt: '2026-11-02T00:00:00Z', date: recommendation.date, season: 'autumn', style: null, variation: 0, recommendation }])
  values.set(oldKey, oldValue)
  assert.deepEqual(readTodayRecommendationHistory('viewer', recommendation.date, 'autumn', null), [])
  assert.equal(readAllRecentTodayRecommendationHistory('viewer', recommendation.date).length, 1)
  storeTodayRecommendation('viewer', recommendation.date, 'autumn', null, 0, { ...recommendation, headline: '현재 코디' })
  const current = readTodayRecommendationHistory('viewer', recommendation.date, 'autumn', null)
  assert.equal(current[0].colorRulesVersion, OUTFIT_COLOR_RULES_VERSION)
  assert.equal(current[0].recommendation.headline, '현재 코디')
  assert.equal(values.get(oldKey), oldValue)
  assert.equal(readAllRecentTodayRecommendationHistory('viewer', recommendation.date).length, 2)
})
