import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { CompletedOutfitPreview, OutfitPreview, OutfitPreviewJob, StoredOutfitPreview } from '@closet/types'
import { graphqlRequest } from '../../../lib/graphql'
import { queryKeys } from '../../../lib/queryKeys'
import { clearCompletedPendingPreview, clearCompletedPreviewPointer, getCompletedPreviewSnapshot, isCompletedPreviewUnavailable, parseCompletedPreviewPointer, readCompletedPreviewPointer, subscribeCompletedPreview, writeCompletedPreviewPointer, type CompletedPreviewPointer } from '../utils/completedPreviewPointer'
import { completedPreviewKeys, discardCompletedOutfitPreview } from '../utils/completedPreviewCache'
import type { ExistingPreviewInput } from '../utils/resumeExistingPreview'

const { result: resultKey, lookup: lookupKey } = completedPreviewKeys

function toPreview(image: StoredOutfitPreview): OutfitPreview {
  return { assetId: image.assetId, imageUrl: image.imageUrl, mimeType: image.mimeType, model: image.model, imageBase64: '' }
}

/** 성공한 결과의 URL은 메모리 캐시에만 넣고 로컬에는 완료 번호를 남긴다. 저장 뒤 페이지가 바뀌어도 같은 조합에서 복원할 수 있다. */
export function rememberCompletedOutfitPreview(client: QueryClient, viewerId: string, requestKey: string, job: Pick<OutfitPreviewJob, 'id' | 'createdAt'>, preview: OutfitPreview) {
  if (!preview.assetId) return
  client.setQueryData(resultKey(viewerId, requestKey, preview.assetId), preview)
  client.setQueryData<CompletedOutfitPreview>(lookupKey(viewerId, requestKey), { assetId: preview.assetId, imageUrl: preview.imageUrl ?? `data:${preview.mimeType};base64,${preview.imageBase64}`, mimeType: preview.mimeType, model: preview.model, jobId: job.id, createdAt: job.createdAt })
  writeCompletedPreviewPointer(requestKey, { jobId: job.id, assetId: preview.assetId, jobCreatedAt: job.createdAt, recordedAt: Date.now() })
}

interface Options {
  viewerId: string
  requestKey: string
  enabled: boolean
  active: boolean
  completedJob?: OutfitPreviewJob
  input?: ExistingPreviewInput
}

/** 계정·조합별 완료 번호를 서버 이미지로 복원한다. 새 작업이 진행 중이면 이전 결과를 가리고 완료 이미지의 새 생성은 요청하지 않는다. */
export function useCompletedOutfitPreview({ viewerId, requestKey, enabled, active, completedJob, input }: Options) {
  const client = useQueryClient()
  const snapshot = useSyncExternalStore(subscribeCompletedPreview, () => getCompletedPreviewSnapshot(requestKey), () => null)
  const pointer = parseCompletedPreviewPointer(snapshot)
  const hasPointer = pointer !== null
  const activeScopeRef = useRef<string | null>(requestKey)
  const activeOperationRef = useRef(active)
  // 서버 목록이 잠시 이전 완료 작업을 포함하더라도 거절한 이미지를 같은 실행 중 다시 수집하지 않는다.
  const rejectedAssetsRef = useRef(new Set<string>())

  useEffect(() => {
    activeScopeRef.current = requestKey
    return () => { if (activeScopeRef.current === requestKey) activeScopeRef.current = null }
  }, [requestKey])

  useEffect(() => { activeOperationRef.current = active }, [active])

  useEffect(() => {
    if (snapshot && !hasPointer) clearCompletedPreviewPointer(requestKey)
  }, [snapshot, hasPointer, requestKey])

  useEffect(() => {
    if (!enabled || active || completedJob?.status !== 'completed' || !completedJob.imageAssetId) return
    const rejectedKey = `${viewerId}:${requestKey}:${completedJob.imageAssetId}`
    if (rejectedAssetsRef.current.has(rejectedKey) || client.getQueryData(resultKey(viewerId, requestKey, completedJob.imageAssetId)) === null) return
    if (pointer?.jobId === completedJob.id && pointer.assetId === completedJob.imageAssetId) return
    const createdAt = pointer?.createdAt ?? pointer?.jobCreatedAt
    const pointerTime = createdAt ? Date.parse(createdAt) : pointer?.recordedAt
    if (pointerTime !== undefined && Date.parse(completedJob.createdAt) <= pointerTime) return
    writeCompletedPreviewPointer(requestKey, { jobId: completedJob.id, assetId: completedJob.imageAssetId, jobCreatedAt: completedJob.createdAt, recordedAt: Date.now() })
  }, [active, client, completedJob?.id, completedJob?.status, completedJob?.imageAssetId, completedJob?.createdAt, enabled, pointer?.jobId, pointer?.assetId, pointer?.jobCreatedAt, pointer?.createdAt, pointer?.recordedAt, requestKey, viewerId])

  const assertScopeActive = () => {
    if (client.getQueryData<{ id: string }>(queryKeys.me)?.id !== viewerId || activeScopeRef.current !== requestKey) throw new Error('옷 조합이나 계정이 바뀌었어요. 현재 화면에서 다시 확인해주세요.')
  }

  const loadLatest = async (signal?: AbortSignal): Promise<CompletedOutfitPreview | null> => {
    assertScopeActive()
    if (!input || new Set(input.selectedItemIds).size < 2) return null
    const pointerAtStart = readCompletedPreviewPointer(requestKey)
    const data = await graphqlRequest<{ outfitPreviewForItems: CompletedOutfitPreview | null }>(`query OutfitPreviewForItems($selectedItemIds: [ID!]!, $style: String) {
      outfitPreviewForItems(selectedItemIds: $selectedItemIds, style: $style) { assetId imageUrl mimeType model jobId createdAt }
    }`, { selectedItemIds: [...new Set(input.selectedItemIds)].sort(), style: input.style?.trim() || null }, signal)
    assertScopeActive()
    signal?.throwIfAborted()
    if (activeOperationRef.current) throw new Error('새 AI 룩북을 만들고 있어요. 완료 후 다시 확인해주세요.')
    const previous = readCompletedPreviewPointer(requestKey)
    // 조회가 끝나기 전에 새 생성이 완료되면 과거 응답으로 최신 포인터·이미지를 덮지 않는다.
    if (previous && previous.assetId !== pointerAtStart?.assetId) {
      const current = client.getQueryData<CompletedOutfitPreview | null>(lookupKey(viewerId, requestKey))
      if (current?.assetId === previous.assetId) return current
      // 완료 작업 조회가 포인터를 먼저 복원한 경우 이미지 조회가 이어받는다. 요청 순서 차이를 통신 오류로 남기지 않는다.
      return null
    }
    const image = data.outfitPreviewForItems
    if (!image || rejectedAssetsRef.current.has(`${viewerId}:${requestKey}:${image.assetId}`) || client.getQueryData(resultKey(viewerId, requestKey, image.assetId)) === null) return null
    // 알림 확인 여부나 작업 만료와 무관한 서버 조회가 이미지 보관 여부를 결정한다.
    const knownJobId = image.jobId ?? (previous?.assetId === image.assetId ? previous.jobId : undefined)
    client.setQueryData(resultKey(viewerId, requestKey, image.assetId), toPreview(image))
    writeCompletedPreviewPointer(requestKey, { ...(knownJobId ? { jobId: knownJobId } : {}), assetId: image.assetId, createdAt: image.createdAt, recordedAt: Date.now() })
    clearCompletedPendingPreview(requestKey, knownJobId)
    return image
  }

  const lookup = useQuery({
    queryKey: lookupKey(viewerId, requestKey), enabled: enabled && !active && Boolean(input?.selectedItemIds.length),
    staleTime: 30_000, retry: 0, refetchOnMount: 'always', refetchOnWindowFocus: true,
    queryFn: ({ signal }) => loadLatest(signal),
  })

  const loadImage = async (captured: CompletedPreviewPointer, signal?: AbortSignal): Promise<OutfitPreview> => {
    assertScopeActive()
    try {
      const data = await graphqlRequest<{ outfitPreviewAsset: StoredOutfitPreview }>('query OutfitPreviewAsset($id: ID!) { outfitPreviewAsset(id: $id) { assetId imageUrl mimeType model } }', { id: captured.assetId }, signal)
      assertScopeActive()
      signal?.throwIfAborted()
      if (data.outfitPreviewAsset.assetId !== captured.assetId) throw Object.assign(new Error('완료된 AI 이미지 번호를 다시 확인해주세요.'), { code: 'OUTFIT_PREVIEW_NOT_FOUND' })
      clearCompletedPendingPreview(requestKey, captured.jobId)
      return { ...data.outfitPreviewAsset, imageBase64: '' }
    } catch (error) {
      if (isCompletedPreviewUnavailable(error)) {
        rejectedAssetsRef.current.add(`${viewerId}:${requestKey}:${captured.assetId}`)
        discardCompletedOutfitPreview(client, viewerId, requestKey, captured.assetId, captured.jobId)
      }
      throw error
    }
  }

  const query = useQuery({
    queryKey: resultKey(viewerId, requestKey, pointer?.assetId ?? ''),
    enabled: enabled && !active && Boolean(pointer),
    staleTime: 30_000, retry: 0, refetchOnMount: 'always', refetchOnWindowFocus: true,
    queryFn: ({ signal }) => loadImage(pointer!, signal),
  })

  /** 알려진 asset 또는 서버의 동일 조합 완료 결과만 다시 읽는다. 일시 오류를 새 생성으로 자동 전환하지 않는다. */
  const restoreCompletedAsync = async () => {
    if (pointer) return client.fetchQuery({ queryKey: resultKey(viewerId, requestKey, pointer.assetId), queryFn: () => loadImage(pointer), staleTime: 0, retry: 0 })
    const image = await client.fetchQuery({ queryKey: lookupKey(viewerId, requestKey), queryFn: () => loadLatest(), staleTime: 0, retry: 0 })
    if (!image) {
      const latestPointer = readCompletedPreviewPointer(requestKey)
      if (latestPointer) return client.fetchQuery({ queryKey: resultKey(viewerId, requestKey, latestPointer.assetId), queryFn: () => loadImage(latestPointer), staleTime: 0, retry: 0 })
      throw new Error('이 옷 조합으로 보관된 AI 룩북이 없습니다.')
    }
    return toPreview(image)
  }
  const hasCompletedPreview = enabled && !active && Boolean(pointer || lookup.data)
  const completedPreview = hasCompletedPreview ? query.data ?? (lookup.data ? toPreview(lookup.data) : null) : null
  const isRestoringCompleted = enabled && !active && (query.isFetching || lookup.isPending || lookup.isFetching)
  const isCompletedLookupError = enabled && !active && !pointer && lookup.isError
  return { completedPreview, hasCompletedPreview, isRestoringCompleted, isCompletedLookupError, restoreCompletedAsync }
}
