import { useEffect, useSyncExternalStore } from 'react'
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { OutfitPreview, OutfitPreviewJob, StoredOutfitPreview } from '@closet/types'
import { GraphqlRequestError, graphqlRequest } from '../../../lib/graphql'
import { useMeQuery } from '../../settings/api/profileQueries'
import { clearPendingPreview, getPendingPreviewSnapshot, previewRequestKey, readPendingPreview, subscribePendingPreview, writePendingPreview } from '../utils/pendingPreviewRequest'
import { PreviewJobError, waitForPreviewJob } from '../utils/waitForPreviewJob'
import { previewCreditKeys } from './previewCreditQueries'
import { requireAiCredit } from './requireAiCredit'
import { queryKeys } from '../../../lib/queryKeys'
import { matchesExistingPreview as matchesPreview, resumeExistingPreview } from '../utils/resumeExistingPreview'
import { rememberCompletedOutfitPreview, useCompletedOutfitPreview } from '../hooks/useCompletedOutfitPreview'
import { clearCompletedPreviewPointer } from '../utils/completedPreviewPointer'

const fields = 'id status selectedItemIds style imageAssetId model errorCode errorMessage createdAt path'
export const previewJobKeys = { all: ['outfit-preview-jobs'] as const, list: (viewerId: string) => ['outfit-preview-jobs', viewerId] as const, detail: (id: string) => ['outfit-preview-job', id] as const }
type PreviewInput = { selectedItemIds: string[]; style?: string }
const inFlightPreviews = new Map<string, Promise<OutfitPreview>>()
const isActiveJob = (job: OutfitPreviewJob | undefined) => job?.status === 'queued' || job?.status === 'processing'

/** 미확인 작업 목록을 읽는다. 진행 작업 복원 검사에서는 새 접수 전에 같은 조합의 작업을 찾는 데 재사용한다. */
async function getPreviewJobs() {
  return (await graphqlRequest<{ outfitPreviewJobs: OutfitPreviewJob[] }>(`query OutfitPreviewJobs { outfitPreviewJobs { ${fields} } }`)).outfitPreviewJobs
}

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
    refetchOnWindowFocus: true, refetchOnMount: 'always', staleTime: 5000,
    refetchInterval: (query) => query.state.data?.some((job) => job.status === 'queued' || job.status === 'processing') ? 2000 : false,
    queryFn: getPreviewJobs,
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
 * inputScope가 있으면 같은 계정·조합의 복원 확인과 진행 작업도 isPending에 포함하며, 다른 조합은 막지 않는다.
 */
export function useGenerateOutfitPreviewJobMutation(inputScope?: PreviewInput) {
  const me = useMeQuery()
  const client = useQueryClient()
  const ownerId = me.data?.id ?? ''
  const scopeKey = previewRequestKey(ownerId, inputScope?.selectedItemIds ?? [], inputScope?.style)
  const snapshot = useSyncExternalStore(subscribePendingPreview, () => getPendingPreviewSnapshot(scopeKey), () => null)
  const pending = snapshot ? readPendingPreview(scopeKey) : null
  const jobs = useOutfitPreviewJobsQuery(Boolean(inputScope?.selectedItemIds.length))
  const restoredJob = useOutfitPreviewJobQuery(inputScope ? pending?.jobId ?? null : null)
  const matchingActiveJob = inputScope ? jobs.data?.find((job) => matchesPreview(job, inputScope) && isActiveJob(job)) : undefined
  const knownPendingJob = jobs.data?.find((job) => job.id === pending?.jobId) ?? restoredJob.data
  const matchingMutations = useIsMutating({ mutationKey: ['outfit-preview-generation', ownerId], predicate: (mutation) => {
    const variables = mutation.state.variables as PreviewInput | undefined
    return Boolean(inputScope && variables && previewRequestKey(ownerId, variables.selectedItemIds, variables.style) === scopeKey)
  } })
  const isCheckingActive = Boolean(inputScope?.selectedItemIds.length) && (!me.data || jobs.isPending || jobs.isFetching || Boolean(pending?.jobId && restoredJob.isPending))
  const isActive = Boolean(inputScope && (matchingMutations > 0 || matchingActiveJob || isActiveJob(knownPendingJob)))
  const completedJob = knownPendingJob?.status === 'completed' && inputScope && matchesPreview(knownPendingJob, inputScope)
    ? knownPendingJob : inputScope ? jobs.data?.find((job) => job.status === 'completed' && matchesPreview(job, inputScope)) : undefined
  const completed = useCompletedOutfitPreview({ viewerId: ownerId, requestKey: scopeKey, enabled: Boolean(ownerId && new Set(inputScope?.selectedItemIds ?? []).size >= 2), active: isActive, completedJob, input: inputScope })

  // 서버가 실패·중단을 확정했다면 이전 요청 번호를 해제해 사용자의 다음 시도가 새 작업이 되게 한다.
  useEffect(() => {
    if (pending?.jobId && knownPendingJob?.id === pending.jobId && ['failed', 'interrupted'].includes(knownPendingJob.status)) clearPendingPreview(scopeKey)
  }, [knownPendingJob?.id, knownPendingJob?.status, pending?.jobId, scopeKey])

  const mutation = useMutation({
    mutationKey: ['outfit-preview-generation', ownerId],
    mutationFn: async (input: PreviewInput) => {
      if (!me.data) throw new Error('계정 정보를 확인한 뒤 다시 시도해 주세요.')
      const viewerId = me.data.id
      const key = previewRequestKey(viewerId, input.selectedItemIds, input.style)
      const existingRequest = inFlightPreviews.get(key)
      if (existingRequest) return existingRequest
      const request = (async (): Promise<OutfitPreview> => {
        let previous = readPendingPreview(key)
        if (!previous?.jobId) {
          // 화면·앱을 다시 열어도 서버에 이미 진행 중인 같은 조합은 잔액 확인·새 접수 없이 이어받는다.
          const serverJobs = await client.fetchQuery({ queryKey: previewJobKeys.list(viewerId), queryFn: getPreviewJobs, staleTime: 0 })
          const active = serverJobs.find((job) => matchesPreview(job, input) && isActiveJob(job))
          if (active) previous = { requestId: previous?.requestId ?? crypto.randomUUID(), createdAt: Date.now(), jobId: active.id }
        }
        // 복원할 요청이 없을 때만 새 작업의 횟수를 확인한다. 진행 중·완료 작업 복원은 추가 광고를 요구하지 않는다.
        if (!previous && !await requireAiCredit(client, viewerId, 'preview')) throw new Error('잔액을 확인한 뒤 만들기 버튼을 다시 눌러주세요.')
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
            if (!await requireAiCredit(client, viewerId, 'preview')) throw new Error('잔액을 확인한 뒤 만들기 버튼을 다시 눌러주세요.', { cause: error })
            initial = await start()
          }
          writePendingPreview(key, { ...pending, jobId: initial.id })
          clearCompletedPreviewPointer(key)
          void client.invalidateQueries({ queryKey: previewJobKeys.all })
          void client.invalidateQueries({ queryKey: previewCreditKeys.all })
          const job = await waitForPreviewJob(initial, getPreviewJob)
          const data = await graphqlRequest<{ outfitPreviewAsset: StoredOutfitPreview }>('query OutfitPreviewAsset($id: ID!) { outfitPreviewAsset(id: $id) { assetId imageUrl mimeType model } }', { id: job.imageAssetId })
          rememberCompletedOutfitPreview(client, viewerId, key, job, { ...data.outfitPreviewAsset, imageBase64: '' })
          clearPendingPreview(key)
          return { ...data.outfitPreviewAsset, imageBase64: '' }
        } catch (error) {
          if ((error instanceof PreviewJobError && error.code !== 'AI_JOB_PENDING') || (error instanceof GraphqlRequestError && ['AI_JOB_NOT_FOUND', 'OUTFIT_PREVIEW_NOT_FOUND', 'OUTFIT_PREVIEW_EXPIRED'].includes(error.code ?? ''))) clearPendingPreview(key)
          throw error
        } finally {
          void client.invalidateQueries({ queryKey: previewJobKeys.all })
          void client.invalidateQueries({ queryKey: previewCreditKeys.all })
        }
      })()
      inFlightPreviews.set(key, request)
      try { return await request } finally { if (inFlightPreviews.get(key) === request) inFlightPreviews.delete(key) }
    },
  })
  const resumeMutation = useMutation({
    mutationKey: ['outfit-preview-generation', ownerId],
    mutationFn: async (input: PreviewInput & { knownJobId?: string }) => {
      if (!ownerId) throw new Error('계정 정보를 확인한 뒤 다시 시도해 주세요.')
      const key = previewRequestKey(ownerId, input.selectedItemIds, input.style)
      const assertActive = () => {
        if (client.getQueryData<{ id: string }>(queryKeys.me)?.id !== ownerId) throw new Error('계정이 바뀌었어요. 현재 계정에서 다시 확인해주세요.')
      }
      assertActive()
      const existingRequest = inFlightPreviews.get(key)
      if (existingRequest) {
        const result = await existingRequest
        assertActive()
        return result
      }
      const request = (async () => {
        try {
          let resolvedJob: OutfitPreviewJob | undefined
          const result = await resumeExistingPreview(input, {
            jobId: input.knownJobId,
            readJobs: getPreviewJobs,
            readJob: getPreviewJob,
            readAsset: async (id) => (await graphqlRequest<{ outfitPreviewAsset: StoredOutfitPreview }>('query OutfitPreviewAsset($id: ID!) { outfitPreviewAsset(id: $id) { assetId imageUrl mimeType model } }', { id })).outfitPreviewAsset,
            assertActive,
            onJobResolved: (job) => {
              resolvedJob = job
              const previous = readPendingPreview(key)
              writePendingPreview(key, { requestId: previous?.requestId ?? crypto.randomUUID(), createdAt: previous?.createdAt ?? Date.now(), jobId: job.id })
            },
          })
          if (resolvedJob) rememberCompletedOutfitPreview(client, ownerId, key, resolvedJob, result)
          return result
        } catch (error) {
          if ((error instanceof PreviewJobError && error.code !== 'AI_JOB_PENDING') || (error instanceof GraphqlRequestError && ['AI_JOB_NOT_FOUND', 'OUTFIT_PREVIEW_NOT_FOUND', 'OUTFIT_PREVIEW_EXPIRED'].includes(error.code ?? ''))) clearPendingPreview(key)
          throw error
        } finally {
          void client.invalidateQueries({ queryKey: previewJobKeys.all })
        }
      })()
      inFlightPreviews.set(key, request)
      try {
        const result = await request
        clearPendingPreview(key)
        return result
      } finally {
        if (inFlightPreviews.get(key) === request) inFlightPreviews.delete(key)
      }
    },
  })
  const willResume = Boolean(pending || matchingActiveJob)
  const canResumeExisting = Boolean(inputScope?.selectedItemIds.length && (matchingMutations > 0 || inFlightPreviews.has(scopeKey) || pending?.jobId || matchingActiveJob))

  /** 클릭 당시 알고 있던 작업만 끝까지 관찰한다. 완료·실패로 바뀌거나 작업이 없어져도 새 생성 경로로 넘어가지 않는다. */
  const resumeExistingAsync = async () => {
    if (!inputScope?.selectedItemIds.length) throw new Error('생성 중인 옷 조합을 먼저 확인해주세요.')
    const knownJobId = pending?.jobId ?? matchingActiveJob?.id ?? knownPendingJob?.id
    return resumeMutation.mutateAsync({ ...inputScope, knownJobId })
  }
  return { ...mutation, isPending: inputScope ? isCheckingActive || isActive : mutation.isPending, isCheckingActive, isActive, willResume, canResumeExisting: canResumeExisting && !completed.hasCompletedPreview, resumeExistingAsync, ...completed }
}
