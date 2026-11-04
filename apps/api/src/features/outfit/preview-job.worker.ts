import type { AiPreviewJob } from '@prisma/client'
import { ServiceError } from '../../graphql/errors.js'
import { aiExecutor } from '../../lib/ai/ai-execution.js'
import { imageRepository } from '../image/image.repository.js'
import { imageService } from '../image/image.service.js'
import { notifyCompletion, notifyFailure } from '../push/push.service.js'
import { outfitPreviewService } from './outfit-preview.service.js'
import { previewJobRepository } from './preview-job.repository.js'
import { getPreviewJobPath } from './preview-job.service.js'

function notifyReady(job: AiPreviewJob, imageAssetId: string) {
  notifyCompletion(job.userId, 'outfit-preview', { path: getPreviewJobPath({ ...job, status: 'completed', imageAssetId }), previewAssetId: imageAssetId })
}

/**
 * 끊긴 작업에서 저장된 이미지를 먼저 찾아 영구 보관한다. API 전송 전 작업만 대기열로 되돌린다.
 * 전송 기록이 있고 결과를 찾을 수 없으면 interrupted로 남겨 자동 재생성에 따른 재과금을 막는다.
 */
export async function recoverPreviewJobs() {
  for (const job of await previewJobRepository.expired()) {
    const image = await imageRepository.findByPreviewJob(job.userId, job.id)
    if (image) {
      const metadata = image.metadata as { model?: unknown } | null
      if (typeof metadata?.model === 'string') {
        await imageService.retainGeneratedPreview(job.userId, image.id)
        const completed = await previewJobRepository.complete(job, image.id, metadata.model, true)
        if (completed.count === 1) notifyReady(job, image.id)
        continue
      }
    }
    if (!job.requestStartedAt) await previewJobRepository.requeue(job, true)
    else {
      const failed = await previewJobRepository.fail(job, 'interrupted', 'AI_INTERRUPTED', '서버 연결이 끊겨 이전 생성 결과를 확인하지 못했어요. 자동으로 다시 만들지 않았습니다.', true)
      if (failed.count === 1) notifyFailure(job.userId, 'outfit-preview', { path: getPreviewJobPath({ ...job, status: 'interrupted' }) })
    }
  }
}

/** 임대한 작업 한 건을 생성·저장한다. 이미지 API 전송과 완료 저장마다 작업 토큰을 확인한다. */
export async function processPreviewJob(job: AiPreviewJob & { leaseToken: string }) {
  let renewInProgress = false
  const heartbeat = setInterval(() => {
    if (renewInProgress) return
    renewInProgress = true
    void previewJobRepository.renew(job.id, job.leaseToken).catch(() => console.warn('[preview-job] lease renewal failed')).finally(() => { renewInProgress = false })
  }, 15_000)
  heartbeat.unref()
  try {
    const image = await aiExecutor.run(job.userId, 'preview', { jobId: job.id, attempt: job.attempts }, async () => {
      const preview = await outfitPreviewService.generate(job.userId, job.selectedItemIds, job.style, {
        onBeforeRequest: async () => {
          const started = await previewJobRepository.markRequestStarted(job.id, job.leaseToken)
          if (started.count !== 1) throw new ServiceError('AI 생성 작업의 실행 권한이 만료됐어요.', 'AI_INTERRUPTED')
        },
      })
      const asset = await imageService.storeGeneratedImage(job.userId, {
        ...preview, jobId: job.id,
        metadata: { purpose: 'outfitPreview', selectedItemIds: job.selectedItemIds, ...(job.style ? { style: job.style } : {}) },
      })
      return { assetId: asset.id, model: preview.model }
    })
    const saved = await previewJobRepository.complete(job, image.assetId, image.model)
    if (saved.count === 1) notifyReady(job, image.assetId)
  } catch (error) {
    if (error instanceof ServiceError && error.code === 'AI_BUSY') {
      // 실행 자리를 얻기 전에는 유료 요청을 보내지 않았으므로 안전하게 대기한다.
      await previewJobRepository.requeue(job)
      return
    }
    const code = error instanceof ServiceError ? error.code : 'AI_FAILED'
    const message = error instanceof ServiceError ? error.message : 'AI 이미지를 완성하지 못했어요. 다시 만들기를 눌러주세요.'
    const failed = await previewJobRepository.fail(job, code === 'AI_INTERRUPTED' ? 'interrupted' : 'failed', code, message)
    if (failed.count === 1) notifyFailure(job.userId, 'outfit-preview', { path: getPreviewJobPath({ ...job, status: 'failed' }) })
  } finally {
    clearInterval(heartbeat)
  }
}

/**
 * API 프로세스마다 한 작업씩 큐를 처리한다. 여러 프로세스의 총 실행량은 공유 실행기가 제한한다.
 * 시작·주기 실행 때 끊긴 임대를 복구하며 종료 시 새 작업 수신을 멈추고 진행 중 저장을 기다린다.
 */
export function startPreviewWorker() {
  let stopped = false
  let running: Promise<void> | null = null
  const tick = () => {
    if (stopped || running) return
    running = (async () => {
      await recoverPreviewJobs()
      const job = await previewJobRepository.claim()
      if (job) await processPreviewJob(job)
    })().catch(() => console.warn('[preview-worker] queue processing failed')).finally(() => { running = null })
  }
  const timer = setInterval(tick, 1000)
  timer.unref()
  tick()
  return async () => {
    stopped = true
    clearInterval(timer)
    await running
  }
}
