import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import type { AiPreviewJob } from '@prisma/client'
import { aiInputKey } from '../../lib/ai/ai-execution.js'
import { ServiceError } from '../../graphql/errors.js'
import { imageService } from '../image/image.service.js'
import { imageRepository } from '../image/image.repository.js'
import { userRepository } from '../user/user.repository.js'
import { getOutfitPreviewItems } from './outfit-preview-selection.js'
import { previewJobRepository } from './preview-job.repository.js'

export interface StartPreviewInput { selectedItemIds: string[]; style?: string | null; requestId: string }

/** 상태에 맞는 코디 편집 경로를 만든다. 작업 중 경로도 앱 재실행 후 같은 작업 조회에 사용한다. */
export function getPreviewJobPath(job: Pick<AiPreviewJob, 'id' | 'selectedItemIds' | 'style' | 'status' | 'imageAssetId'>) {
  const params = new URLSearchParams({ items: job.selectedItemIds.join(','), from: '/lookbook' })
  if (job.style) params.set('style', job.style)
  if (job.status === 'completed' && job.imageAssetId) {
    params.set('preview', 'open')
    params.set('previewAssetId', job.imageAssetId)
  } else if (job.status === 'failed' || job.status === 'interrupted') params.set('preview', 'failed')
  else params.set('previewJobId', job.id)
  return `/lookbook/new?${params}`
}

/** DB 내부의 임대 토큰·요청 키는 제외하고 소유자가 화면 복원에 필요한 상태와 경로만 반환한다. */
export function toPreviewJob(job: AiPreviewJob) {
  return { id: job.id, status: job.status, selectedItemIds: job.selectedItemIds, style: job.style,
    imageAssetId: job.imageAssetId, model: job.model, errorCode: job.errorCode, errorMessage: job.errorMessage,
    createdAt: job.createdAt.toISOString(), path: getPreviewJobPath(job) }
}

/** 생성 요청을 영속 큐에 넣고 로그인 사용자별로 진행·완료 결과를 조회한다. 이 서비스는 직접 AI를 호출하지 않는다. */
export const previewJobService = {
  /** 활성 보유 옷과 요청 번호를 검증해 큐에 넣는다. 같은 요청 번호는 재접수하지 않고 같은 입력의 진행 작업도 공유한다. */
  async start(userId: string, input: StartPreviewInput) {
    if (!/^[\w-]{8,100}$/.test(input.requestId) || (input.style?.length ?? 0) > 100) throw new ServiceError('이미지 생성 요청이 올바르지 않습니다.', 'INVALID_OUTFIT_PREVIEW_REQUEST')
    const items = await getOutfitPreviewItems(userId, input.selectedItemIds)
    const profile = await userRepository.findViewerById(userId)
    const selectedItemIds = items.map((item) => item.id)
    const style = input.style?.trim() || null
    const inputKey = aiInputKey([[...selectedItemIds].sort(), style])
    const requestKey = aiInputKey([userId, input.requestId])
    const job = await previewJobRepository.enqueue({ id: requestKey, userId, requestKey, inputKey, selectedItemIds, style,
      fingerprint: aiInputKey([inputKey, items, profile?.styleProfile, profile?.preferredStyles, process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2']) })
    return toPreviewJob(job)
  },
  /** 소유한 작업을 공개 상태로 변환한다. 소유자가 다르거나 만료된 작업에는 AI_JOB_NOT_FOUND를 반환한다. */
  async get(userId: string, id: string) {
    const job = await previewJobRepository.findOwned(userId, id)
    if (!job) throw new ServiceError('AI 생성 작업을 찾을 수 없어요.', 'AI_JOB_NOT_FOUND')
    return toPreviewJob(job)
  },
  /** 앱 상태 안내에서 이어 볼 수 있는 미확인 작업 목록을 반환한다. */
  async list(userId: string) {
    return (await previewJobRepository.listOwned(userId)).map(toPreviewJob)
  },
  /** 알림 확인·작업 TTL과 무관하게 같은 보유 옷·스타일의 최신 완료 이미지를 찾는다. 결과 부재·삭제에는 null이며 생성·사용권 차감은 하지 않는다. */
  async latestForItems(userId: string, selectedItemIds: string[], style?: string | null) {
    if ((style?.length ?? 0) > 100) throw new ServiceError('이미지 조회 조건이 올바르지 않습니다.', 'INVALID_OUTFIT_PREVIEW_REQUEST')
    const items = await getOutfitPreviewItems(userId, selectedItemIds)
    const asset = await imageRepository.findLatestGeneratedPreviewForItems(userId, items.map((item) => item.id), style?.trim() || null)
    if (!asset) return null
    try {
      const image = await imageService.getGeneratedImage(userId, asset.id)
      return { assetId: image.assetId, imageUrl: image.imageUrl, mimeType: image.mimeType, model: image.model,
        jobId: asset.aiPreviewJobId ?? null, createdAt: asset.createdAt.toISOString() }
    } catch (error) {
      // 후보를 찾은 뒤 삭제되거나 사용할 수 없어진 이미지는 새 생성 없이 결과 없음으로 처리한다.
      if (error instanceof ServiceError && ['OUTFIT_PREVIEW_NOT_FOUND', 'OUTFIT_PREVIEW_EXPIRED'].includes(error.code)) return null
      throw error
    }
  },
  /** 소유한 종료 작업을 확인 처리했을 때 true를 반환한다. 진행 작업은 숨기지 않는다. */
  async acknowledge(userId: string, id: string) {
    return (await previewJobRepository.acknowledge(userId, id)).count === 1
  },
  /** 이전 앱의 동기 API도 같은 영속 작업을 사용한다. 시간 초과는 작업을 취소하거나 다시 생성하지 않는다. */
  async generateAndWait(userId: string, input: Omit<StartPreviewInput, 'requestId'>) {
    let job = await previewJobService.start(userId, { ...input, requestId: randomUUID() })
    const deadline = Date.now() + 150_000
    while (job.status === 'queued' || job.status === 'processing') {
      if (Date.now() > deadline) throw new ServiceError('이미지를 계속 만들고 있어요. 생성 상태에서 결과를 확인해 주세요.', 'AI_JOB_PENDING')
      await delay(750)
      job = await previewJobService.get(userId, job.id)
    }
    if (job.status !== 'completed' || !job.imageAssetId) throw new ServiceError(job.errorMessage ?? '이미지를 완성하지 못했어요.', job.errorCode ?? 'AI_FAILED')
    const image = await imageService.getGeneratedImage(userId, job.imageAssetId)
    return { ...image, imageBase64: '' }
  },
}
