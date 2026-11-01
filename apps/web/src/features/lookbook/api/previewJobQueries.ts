import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { OutfitPreviewJob, StoredOutfitPreview } from '@closet/types'
import { GraphqlRequestError, graphqlRequest } from '../../../lib/graphql'
import { useMeQuery } from '../../settings/api/profileQueries'
import { clearPendingPreview, previewRequestKey, readPendingPreview, writePendingPreview } from '../utils/pendingPreviewRequest'
import { PreviewJobError, waitForPreviewJob } from '../utils/waitForPreviewJob'
import { previewCreditKeys } from './previewCreditQueries'
import { requireAiCredit } from './requireAiCredit'

const fields = 'id status selectedItemIds style imageAssetId model errorCode errorMessage createdAt path'
export const previewJobKeys = { all: ['outfit-preview-jobs'] as const, list: (viewerId: string) => ['outfit-preview-jobs', viewerId] as const, detail: (id: string) => ['outfit-preview-job', id] as const }

/** 소유한 작업의 상태만 조회한다. 조회 중 새 이미지 생성 요청을 보내지 않는다. */
export async function getPreviewJob(id: string) {
  const data = await graphqlRequest<{ outfitPreviewJob: OutfitPreviewJob }>(`query OutfitPreviewJob($id: ID!) { outfitPreviewJob(id: $id) { ${fields} } }`, { id })
  return data.outfitPreviewJob
}

/** 앱 재실행·다른 화면 진입 후에도 서버에 남은 진행·미확인 완료 작업을 불러온다. */
export function useOutfitPreviewJobsQuery(enabled = true) {
  const me = useMeQuery()
  return useQuery({
    queryKey: previewJobKeys.list(me.data?.id ?? ''), enabled: enabled && Boolean(me.data?.id), retry: 0,
    refetchOnWindowFocus: true, staleTime: 5000,
    refetchInterval: (query) => query.state.data?.some((job) => job.status === 'queued' || job.status === 'processing') ? 2000 : false,
    queryFn: async () => (await graphqlRequest<{ outfitPreviewJobs: OutfitPreviewJob[] }>(`query OutfitPreviewJobs { outfitPreviewJobs { ${fields} } }`)).outfitPreviewJobs,
  })
}

/** URL에 남은 작업 ID로 상태를 조회하며 완료·실패가 확정되면 폴링을 멈춘다. */
export function useOutfitPreviewJobQuery(id: string | null) {
  return useQuery({ queryKey: previewJobKeys.detail(id ?? ''), enabled: Boolean(id), retry: 1,
    queryFn: () => getPreviewJob(id!),
    refetchInterval: (query) => !query.state.error && (!query.state.data || ['queued', 'processing'].includes(query.state.data.status)) ? 1500 : false,
  })
}

/** 확인한 완료·실패 작업만 서버 알림 목록에서 숨긴다. 이미지와 작업 기록은 삭제하지 않는다. */
export function useAcknowledgePreviewJob() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (id: string) => graphqlRequest('mutation AcknowledgeOutfitPreviewJob($id: ID!) { acknowledgeOutfitPreviewJob(id: $id) }', { id }),
    onSuccess: () => { void client.invalidateQueries({ queryKey: previewJobKeys.all }) },
  })
}

/**
 * 새 요청은 잔액·광고 지급 확인 후 요청 번호를 기록하고 서버 작업을 접수한다. 완료 이미지 URL까지 기다린다.
 * 새로고침·연결 실패 후 재시도는 같은 작업에 연결하며, 서버가 완료·실패를 확정한 뒤의 만들기만 새 요청이다.
 */
export function useGenerateOutfitPreviewJobMutation() {
  const me = useMeQuery()
  const client = useQueryClient()
  return useMutation({
    mutationKey: ['outfit-preview-generation'],
    mutationFn: async (input: { selectedItemIds: string[]; style?: string }) => {
      if (!me.data) throw new Error('계정 정보를 확인한 뒤 다시 시도해 주세요.')
      const key = previewRequestKey(me.data.id, input.selectedItemIds, input.style)
      const previous = readPendingPreview(key)
      // 복원할 요청이 없을 때만 새 작업의 횟수를 확인한다. 진행 중·완료 작업 복원은 추가 광고를 요구하지 않는다.
      if (!previous && !await requireAiCredit(client, me.data.id, 'preview')) throw new Error('잔액을 확인한 뒤 만들기 버튼을 다시 눌러주세요.')
      const pending = previous ?? { requestId: crypto.randomUUID(), createdAt: Date.now() }
      writePendingPreview(key, pending)
      try {
        const start = async () => (await graphqlRequest<{ startOutfitPreview: OutfitPreviewJob }>(
          `mutation StartOutfitPreview($input: StartOutfitPreviewInput!) { startOutfitPreview(input: $input) { ${fields} } }`, { input: { ...input, requestId: pending.requestId } },
        )).startOutfitPreview
        let initial
        try { initial = pending.jobId ? await getPreviewJob(pending.jobId) : await start() }
        catch (error) {
          if (!(error instanceof GraphqlRequestError) || error.code !== 'PREVIEW_CREDITS_EXHAUSTED') throw error
          void client.invalidateQueries({ queryKey: previewCreditKeys.all })
          if (!await requireAiCredit(client, me.data.id, 'preview')) throw new Error('잔액을 확인한 뒤 만들기 버튼을 다시 눌러주세요.', { cause: error })
          initial = await start()
        }
        writePendingPreview(key, { ...pending, jobId: initial.id })
        void client.invalidateQueries({ queryKey: previewJobKeys.all })
        void client.invalidateQueries({ queryKey: previewCreditKeys.all })
        const job = await waitForPreviewJob(initial, getPreviewJob)
        const data = await graphqlRequest<{ outfitPreviewAsset: StoredOutfitPreview }>('query OutfitPreviewAsset($id: ID!) { outfitPreviewAsset(id: $id) { assetId imageUrl mimeType model } }', { id: job.imageAssetId })
        clearPendingPreview(key)
        return { ...data.outfitPreviewAsset, imageBase64: '' }
      } catch (error) {
        if ((error instanceof PreviewJobError && error.code !== 'AI_JOB_PENDING') || (error instanceof GraphqlRequestError && ['AI_JOB_NOT_FOUND', 'OUTFIT_PREVIEW_NOT_FOUND', 'OUTFIT_PREVIEW_EXPIRED'].includes(error.code ?? ''))) clearPendingPreview(key)
        throw error
      } finally {
        void client.invalidateQueries({ queryKey: previewJobKeys.all })
        void client.invalidateQueries({ queryKey: previewCreditKeys.all })
      }
    },
  })
}
