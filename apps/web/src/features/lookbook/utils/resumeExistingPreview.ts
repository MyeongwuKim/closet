import type { OutfitPreview, OutfitPreviewJob, StoredOutfitPreview } from '@closet/types'
import { previewRequestKey } from './pendingPreviewRequest'
import { PreviewJobError, waitForPreviewJob } from './waitForPreviewJob'

export interface ExistingPreviewInput {
  selectedItemIds: string[]
  style?: string
}

interface ExistingPreviewSource {
  /** 클릭 시 이미 알고 있던 작업 번호. 있으면 다른 작업을 찾거나 새 작업을 접수하지 않는다. */
  jobId?: string
  readJobs: () => Promise<OutfitPreviewJob[]>
  readJob: (id: string) => Promise<OutfitPreviewJob>
  readAsset: (id: string) => Promise<StoredOutfitPreview>
  assertActive: () => void
  onJobResolved?: (job: OutfitPreviewJob) => void
  waitOptions?: Parameters<typeof waitForPreviewJob>[2]
}

/** 아이템의 중복·순서와 빈 스타일 표현을 정규화해 같은 생성 조합인지 확인한다. */
export function matchesExistingPreview(job: OutfitPreviewJob, input: ExistingPreviewInput) {
  return previewRequestKey('', job.selectedItemIds, job.style ?? undefined) === previewRequestKey('', input.selectedItemIds, input.style)
}

/**
 * 이미 접수한 작업을 조회·관찰해 완료 이미지를 돌려준다. 생성 접수와 사용권 확인 함수는 받지 않는다.
 * 알려진 작업은 실패·완료로 바뀌어도 그 작업만 확인한다. 번호가 없으면 같은 조합의 진행 작업 또는 가장 최근 결과를 찾는다.
 */
export async function resumeExistingPreview(input: ExistingPreviewInput, source: ExistingPreviewSource): Promise<OutfitPreview> {
  source.assertActive()
  let jobId = source.jobId
  if (!jobId) {
    const jobs = await source.readJobs()
    source.assertActive()
    const candidates = jobs.filter((job) => matchesExistingPreview(job, input)).sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    jobId = (candidates.find((job) => job.status === 'queued' || job.status === 'processing') ?? candidates[0])?.id
  }
  if (!jobId) throw new PreviewJobError('진행 상태를 확인할 기존 AI 작업을 찾지 못했어요.', 'AI_JOB_NOT_FOUND')

  const pinnedJobId = jobId
  const readPinnedJob = async () => {
    source.assertActive()
    const job = await source.readJob(pinnedJobId)
    source.assertActive()
    if (job.id !== pinnedJobId || !matchesExistingPreview(job, input)) {
      throw new PreviewJobError('현재 옷 조합의 작업 상태를 다시 확인해주세요.', 'AI_JOB_NOT_FOUND')
    }
    return job
  }
  // 목록 확인 뒤 상태가 바뀌었을 수 있으므로 같은 작업의 최신 상태부터 읽는다.
  const initial = await readPinnedJob()
  source.onJobResolved?.(initial)
  const completed = await waitForPreviewJob(initial, readPinnedJob, source.waitOptions)
  source.assertActive()
  const image = await source.readAsset(completed.imageAssetId!)
  source.assertActive()
  if (image.assetId !== completed.imageAssetId) throw new PreviewJobError('완료된 AI 이미지를 다시 확인해주세요.', 'OUTFIT_PREVIEW_NOT_FOUND')
  return { ...image, imageBase64: '' }
}
