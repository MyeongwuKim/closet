import { loadEnvFile } from 'node:process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { RawImage } from '@huggingface/transformers'
import type { ClothingCategory } from '@prisma/client'
import { createAiExecutor, installAiExecutor } from '../lib/ai/ai-execution.js'
import { classifyWardrobeImageWithOpenAi } from '../features/classification/openAiWardrobeClassifier.js'
import { analyzeGarmentSizeChartWithOpenAi } from '../features/classification/openAiGarmentSizeAnalyzer.js'
import { outfitRecommendationService } from '../features/outfit/outfit-recommendation.service.js'
import { todayOutfitRecommendationService } from '../features/outfit/today-outfit-recommendation.service.js'
import { hasGroundedFitDescription } from '../features/outfit/recommendation-evidence.js'
import { isRecommendationText } from '../features/outfit/recommendation-text.js'
import { outfitPreviewService } from '../features/outfit/outfit-preview.service.js'
import { wardrobeRepository } from '../features/wardrobe/wardrobe.repository.js'
import { userRepository } from '../features/user/user.repository.js'

try { loadEnvFile(resolve(import.meta.dirname, '../../.env')) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
const args = process.argv.slice(2)
if (!args.includes('--live')) {
  console.log('실제 AI 평가: evaluate:ai --live [--include-image] [--output <결과 폴더>]. 합성 옷·사이즈표만 전송하며 실행 전체에서 API 요청은 최대 12회입니다.')
  process.exit(0)
}
if (!process.env.OPENAI_API_KEY?.trim()) throw new Error('AI 평가용 API 키가 설정되지 않았습니다.')
const root = resolve(import.meta.dirname, '../../../..')
const outputArg = args.indexOf('--output')
const output = resolve(outputArg >= 0 ? args[outputArg + 1]! : resolve(root, '.playwright-mcp/ai-evaluation'))
await mkdir(output, { recursive: true })
const reportPath = resolve(output, 'report.json')
type CaseResult = { name: string; passed: boolean; durationMs: number; details: unknown }
let report: { startedAt: string; requests: number; cases: CaseResult[]; history?: CaseResult[]; note: string }
try { report = JSON.parse(await readFile(reportPath, 'utf8')) } catch { report = { startedAt: new Date().toISOString(), requests: 0, cases: [], note: '합성 샘플의 구조·조건 준수 평가다. 실제 옷의 착용감·일반적 추천 취향·이미지 일치율을 측정하지 않는다.' } }
const save = () => writeFile(reportPath, JSON.stringify(report, null, 2))
const originalFetch = globalThis.fetch
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.openai.com/')) {
    if (report.requests >= 12) throw new Error('평가 API 호출 상한 12회에 도달했습니다.')
    report.requests += 1
    await save()
  }
  const response = await originalFetch(url, init)
  if (String(url).startsWith('https://api.openai.com/v1/responses')) {
    const body = await response.clone().json().catch(() => null)
    await writeFile(resolve(output, `response-${report.requests}.json`), JSON.stringify(body, null, 2))
  }
  return response
}
// 실제 계정 DB·공유 한도·이미지 저장소를 바꾸지 않는 독립 평가다.
installAiExecutor(createAiExecutor())
const userId = 'synthetic-ai-evaluation'
const shirt = await readFile(resolve(root, 'tests/support/mock-shirt.png'))
const render = async (svg: string) => {
  const image = await RawImage.fromBlob(new Blob([svg], { type: 'image/svg+xml' }))
  return image.toSharp().png().toBuffer()
}
const pants = await render('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><path fill="#c9b58c" stroke="#907e5b" stroke-width="5" d="M90 40H310L338 560H225L200 190L175 560H62Z"/><path stroke="#907e5b" stroke-width="4" fill="none" d="M90 75H310M200 75V190M98 90L95 160M302 90L305 160"/></svg>')
const columns = [60, 200, 460, 720, 880]
const table = [['Size', 'Shoulder', 'Chest circumference', 'Sleeve', 'Length'], ['S', '44', '104', '20', '68'], ['M', '46', '110', '21', '70'], ['L', '48', '116', '22', '72']]
const cells = table.flatMap((row, rowIndex) => row.map((value, column) => `<text x="${columns[column]}" y="${115 + rowIndex * 70}" text-anchor="middle">${value}</text>`)).join('')
const chart = await render(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="400"><rect width="100%" height="100%" fill="white"/><g font-family="Arial" font-size="24" fill="black"><text x="30" y="45">Garment measurements (cm)</text>${cells}</g><g stroke="#aaa"><path d="M20 135H980M20 205H980M20 275H980M20 345H980M110 70V345M290 70V345M630 70V345M800 70V345"/></g></svg>`)

await writeFile(resolve(output, 'reference-shirt.png'), shirt)
await writeFile(resolve(output, 'reference-pants.png'), pants)
await writeFile(resolve(output, 'reference-size-chart.png'), chart)

type WardrobeItem = Awaited<ReturnType<typeof wardrobeRepository.findMany>>[number]
function item(id: string, category: ClothingCategory, name: string, colorName: string, colorHex: string, image: Buffer): WardrobeItem {
  const at = new Date('2026-10-30')
  return { id, userId, name, category, additionalCategories: [], subcategory: category === 'top' ? '반팔 티셔츠' : '일반 긴바지',
    colorName, colorHex, colorDetailName: colorName, colorMode: 'solid', seasons: ['autumn', 'spring'], classificationStatus: 'classified',
    wearCount: 0, lastWornAt: null, archivedAt: null, fashionAttributes: null, updatedAt: at, createdAt: at, tags: [],
    brandName: null, displayImageAssetId: `fixture-${id}`, originalImageAssetId: null, classificationConfidence: null,
    classificationModel: null, classificationCandidates: null, sizeLabel: null, shoulderWidthCm: null, chestWidthCm: null,
    sleeveLengthCm: null, totalLengthCm: null, waistWidthCm: null, hipWidthCm: null, inseamCm: null, thighWidthCm: null, riseCm: null, hemWidthCm: null,
    displayImageAsset: { id: `fixture-${id}`, userId, createdAt: at, updatedAt: at, cloudflareImageId: id, kind: 'wardrobeCutout', uploadStatus: 'ready',
      retention: 'permanent', expiresAt: null, deliveryUrl: `data:image/png;base64,${image.toString('base64')}`, deliveryVariant: null,
      originalFilename: null, storageFilename: null, mimeType: 'image/png', width: null, height: null, metadata: null, aiPreviewJobId: null },
    originalImageAsset: null,
  }
}
const items = [item('top', 'top', '네이비 반팔 티셔츠', '네이비', '#334354', shirt), item('pants', 'bottom', '베이지 긴바지', '베이지', '#c9b58c', pants)]
Object.assign(wardrobeRepository, {
  findMany: async (_user: string, filter: { category?: ClothingCategory }) => items.filter((item) => !filter.category || item.category === filter.category),
  findManyOwnedByIds: async (_user: string, ids: string[]) => items.filter((item) => ids.includes(item.id)),
  findManyOwnedWithImagesByIds: async (_user: string, ids: string[]) => items.filter((item) => ids.includes(item.id)),
})
Object.assign(userRepository, { findViewerById: async () => null })

function check(condition: unknown, message: string, details?: unknown): asserts condition { if (!condition) throw Object.assign(new Error(message), { details }) }
const refreshArg = args.indexOf('--refresh-cases')
const refreshCases = new Set(refreshArg >= 0 ? args[refreshArg + 1]?.split(',') : [])
async function evaluate(name: string, operation: () => Promise<unknown>) {
  if (report.cases.some((result) => result.name === name) && !args.includes('--retry-failed') && !refreshCases.has(name)) return
  if (report.cases.some((result) => result.name === name && result.passed) && !refreshCases.has(name)) return
  const previous = report.cases.find((result) => result.name === name)
  if (previous) (report.history ??= []).push(previous)
  const started = Date.now()
  try { const details = await operation(); report.cases = report.cases.filter((entry) => entry.name !== name); report.cases.push({ name, passed: true, durationMs: Date.now() - started, details }) }
  catch (error) { report.cases = report.cases.filter((entry) => entry.name !== name); report.cases.push({ name, passed: false, durationMs: Date.now() - started, details: error instanceof Error ? { message: error.message, result: 'details' in error ? error.details : null } : 'unknown failure' }) }
  await save()
  console.log(`${name}: ${report.cases.at(-1)?.passed ? 'passed' : 'failed'}`)
}

await evaluate('shirt-classification', async () => {
  const result = await classifyWardrobeImageWithOpenAi(shirt, 'image/png')
  check(result.category === 'top', '상의 분류 실패')
  check(result.colorName === '네이비' || result.colorName === '블루', '참조 이미지의 청색 계열과 다른 대표색')
  return { category: result.category, subcategory: result.subcategoryLabel, color: result.colorName, model: result.model }
})
await evaluate('size-chart-conversion', async () => {
  const result = await analyzeGarmentSizeChartWithOpenAi(chart, 'image/png', 'top')
  for (const [size, chest, length] of [['S', 52, 68], ['M', 55, 70], ['L', 58, 72]] as const) {
    const row = result.rows.find((row) => row.sizeLabel === size)
    check(row?.chestWidthCm === chest && row.totalLengthCm === length, `${size} 둘레→단면 또는 총장 추출 실패`, result)
  }
  check(result.notes.every((note) => /[가-힣]/u.test(note) && !/[(:,-]\s*$/u.test(note)), '설명은 완결된 한국어 문장이어야 함')
  return result
})
await evaluate('color-recommendation', async () => {
  const result = await outfitRecommendationService.recommend(userId, { selectedItemIds: ['top'], targetCategory: 'bottom', mode: 'colors' })
  check(result.source === 'ai', 'AI 색 추천 실패로 규칙 기반 결과가 반환됨')
  check(result.recommendedColors.length === 3 && new Set(result.recommendedColors.map((color) => color.role)).size === 3, '색 추천 역할 누락')
  check([result.headline, result.summary, ...result.recommendedColors.map((color) => color.reason)].every((text) => isRecommendationText(text, 1000)), '색 추천 설명에 내부 속성·코드가 노출됨')
  return result
})
await evaluate('wardrobe-candidate-recommendation', async () => {
  const result = await outfitRecommendationService.recommend(userId, { selectedItemIds: ['top'], targetCategory: 'bottom', mode: 'items' })
  check(result.source === 'ai' && result.candidates.length === 1 && result.candidates[0]?.item.id === 'pants', '실제 후보 안의 AI 추천 실패')
  check(hasGroundedFitDescription([result.headline, result.summary, ...result.candidates.map((candidate) => candidate.reason)].join(' '), items), '관찰하지 않은 핏 단정')
  return { source: result.source, model: result.model, headline: result.headline, candidates: result.candidates.map(({ item, reason }) => ({ id: item.id, reason })) }
})
await evaluate('today-outfit', async () => {
  const result = await todayOutfitRecommendationService.recommend(userId, { date: '2026-10-30', season: 'autumn', baseItemId: 'top' })
  check(result.ready && result.source === 'ai' && result.items.some((item) => item.id === 'top') && result.items.some((item) => item.id === 'pants'), '기준 옷과 기본 구성을 유지한 AI 설명 실패', { source: result.source, summary: result.summary, reasons: result.reasons })
  check(hasGroundedFitDescription([result.headline, result.summary, ...result.reasons].join(' '), items), '관찰하지 않은 핏 단정')
  return { source: result.source, model: result.model, headline: result.headline, summary: result.summary, reasons: result.reasons, itemIds: result.items.map((item) => item.id) }
})
if (args.includes('--include-image')) await evaluate('lookbook-image', async () => {
  const result = await outfitPreviewService.generate(userId, ['top', 'pants'])
  const bytes = Buffer.from(result.imageBase64, 'base64')
  check(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'PNG 결과가 아님')
  await writeFile(resolve(output, 'generated-lookbook.png'), bytes)
  const image = await RawImage.fromBlob(new Blob([bytes], { type: result.mimeType }))
  check(image.width > 0 && image.height > image.width, '세로형 룩북 생성 실패')
  return { model: result.model, width: image.width, height: image.height, bytes: bytes.length, artifact: 'generated-lookbook.png', visualReviewRequired: true }
})
globalThis.fetch = originalFetch
console.log(JSON.stringify({ requests: report.requests, passed: report.cases.filter((entry) => entry.passed).length, failed: report.cases.filter((entry) => !entry.passed).length, output: reportPath }))
if (report.cases.some((entry) => !entry.passed)) process.exitCode = 1
