/**
 * 실제 옷 사진과 사전에 지정한 원단 영역으로 색 추정·색감 판정·실제 AI 추천 응답을 평가한다.
 * --live일 때만 API를 호출하며, 계정·사용권·옷장은 메모리 대체 저장소만 사용한다.
 * 원본 응답과 사진 SHA-256을 보존하고 같은 실행 폴더의 완료 항목은 재호출하지 않는다.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { RawImage } from '@huggingface/transformers'
import type { ClothingCategory, ClothingClassificationResult, ColorMode, TodayOutfitColorScheme } from '@closet/types'
import { createAiExecutor, installAiExecutor } from '../lib/ai/ai-execution.js'
import { classifyWardrobeImageWithOpenAi } from '../features/classification/openAiWardrobeClassifier.js'
import { colorHexToRgb } from '../features/classification/color.js'
import { COLOR_RULES_VERSION, getColorSchemeFitScore } from '../features/outfit/outfit-color-rules.js'
import { outfitRecommendationService } from '../features/outfit/outfit-recommendation.service.js'
import { todayOutfitRecommendationService } from '../features/outfit/today-outfit-recommendation.service.js'
import { recommendationCreditRepository } from '../features/preview-credits/recommendation-credit.repository.js'
import { wardrobeRepository } from '../features/wardrobe/wardrobe.repository.js'
import { deltaE76, median } from './color-evaluation-metrics.js'
import { writeColorEvaluationReport } from './color-evaluation-report.js'

export interface PhotoFixture {
  id: string
  path: string
  sourcePage: string
  labelledColor: string
  expectedCategories: ClothingCategory[]
  expectedColors: string[]
  expectedModes: ColorMode[]
  expectedError?: string
  mimeType?: 'image/jpeg' | 'image/png'
  garmentId?: string
  scene?: string
  rois: Array<{ x: number; y: number; width: number; height: number }>
}
interface PairFixture { id: string; items: string[]; scheme: TodayOutfitColorScheme; expected: boolean; visualExpected?: boolean }
interface RecommendationFixture {
  id: string
  kind: 'manual' | 'today'
  inventory: string[]
  selected: string[]
  category?: ClothingCategory
  scheme?: TodayOutfitColorScheme
  expectedApplied?: boolean
  expectedDesiredApplied?: boolean
}
export interface FixtureFile { photos: PhotoFixture[]; pairs: PairFixture[]; recommendations: RecommendationFixture[]; repeat?: string[]; note?: string }
interface ClassificationRecord {
  id: string
  status: 'pass' | 'review' | 'fail'
  sha256: string
  result?: ClothingClassificationResult
  error?: { code?: string; message: string }
  referenceRgb?: number[]
  roiColors?: number[][]
  medianDeltaE76?: number
  rawAiHex?: string
  rawAiMedianDeltaE76?: number
  checks?: Record<string, boolean>
}
export interface Report {
  startedAt: string
  fixtureSha256: string
  policyVersion: string
  requests: number
  apiCalls: Array<{ number: number; caseId: string; status?: number; usage?: unknown; requestId?: string | null }>
  classifications: Record<string, ClassificationRecord>
  repeats: Record<string, ClassificationRecord>
  pairs: Array<PairFixture & { extracted?: boolean; reference?: boolean; visualMatch?: boolean; status: string }>
  recommendations: Record<string, { status: string; result?: unknown; checks?: Record<string, boolean>; error?: string }>
  limits: { maxRequests: number; referenceReviewDeltaE76: number }
  note: string
}

const args = process.argv.slice(2)
const argument = (flag: string, fallback: string) => {
  const index = args.indexOf(flag)
  if (index < 0) return fallback
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`${flag} 값이 필요합니다.`)
  return args[index + 1]
}
if (!args.includes('--live')) {
  console.log('evaluate:colors --live --fixtures <사진·원단영역 JSON> --output <결과 폴더> [--phase classify|recommend|all] [--max-requests 1~64]. 기본 API 상한 24회, 실제 계정·사용권은 변경하지 않습니다.')
  process.exit(0)
}
try { loadEnvFile(resolve(import.meta.dirname, '../../.env')) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
if (!process.env.OPENAI_API_KEY?.trim()) throw new Error('AI 평가용 API 키가 설정되지 않았습니다.')
const fixturePath = resolve(argument('--fixtures', 'color-fixtures.json'))
const output = resolve(argument('--output', '.playwright-mcp/color-evaluation'))
const phase = argument('--phase', 'all')
const maxRequests = Number(argument('--max-requests', '24'))
if (!Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 64) throw new Error('평가 요청 상한은 1~64의 정수여야 합니다.')
if (!['classify', 'recommend', 'all'].includes(phase)) throw new Error('올바른 평가 단계가 필요합니다.')
const fixtureText = await readFile(fixturePath, 'utf8')
const fixtureSha256 = createHash('sha256').update(fixtureText).digest('hex')
const fixtures = JSON.parse(fixtureText) as FixtureFile
if (!Array.isArray(fixtures.photos) || fixtures.photos.length === 0) throw new Error('검증할 사진이 없습니다.')
await mkdir(output, { recursive: true })
const reportPath = resolve(output, 'live-report.json')
let report: Report
try { report = JSON.parse(await readFile(reportPath, 'utf8')) } catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  report = { startedAt: new Date().toISOString(), fixtureSha256, policyVersion: COLOR_RULES_VERSION, requests: 0, apiCalls: [], classifications: {}, repeats: {}, pairs: [], recommendations: {},
    limits: { maxRequests, referenceReviewDeltaE76: 12 },
    note: fixtures.note ?? '공개 실물 옷 사진의 표적 사례 평가입니다. 색차는 사진에서 사전 선택한 원단 영역과 비교한 CIE76 값입니다. 12 초과는 수동 검토 표시이며 보편적인 합격 기준이 아닙니다. 실제 원단 측색·대규모 정확도·취향 만족도를 측정하지 않습니다.' }
}
if (report.policyVersion !== COLOR_RULES_VERSION) throw new Error('색 판정 버전이 바뀌었습니다. 새 결과 폴더를 사용해 주세요.')
if (report.fixtureSha256 !== fixtureSha256) throw new Error('평가 사진·영역·기대값이 바뀌었습니다. 새 결과 폴더를 사용해 주세요.')
if (report.limits.maxRequests !== maxRequests) throw new Error('평가 요청 상한이 바뀌었습니다. 새 결과 폴더를 사용해 주세요.')
let saving = Promise.resolve()
const save = () => saving = saving.then(() => writeFile(reportPath, JSON.stringify(report, null, 2)))
const context = new AsyncLocalStorage<string>()
const originalFetch = globalThis.fetch
globalThis.fetch = async (url, init) => {
  if (!String(url).startsWith('https://api.openai.com/v1/responses')) throw new Error('평가 중 예상하지 못한 외부 요청입니다.')
  if (report.requests >= report.limits.maxRequests) throw new Error(`평가 API 요청 상한 ${report.limits.maxRequests}회에 도달했습니다.`)
  const number = ++report.requests
  const call: Report['apiCalls'][number] = { number, caseId: context.getStore() ?? 'unknown' }
  report.apiCalls.push(call)
  await save()
  const response = await originalFetch(url, init)
  const payload = await response.clone().json().catch(() => null) as { usage?: unknown } | null
  call.status = response.status
  call.usage = payload?.usage
  call.requestId = response.headers.get('x-request-id')
  await writeFile(resolve(output, `response-${number}.json`), JSON.stringify({ caseId: call.caseId, status: response.status, payload }, null, 2))
  await save()
  return response
}

/** 원본 사진은 바꾸지 않고, 지정 영역의 채널별 중앙값을 독립적인 비교 색으로 얻는다. */
async function sampleFabric(bytes: Buffer, photo: PhotoFixture) {
  const image = await RawImage.fromBlob(new Blob([Uint8Array.from(bytes)], { type: photo.mimeType ?? 'image/jpeg' }))
  const colors: number[][] = []
  for (const roi of photo.rois) {
    if ([roi.x, roi.y, roi.width, roi.height].some((value) => !Number.isFinite(value) || value < 0 || value > 1) || roi.x + roi.width > 1 || roi.y + roi.height > 1 || roi.width === 0 || roi.height === 0) throw new Error('잘못된 원단 표본 영역입니다.')
    const { data, info } = await image.toSharp().extract({ left: Math.round(roi.x * image.width), top: Math.round(roi.y * image.height), width: Math.max(1, Math.floor(roi.width * image.width)), height: Math.max(1, Math.floor(roi.height * image.height)) }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const channels = [[], [], []] as number[][]
    for (let offset = 0; offset < data.length; offset += info.channels) for (let channel = 0; channel < 3; channel++) channels[channel].push(data[offset + channel])
    colors.push(channels.map((channel) => Math.round(median(channel))))
  }
  return colors
}

/** 같은 원본의 완료 결과만 재사용하고, 분류·색 계열·사진 픽셀 오차를 구분해 기록한다. */
async function classify(photo: PhotoFixture, repeated = false) {
  const records = repeated ? report.repeats : report.classifications
  const bytes = await readFile(resolve(dirname(fixturePath), photo.path))
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  if (records[photo.id]) {
    if (records[photo.id].sha256 !== sha256) throw new Error('원본 사진이 바뀌었습니다. 새 결과 폴더를 사용해 주세요.')
    return
  }
  await context.run(`${repeated ? 'repeat' : 'classification'}:${photo.id}`, async () => {
    const record: ClassificationRecord = { id: photo.id, status: 'fail', sha256 }
    try {
      const result = await classifyWardrobeImageWithOpenAi(bytes, photo.mimeType ?? 'image/jpeg')
      const call = [...report.apiCalls].reverse().find((entry) => entry.caseId === context.getStore())
      const { payload } = JSON.parse(await readFile(resolve(output, `response-${call!.number}.json`), 'utf8')) as {
        payload: { output_text?: string; output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> }
      }
      const rawText = payload.output_text ?? payload.output?.find((entry) => entry.type === 'message')?.content?.find((entry) => entry.type === 'output_text')?.text
      if (rawText) {
        const rawHex = (JSON.parse(rawText) as { colorHex?: string }).colorHex
        if (rawHex && colorHexToRgb(rawHex)) record.rawAiHex = rawHex.toUpperCase()
      }
      const roiColors = await sampleFabric(bytes, photo)
      const checks = { accepted: !photo.expectedError, category: photo.expectedCategories.includes(result.category), color: photo.expectedColors.includes(result.colorName), composition: photo.expectedModes.includes(result.colorMode) }
      Object.assign(record, { result, roiColors, checks, referenceRgb: roiColors.length ? [0, 1, 2].map((channel) => Math.round(median(roiColors.map((color) => color[channel])))) : undefined })
      if (roiColors.length && result.colorMode === 'solid') record.medianDeltaE76 = median(roiColors.map((color) => deltaE76(color, result.colorRgb)))
      if (roiColors.length && result.colorMode === 'solid' && record.rawAiHex) record.rawAiMedianDeltaE76 = median(roiColors.map((color) => deltaE76(color, colorHexToRgb(record.rawAiHex)!)))
      record.status = !checks.accepted || !checks.category || !checks.composition ? 'fail'
        : !checks.color || (record.medianDeltaE76 ?? 0) > report.limits.referenceReviewDeltaE76 ? 'review' : 'pass'
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined
      record.error = { code, message: error instanceof Error ? error.message : String(error) }
      record.status = photo.expectedError && code === photo.expectedError ? 'pass' : 'fail'
    }
    records[photo.id] = record
    await save()
    console.log(JSON.stringify({ photo: photo.id, repeated, status: record.status, color: record.result?.colorDetailName, hex: record.result?.colorHex, deltaE76: record.medianDeltaE76, error: record.error }))
  })
}

type WardrobeItem = Awaited<ReturnType<typeof wardrobeRepository.findMany>>[number]
const userId = 'isolated-live-color-evaluation'
let inventory: WardrobeItem[] = []
const settlements: Array<unknown> = []
installAiExecutor(createAiExecutor())
// 실제 계정 대신 사진에서 얻은 속성을 담은 평가 전용 메모리 옷장을 사용한다.
Object.assign(wardrobeRepository, {
  findMany: async (_user: string, filter: { category?: ClothingCategory }) => inventory.filter((item) => !filter.category || item.category === filter.category),
  findManyOwnedByIds: async (_user: string, ids: string[]) => inventory.filter((item) => ids.includes(item.id)),
})
Object.assign(recommendationCreditRepository, {
  reserve: async () => ({ id: 'evaluation-only', token: 'evaluation-only', resultText: null }),
  settle: async (...values: unknown[]) => { settlements.push(values); return true },
})

/** 색·유형·관찰 속성은 실제 사진 분석값을 사용하고, 날짜·계절만 색 평가용으로 고정한다. */
function toItem(id: string, reference = false): WardrobeItem | null {
  const record = report.classifications[id]
  if (!record?.result) return null
  const fixture = fixtures.photos.find((photo) => photo.id === id)!
  const result = record.result
  const at = new Date('2026-11-02T00:00:00Z')
  const colorHex = reference && record.referenceRgb ? `#${record.referenceRgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}` : result.colorHex
  return { id, userId, name: result.suggestedName, category: reference ? fixture.expectedCategories[0] : result.category, additionalCategories: [], subcategory: result.subcategory,
    colorName: result.colorName, colorDetailName: result.colorDetailName, colorHex, colorMode: reference ? fixture.expectedModes[0] : result.colorMode,
    fashionAttributes: JSON.parse(JSON.stringify(result.fashionAttributes ?? null)), seasons: ['autumn'], classificationStatus: 'classified', classificationConfidence: result.confidence,
    classificationModel: result.model, classificationCandidates: JSON.parse(JSON.stringify(result.candidates)), tags: [], wearCount: 0, lastWornAt: null, archivedAt: null,
    createdAt: at, updatedAt: at, displayImageAssetId: null, originalImageAssetId: null, displayImageAsset: null, originalImageAsset: null,
    brandName: null, sizeLabel: null, shoulderWidthCm: null, chestWidthCm: null, sleeveLengthCm: null, totalLengthCm: null, waistWidthCm: null,
    hipWidthCm: null, inseamCm: null, thighWidthCm: null, riseCm: null, hemWidthCm: null }
}

/** 사진에서 얻은 속성을 실제 서비스에 넣어 요청 색감과 실제 AI 응답 수용 여부를 따로 검사한다. */
async function evaluateRecommendations() {
  report.pairs = fixtures.pairs.map((pair) => {
    const extracted = pair.items.map((id) => toItem(id))
    const reference = pair.items.map((id) => toItem(id, true))
    if (extracted.some((item) => !item) || reference.some((item) => !item)) return { ...pair, status: 'blocked' }
    const a = getColorSchemeFitScore(extracted as WardrobeItem[], pair.scheme) > 0
    const b = getColorSchemeFitScore(reference as WardrobeItem[], pair.scheme) > 0
    return { ...pair, extracted: a, reference: b, visualMatch: pair.visualExpected === undefined ? undefined : a === pair.visualExpected,
      status: a === pair.expected && b === pair.expected ? 'pass' : 'fail' }
  })
  await save()
  for (const fixture of fixtures.recommendations) {
    if (report.recommendations[fixture.id]) continue
    await context.run(`recommendation:${fixture.id}`, async () => {
      const items = fixture.inventory.map((id) => toItem(id))
      if (items.some((item) => !item)) { report.recommendations[fixture.id] = { status: 'blocked', error: '필요한 사진의 분석 결과가 없습니다.' }; await save(); return }
      inventory = items as WardrobeItem[]
      try {
        if (fixture.kind === 'manual') {
          const result = await outfitRecommendationService.recommend(userId, { selectedItemIds: fixture.selected, targetCategory: fixture.category! })
          const checks = { actualAiResponseAccepted: result.source === 'ai', ownedCandidates: result.candidates.every(({ item }) => fixture.inventory.includes(item.id)), hasCandidates: result.candidates.length > 0,
            validColors: result.recommendedColors.length > 0 && result.recommendedColors.every((color) => Boolean(colorHexToRgb(color.hex))) }
          report.recommendations[fixture.id] = { status: Object.values(checks).every(Boolean) ? 'pass' : 'fail', checks, result }
        } else {
          const result = await todayOutfitRecommendationService.recommend(userId, { date: '2026-11-02', season: 'autumn', baseItemId: fixture.selected[0], colorScheme: fixture.scheme })
          const checks = { actualAiResponseAccepted: result.source === 'ai', ready: result.ready, applied: result.colorSchemeApplied === fixture.expectedApplied,
            baseItemKept: result.items.some((item) => item.id === fixture.selected[0]),
            requestedColorMet: fixture.expectedDesiredApplied === undefined || result.colorSchemeApplied === fixture.expectedDesiredApplied }
          report.recommendations[fixture.id] = { status: Object.values(checks).every(Boolean) ? 'pass' : 'fail', checks, result }
        }
      } catch (error) { report.recommendations[fixture.id] = { status: 'fail', error: error instanceof Error ? error.message : String(error) } }
      await save()
      console.log(JSON.stringify({ recommendation: fixture.id, ...report.recommendations[fixture.id], result: undefined }))
    })
  }
}

try {
  if (phase !== 'recommend') {
    // 사진 2장씩 실행해 공급자 요청이 겹쳐도 각 응답과 평가 사례의 연결을 보존한다.
    for (let index = 0; index < fixtures.photos.length; index += 2) await Promise.all(fixtures.photos.slice(index, index + 2).map((photo) => classify(photo)))
    for (const id of fixtures.repeat ?? []) await classify(fixtures.photos.find((photo) => photo.id === id)!, true)
  }
  if (phase !== 'classify') await evaluateRecommendations()
} finally {
  globalThis.fetch = originalFetch
  await save()
}
console.log(JSON.stringify({ report: reportPath, requests: report.requests, classifications: Object.values(report.classifications).map(({ id, status }) => ({ id, status })), pairs: report.pairs, recommendations: Object.entries(report.recommendations).map(([id, result]) => ({ id, status: result.status })), localSettlements: settlements.length }))
await writeColorEvaluationReport(report, fixtures, dirname(fixturePath), output)
if (Object.values(report.classifications).some((record) => record.status === 'fail') || report.pairs.some((pair) => pair.status !== 'pass') || Object.values(report.recommendations).some((result) => result.status !== 'pass')) process.exitCode = 1
