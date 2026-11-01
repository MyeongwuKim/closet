import type { OutfitPreviewJob } from '@closet/types'

/** 생성 실패·중단·대기 기한을 구분한다. 대기 시간 초과는 서버 작업 취소를 뜻하지 않는다. */
export class PreviewJobError extends Error {
  readonly code: string
  constructor(message: string, code: string) { super(message); this.name = 'PreviewJobError'; this.code = code }
}

/**
 * 이미 접수된 작업만 조회한다. 연결 실패·서버 중단에도 새로운 생성 요청은 보내지 않는다.
 * 완료 이미지 ID를 얻거나 실패·중단을 확인할 때 종료하며, 10분이 지나면 완료 알림으로 결과를 확인하도록 안내한다.
 */
export async function waitForPreviewJob(
  initial: OutfitPreviewJob,
  read: (id: string) => Promise<OutfitPreviewJob>,
  { now = Date.now, wait = () => new Promise<void>((resolve) => setTimeout(resolve, 1500)), timeoutMs = 10 * 60_000 } = {},
) {
  let job = initial
  const started = now()
  while (job.status === 'queued' || job.status === 'processing') {
    if (now() - started >= timeoutMs) throw new PreviewJobError('이미지를 계속 만들고 있어요. 완료되면 알림으로 알려드릴게요.', 'AI_JOB_PENDING')
    await wait()
    job = await read(job.id)
  }
  if (job.status !== 'completed' || !job.imageAssetId) throw new PreviewJobError(job.errorMessage ?? 'AI 이미지를 완성하지 못했어요.', job.errorCode ?? 'AI_FAILED')
  return job
}
