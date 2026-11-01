import { loadEnvFile } from 'node:process'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

try { loadEnvFile(resolve(import.meta.dirname, '../../.env')) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
if (!process.env.DATABASE_URL) throw new Error('테스트 DB 연결 설정이 필요합니다.')
const database = new URL(process.env.DATABASE_URL)
database.pathname = `/closet_ai_storage_test_${randomBytes(6).toString('hex')}`
process.env.DATABASE_URL = database.toString()
const { prisma } = await import('../lib/prisma.js')
const { imageService } = await import('../features/image/image.service.js')
const { imageRepository } = await import('../features/image/image.repository.js')
const { cloudflareImagesClient } = await import('../features/image/cloudflare-images.client.js')
const root = resolve(import.meta.dirname, '../../../..')
const file = resolve(process.argv[2] ?? resolve(root, '.playwright-mcp/ai-evaluation/generated-lookbook.png'))
const reportPath = resolve(root, '.playwright-mcp/ai-evaluation/storage-report.json')
const userId = randomBytes(12).toString('hex')
let created: { id: string; cloudflareImageId: string } | null = null
const report = { passed: false, cleanupConfirmed: false, note: '기존 평가 이미지 재사용. 새 AI 요청·실제 계정 DB 변경 없이 별도 테스트 DB와 이 검증에서 만든 자산만 사용한다.' }
try {
  const bytes = await readFile(file)
  created = await imageService.storeGeneratedImage(userId, { imageBase64: bytes.toString('base64'), mimeType: 'image/png', model: 'evaluation-fixture', jobId: randomUUID(), temporary: true })
  const image = await imageService.getGeneratedImage(userId, created.id)
  const response = await fetch(image.imageUrl, { signal: AbortSignal.timeout(15_000) })
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/') || (await response.arrayBuffer()).byteLength === 0) throw new Error('저장한 생성 이미지 URL 조회 실패')
  report.passed = true
} finally {
  if (created) {
    // 이 실행에서 만든 자산 하나만 정리한다. 일반 사용자 이미지 정리 CLI는 호출하지 않는다.
    await cloudflareImagesClient.deleteImage(created.cloudflareImageId)
    await imageRepository.remove(created.id)
    report.cleanupConfirmed = true
  }
  await writeFile(reportPath, JSON.stringify(report, null, 2))
  await prisma.$disconnect()
}
console.log(JSON.stringify(report))
