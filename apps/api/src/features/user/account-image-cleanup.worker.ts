import { cloudflareImagesClient } from '../image/cloudflare-images.client.js'
import { accountImageCleanupRepository as repository } from './account-image-cleanup.repository.js'

/** 커밋된 탈퇴 파일만 CF→큐 순서로 제거한다. 404도 성공이며 실패는 임대를 풀어 재시도한다. */
export async function cleanupDeletedAccountImage() {
  const task = await repository.claim()
  if (!task) return false
  try {
    await cloudflareImagesClient.deleteImage(task.cloudflareImageId)
    await repository.complete(task.cloudflareImageId, task.leaseToken)
  } catch {
    await repository.retry(task.cloudflareImageId, task.leaseToken)
  }
  return true
}

/** 서버 재시작 뒤에도 영속 큐를 이어서 처리한다. 종료 시 새 작업은 멈추고 진행 중 파일 한 건만 기다린다. */
export function startAccountImageCleanupWorker() {
  let stopped = false
  let running: Promise<void> | null = null
  const tick = () => {
    if (stopped || running) return
    running = cleanupDeletedAccountImage().then(() => undefined).catch(() => console.warn('[account-image-cleanup] retry pending')).finally(() => { running = null })
  }
  const timer = setInterval(tick, 1000)
  timer.unref()
  tick()
  return async () => { stopped = true; clearInterval(timer); await running }
}
