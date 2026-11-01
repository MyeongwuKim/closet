import assert from 'node:assert/strict'
import test from 'node:test'
import type { AiPreviewJob } from '@prisma/client'
import { ServiceError } from '../../graphql/errors.js'
import { aiExecutor, createAiExecutor } from '../../lib/ai/ai-execution.js'
import { imageService } from '../image/image.service.js'
import { pushService } from '../push/push.service.js'
import { outfitPreviewService } from './outfit-preview.service.js'
import { previewJobRepository } from './preview-job.repository.js'
import { processPreviewJob } from './preview-job.worker.js'

const job: AiPreviewJob & { leaseToken: string } = {
  creditDayId: null, creditSource: null, creditState: null,
  id: 'job-test', userId: 'viewer-test', requestKeys: ['request-test'], inputKey: 'input-test', fingerprint: 'fingerprint-test',
  selectedItemIds: ['top', 'bottom'], style: null, status: 'processing', leaseToken: 'lease-test', leaseUntil: new Date(Date.now() + 90_000),
  requestStartedAt: null, attempts: 1, imageAssetId: null, model: null, errorCode: null, errorMessage: null,
  acknowledgedAt: null, createdAt: new Date(), updatedAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000),
}

test('이미지 저장이 끝난 작업만 완료 알림을 보내며 결과 경로에 자산 ID를 넣는다', async (t) => {
  t.mock.method(aiExecutor, 'run', createAiExecutor().run)
  t.mock.method(previewJobRepository, 'markRequestStarted', async () => ({ count: 1 }))
  t.mock.method(outfitPreviewService, 'generate', async (...[_user, _ids, _style, options]: Parameters<typeof outfitPreviewService.generate>) => {
    await options?.onBeforeRequest?.()
    return { imageBase64: 'fixture', mimeType: 'image/png', model: 'model-test' }
  })
  t.mock.method(imageService, 'storeGeneratedImage', async () => ({ id: 'asset-test' }) as Awaited<ReturnType<typeof imageService.storeGeneratedImage>>)
  const completed = t.mock.method(previewJobRepository, 'complete', async () => ({ count: 1 }))
  const push = t.mock.method(pushService, 'sendCompletion', async (userId: string, kind: string, data?: Record<string, string>) => {
    assert.equal(userId, job.userId)
    assert.equal(kind, 'outfit-preview')
    assert.equal(data?.previewAssetId, 'asset-test')
    assert.match(data?.path ?? '', /previewAssetId=asset-test/)
    return true
  })
  await processPreviewJob(job)
  assert.equal(completed.mock.callCount(), 1)
  assert.equal(push.mock.callCount(), 1)
})

test('작업 임대가 사라졌으면 유료 요청 직전 검사를 통과하지 못한다', async (t) => {
  t.mock.method(aiExecutor, 'run', createAiExecutor().run)
  t.mock.method(previewJobRepository, 'markRequestStarted', async () => ({ count: 0 }))
  const failed = t.mock.method(previewJobRepository, 'fail', async () => ({ count: 0 }))
  let requests = 0
  t.mock.method(outfitPreviewService, 'generate', async (...[_user, _ids, _style, options]: Parameters<typeof outfitPreviewService.generate>) => {
    await options?.onBeforeRequest?.()
    requests += 1
    return { imageBase64: 'fixture', mimeType: 'image/png', model: 'model-test' }
  })
  const store = t.mock.method(imageService, 'storeGeneratedImage', async () => { throw new Error('저장하면 안 됨') })
  const push = t.mock.method(pushService, 'sendFailure', async () => true)
  await processPreviewJob(job)
  assert.equal(requests, 0)
  assert.equal(store.mock.callCount(), 0)
  assert.equal(failed.mock.calls[0]?.arguments[2], 'AI_INTERRUPTED')
  assert.equal(push.mock.callCount(), 0)
})

test('실행 자리가 없으면 실패 알림이나 API 호출 없이 대기열로 돌려보낸다', async (t) => {
  t.mock.method(aiExecutor, 'run', async () => { throw new ServiceError('busy', 'AI_BUSY') })
  const queued = t.mock.method(previewJobRepository, 'requeue', async () => ({ count: 1 }))
  const generate = t.mock.method(outfitPreviewService, 'generate', async () => { throw new Error('호출하면 안 됨') })
  const push = t.mock.method(pushService, 'sendFailure', async () => true)
  await processPreviewJob(job)
  assert.equal(queued.mock.callCount(), 1)
  assert.equal(generate.mock.callCount(), 0)
  assert.equal(push.mock.callCount(), 0)
})
