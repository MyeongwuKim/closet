import { test as base, expect } from '@playwright/test'
import { loadEnvFile } from 'node:process'
import { resolve } from 'node:path'
import { buildApp } from '../../apps/api/src/app.js'
import { authService } from '../../apps/api/src/features/auth/auth.service.js'
import { wardrobeRepository } from '../../apps/api/src/features/wardrobe/wardrobe.repository.js'
import { recommendationCreditRepository } from '../../apps/api/src/features/preview-credits/recommendation-credit.repository.js'
import { pushDeviceRepository } from '../../apps/api/src/features/push/push.repository.js'
import { createAiExecutor, installAiExecutor } from '../../apps/api/src/lib/ai/ai-execution.js'
import { COLOR_RULES_VERSION } from '../../apps/api/src/features/outfit/outfit-color-rules.js'
import type { ColorApiCase } from './color-fixtures.js'

type WardrobeItem = Awaited<ReturnType<typeof wardrobeRepository.findMany>>[number]
type JsonObject = Record<string, any>

export interface ProviderCall {
  request: JsonObject
  response?: JsonObject
  status?: number
  requestId?: string | null
  durationMs?: number
}

interface ColorApiHarness {
  calls: ProviderCall[]
  settlements: Array<string | null>
  recommend: (fixture: ColorApiCase) => Promise<JsonObject>
}

/** 고정 색상 사례를 테스트 계정의 옷장 데이터로 바꾼다. 사진·실측·디자인 속성은 추정해서 채우지 않는다. */
function toItem(item: ColorApiCase['items'][number], userId: string): WardrobeItem {
  const at = new Date('2026-11-02T00:00:00Z')
  return {
    ...item, userId, additionalCategories: [], subcategory: item.category === 'top' ? 'short-sleeve' : item.category === 'outer' ? 'jacket' : 'pants',
    colorDetailName: item.colorName, colorMode: item.colorMode as WardrobeItem['colorMode'], fashionAttributes: null,
    seasons: ['autumn'], classificationStatus: 'classified', classificationConfidence: 0.9, classificationModel: null,
    classificationCandidates: null, tags: [], wearCount: 0, lastWornAt: null, archivedAt: null, createdAt: at, updatedAt: at,
    displayImageAssetId: null, originalImageAssetId: null, displayImageAsset: null, originalImageAsset: null,
    brandName: null, sizeLabel: null, shoulderWidthCm: null, chestWidthCm: null, sleeveLengthCm: null, totalLengthCm: null,
    waistWidthCm: null, hipWidthCm: null, inseamCm: null, thighWidthCm: null, riseCm: null, hemWidthCm: null,
  }
}

const todayQuery = `query CheckTodayColor($input: TodayOutfitRecommendationInput!) {
  todayOutfitRecommendation(input: $input) {
    ready source model headline summary reasons colorSchemeApplied
    items { id name category colorHex colorMode }
  }
}`
const manualQuery = `query CheckManualColor($input: OutfitRecommendationInput!) {
  outfitRecommendation(input: $input) {
    source model headline summary targetCategory
    recommendedColors { name hex role reason }
    candidates { item { id name category colorHex } relation reason }
  }
}`

/**
 * 실제 GraphQL 핸들러→추천 서비스→OpenAI HTTP 호출을 실행한다.
 * 로그인 조회·옷장·사용권·알림 기기 조회를 메모리 데이터로 대체하며, AI 응답을 모방하거나 실패 시 통과시키지 않는다.
 * 매 테스트마다 실행기와 입력을 초기화하므로 재실행·repeat-each도 이전 AI 캐시로 대체되지 않는다.
 */
export const test = base.extend<{ colorApi: ColorApiHarness }, { apiApp: Awaited<ReturnType<typeof buildApp>> }>({
  apiApp: [async ({}, use) => {
    const app = await buildApp()
    app.log.level = 'silent'
    try { await use(app) }
    finally { await app.close() }
  }, { scope: 'worker' }],
  colorApi: async ({ apiApp }, use, testInfo) => {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      const databaseUrl = process.env.DATABASE_URL
      try { loadEnvFile(resolve('apps/api/.env')) }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
      finally { process.env.DATABASE_URL = databaseUrl }
    }
    if (!process.env.OPENAI_API_KEY?.trim()) {
      throw new Error('OPENAI_API_KEY가 필요합니다. apps/api/.env 또는 실행 환경에 설정하세요. 실제 API가 호출되지 않았으므로 검증 통과로 처리하지 않습니다.')
    }

    const userId = `isolated-api-${testInfo.testId}-${testInfo.repeatEachIndex}`
    let inventory: WardrobeItem[] = []
    const calls: ProviderCall[] = []
    const settlements: Array<string | null> = []
    const requests: unknown[] = []
    const responses: unknown[] = []
    let requestCallStart = 0
    const originals = {
      getViewer: authService.getViewer,
      findMany: wardrobeRepository.findMany,
      findManyOwnedByIds: wardrobeRepository.findManyOwnedByIds,
      reserve: recommendationCreditRepository.reserve,
      settle: recommendationCreditRepository.settle,
      findPushTokens: pushDeviceRepository.findActiveTokensForUser,
      fetch: globalThis.fetch,
    }
    installAiExecutor(createAiExecutor())
    Object.assign(authService, { getViewer: async (token: string | null) => {
      expect(token).toBe('ai-api-test-token')
      return { id: userId }
    } })
    Object.assign(wardrobeRepository, {
      findMany: async (requestedUser: string, filter: { category?: string }) => {
        expect(requestedUser).toBe(userId)
        return inventory.filter((item) => !filter.category || item.category === filter.category)
      },
      findManyOwnedByIds: async (requestedUser: string, ids: string[]) => {
        expect(requestedUser).toBe(userId)
        return inventory.filter((item) => ids.includes(item.id))
      },
    })
    Object.assign(recommendationCreditRepository, {
      reserve: async () => ({ id: 'isolated-reservation', token: 'isolated-token', resultText: null }),
      settle: async (_user: string, _id: string, _token: string, resultText: string | null) => {
        settlements.push(resultText)
        return true
      },
    })
    // 완료 알림 경로도 저장소를 조회하거나 실제 기기에 전송하지 않도록 분리한다.
    Object.assign(pushDeviceRepository, { findActiveTokensForUser: async () => [] })

    globalThis.fetch = async (url, options) => {
      if (String(url) !== 'https://api.openai.com/v1/responses') throw new Error('검사 범위 밖 외부 요청을 차단했습니다.')
      // 순차 시나리오도 각 추천 요청에서 공급자의 일시적 실패 재시도 1회만 허용한다.
      if (calls.length - requestCallStart >= 2) throw new Error('추천 요청당 실제 AI 호출 상한 2회에 도달했습니다.')
      const request = JSON.parse(String(options?.body)) as JsonObject
      const call: ProviderCall = { request }
      calls.push(call)
      const started = Date.now()
      try {
        const response = await originals.fetch(url, options)
        const payload = await response.clone().json().catch(() => null) as JsonObject | null
        Object.assign(call, { status: response.status, requestId: response.headers.get('x-request-id'), durationMs: Date.now() - started,
          response: response.ok ? payload : { error: { code: payload?.error?.code, type: payload?.error?.type } } })
        return response
      } catch (error) {
        call.durationMs = Date.now() - started
        throw error
      }
    }

    try {
      await use({ calls, settlements, recommend: async (fixture) => {
        inventory = fixture.items.map((item) => toItem(item, userId))
        requestCallStart = calls.length
        const input = fixture.kind === 'today'
          ? { date: '2026-11-02', season: 'autumn', baseItemId: fixture.selectedId, colorScheme: fixture.scheme }
          : { selectedItemIds: fixture.selectedIds ?? [fixture.selectedId], targetCategory: fixture.targetCategory ?? 'bottom' }
        const request = { query: fixture.kind === 'today' ? todayQuery : manualQuery, variables: { input } }
        requests.push({ caseId: fixture.id, expectedApplied: fixture.expectedApplied, expectedRelation: fixture.expectedRelation,
          qualityRegression: fixture.qualityRegression ?? false, fixture: fixture.items, graphql: request })
        const response = await apiApp.inject({ method: 'POST', url: '/graphql', headers: { authorization: 'Bearer ai-api-test-token' }, payload: request })
        const payload = response.json() as JsonObject
        responses.push({ status: response.statusCode, payload })
        expect(response.statusCode).toBe(200)
        expect(payload.errors, 'GraphQL 오류가 없어야 실제 응답 검사를 계속할 수 있습니다.').toBeUndefined()
        return payload.data[fixture.kind === 'today' ? 'todayOutfitRecommendation' : 'outfitRecommendation'] as JsonObject
      } })
    } finally {
      globalThis.fetch = originals.fetch
      Object.assign(authService, { getViewer: originals.getViewer })
      Object.assign(wardrobeRepository, { findMany: originals.findMany, findManyOwnedByIds: originals.findManyOwnedByIds })
      Object.assign(recommendationCreditRepository, { reserve: originals.reserve, settle: originals.settle })
      Object.assign(pushDeviceRepository, { findActiveTokensForUser: originals.findPushTokens })
      await testInfo.attach('입력과 기대값', { body: Buffer.from(JSON.stringify({ colorRulesVersion: COLOR_RULES_VERSION,
        mode: '실제 AI API · 인증/저장소/알림 조회는 메모리 대체', repeat: testInfo.repeatEachIndex, requests }, null, 2)), contentType: 'application/json' })
      await testInfo.attach('GraphQL 실제 응답', { body: Buffer.from(JSON.stringify(responses, null, 2)), contentType: 'application/json' })
      await testInfo.attach('AI 실제 요청과 응답', { body: Buffer.from(JSON.stringify(calls, null, 2)), contentType: 'application/json' })
      await testInfo.attach('테스트 사용권 정산', { body: Buffer.from(JSON.stringify({ settled: settlements.length, successful: settlements.filter(Boolean).length })), contentType: 'application/json' })
    }
  },
})

export { expect }

/** 서비스가 만든 근거와 실제 공급자 응답을 별도로 대조한다. HTTP 200이나 source=ai만으로 통과시키지 않는다. */
export function expectGroundedProviderResponse(calls: ProviderCall[]) {
  expect(calls.length, '실제 외부 AI 요청이 있어야 합니다.').toBeGreaterThan(0)
  const call = calls.filter((entry) => entry.status === 200).at(-1)
  expect(call, '실제 AI 요청이 성공하지 않았습니다. 첨부한 공급자 응답을 확인하세요.').toBeDefined()
  const prompt = JSON.parse(call!.request.input.find((message: JsonObject) => message.role === 'user').content) as JsonObject
  const response = call!.response!
  const text = response.output_text ?? response.output?.find((entry: JsonObject) => entry.type === 'message')?.content?.find((entry: JsonObject) => entry.type === 'output_text')?.text
  expect(typeof text, '실제 AI의 JSON 텍스트 응답이 필요합니다.').toBe('string')
  const actual = JSON.parse(text) as JsonObject
  const grounded = prompt.groundedExplanation ?? prompt.groundedRecommendation
  expect(actual.headline).toBe(grounded.headline)
  expect(actual.summary).toBe(grounded.summary)
  if (prompt.groundedExplanation) {
    expect(actual.reasons.length).toBeGreaterThan(0)
    expect(actual.reasons.length).toBeLessThanOrEqual(3)
    expect(new Set(actual.reasons).size).toBe(actual.reasons.length)
    for (const reason of actual.reasons) expect(grounded.reasons).toContain(reason)
  } else {
    expect(actual.recommendedColors).toHaveLength(grounded.recommendedColors.length)
    expect(new Set(actual.recommendedColors.map((color: JsonObject) => color.role)).size).toBe(actual.recommendedColors.length)
    for (const color of actual.recommendedColors) {
      const expected = grounded.recommendedColors.find((entry: JsonObject) => entry.role === color.role)
      expect(expected).toBeDefined()
      expect(color).toEqual({ name: expected.name, role: expected.role, reason: expected.reason })
    }
    for (const candidate of actual.candidates) expect(candidate).toEqual(grounded.candidates.find((entry: JsonObject) => entry.wardrobeItemId === candidate.wardrobeItemId))
  }
}
