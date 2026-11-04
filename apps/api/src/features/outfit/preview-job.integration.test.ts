import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import test from 'node:test'
import { prisma } from '../../lib/prisma.js'
import { ensureAiStorage } from '../../lib/ai/ai-storage.js'
import { aiExecutor, aiInputKey } from '../../lib/ai/ai-execution.js'
import { createSharedAiExecutor } from '../../lib/ai/shared-ai-executor.js'
import { wardrobeRepository } from '../wardrobe/wardrobe.repository.js'
import { userRepository } from '../user/user.repository.js'
import { imageService } from '../image/image.service.js'
import { outfitPreviewService } from './outfit-preview.service.js'
import { previewJobRepository } from './preview-job.repository.js'
import { previewJobService } from './preview-job.service.js'
import { processPreviewJob, recoverPreviewJobs } from './preview-job.worker.js'
import { pushService } from '../push/push.service.js'

test('MongoDB 이미지 작업 복원 통합 검증', { skip: !process.env.AI_INTEGRATION_DATABASE }, async (t) => {
  await ensureAiStorage()
  t.after(() => prisma.$disconnect())
  const userId = randomBytes(12).toString('hex')
  t.afterEach(async () => { await prisma.previewCreditDay.deleteMany({ where: { userId } }); await prisma.aiCreditWallet.deleteMany({ where: { userId } }) })
  const items = await Promise.all([
    prisma.wardrobeItem.create({ data: { userId, name: '테스트 상의', category: 'top', classificationStatus: 'classified' } }),
    prisma.wardrobeItem.create({ data: { userId, name: '테스트 하의', category: 'bottom', classificationStatus: 'classified' } }),
  ]).then((rows) => rows.map((item) => ({ ...item, displayImageAsset: { deliveryUrl: `https://fixture.invalid/${item.id}.png` } })))
  t.after(() => prisma.wardrobeItem.deleteMany({ where: { id: { in: items.map((item) => item.id) } } }))
  t.mock.method(wardrobeRepository, 'findManyOwnedWithImagesByIds', async () => items as Awaited<ReturnType<typeof wardrobeRepository.findManyOwnedWithImagesByIds>>)
  t.mock.method(userRepository, 'findViewerById', async () => null)
  t.mock.method(aiExecutor, 'run', createSharedAiExecutor({ pollMs: 5 }).run)
  t.mock.method(pushService, 'sendCompletion', async () => true)
  t.mock.method(pushService, 'sendFailure', async () => true)
  const start = (requestId = randomUUID()) => previewJobService.start(userId, { selectedItemIds: items.map((item) => item.id), requestId })

  await t.test('동시 접수·응답 유실 후 재전송은 같은 작업 ID를 반환한다', async () => {
    const firstId = randomUUID()
    const secondId = randomUUID()
    const [one, two] = await Promise.all([start(firstId), start(secondId)])
    assert.equal(one.id, two.id)
    assert.equal((await start(firstId)).id, one.id)
    assert.equal((await start(secondId)).id, one.id)
    assert.equal(await prisma.aiQuota.findUnique({ where: { id: aiInputKey([userId, 'preview']) } }), null)
    await assert.rejects(previewJobService.get(randomBytes(12).toString('hex'), one.id), { code: 'AI_JOB_NOT_FOUND' })
    await prisma.aiPreviewJob.update({ where: { id: one.id }, data: { status: 'failed' } })
  })

  await t.test('이미지 API 전송 전 서버가 끊기면 새 서버가 대기 상태를 복원한다', async () => {
    const job = await start()
    const claimed = await previewJobRepository.claim()
    assert.equal(claimed?.id, job.id)
    await prisma.aiPreviewJob.update({ where: { id: job.id }, data: { leaseUntil: new Date(Date.now() - 1000) } })
    await recoverPreviewJobs()
    assert.equal((await previewJobService.get(userId, job.id)).status, 'queued')
    await prisma.aiPreviewJob.update({ where: { id: job.id }, data: { status: 'failed' } })
  })

  await t.test('API 전송 후 결과가 없으면 자동 재생성하지 않고 중단을 알린다', async () => {
    const job = await start()
    const claimed = await previewJobRepository.claim()
    assert.ok(claimed)
    await previewJobRepository.markRequestStarted(job.id, claimed.leaseToken)
    await prisma.aiPreviewJob.update({ where: { id: job.id }, data: { leaseUntil: new Date(Date.now() - 1000) } })
    await recoverPreviewJobs()
    const restored = await previewJobService.get(userId, job.id)
    assert.equal(restored.status, 'interrupted')
    assert.equal(restored.errorCode, 'AI_INTERRUPTED')
    assert.match(restored.path, /preview=failed/)
  })

  await t.test('이미지 저장 직후 끊긴 작업은 저장된 자산을 찾아 완료로 복원한다', async () => {
    const job = await start()
    const claimed = await previewJobRepository.claim()
    assert.ok(claimed)
    await previewJobRepository.markRequestStarted(job.id, claimed.leaseToken)
    const asset = await prisma.imageAsset.create({ data: { userId, cloudflareImageId: randomUUID(), aiPreviewJobId: job.id, kind: 'outfitGenerated', uploadStatus: 'ready', mimeType: 'image/png', metadata: { model: 'fixture-model' } } })
    await prisma.aiPreviewJob.update({ where: { id: job.id }, data: { leaseUntil: new Date(Date.now() - 1000) } })
    await recoverPreviewJobs()
    const restored = await previewJobService.get(userId, job.id)
    assert.equal(restored.status, 'completed')
    assert.equal(restored.imageAssetId, asset.id)
    assert.match(restored.path, /previewAssetId=/)
    assert.equal(await previewJobService.acknowledge(userId, job.id), true)
    assert.ok((await previewJobService.list(userId)).every((entry) => entry.id !== job.id))
  })

  await t.test('작업 처리기는 전송 기록을 남긴 뒤 결과를 영속 저장한다', async (t) => {
    const job = await start()
    const claimed = await previewJobRepository.claim()
    assert.ok(claimed)
    const generate = t.mock.method(outfitPreviewService, 'generate', async (...[_user, _ids, _style, options]: Parameters<typeof outfitPreviewService.generate>) => {
      await options?.onBeforeRequest?.()
      assert.ok((await prisma.aiPreviewJob.findUniqueOrThrow({ where: { id: job.id } })).requestStartedAt)
      return { imageBase64: 'fixture', mimeType: 'image/png' as const, model: 'fixture-model' }
    })
    const assetId = randomBytes(12).toString('hex')
    t.mock.method(imageService, 'storeGeneratedImage', async (...[_user, input]: Parameters<typeof imageService.storeGeneratedImage>) => {
      assert.equal(input.jobId, job.id)
      return { id: assetId } as Awaited<ReturnType<typeof imageService.storeGeneratedImage>>
    })
    await processPreviewJob(claimed)
    const restored = await previewJobService.get(userId, job.id)
    assert.equal(restored.status, 'completed')
    assert.equal(restored.imageAssetId, assetId)
    assert.equal(generate.mock.callCount(), 1)
  })
})
