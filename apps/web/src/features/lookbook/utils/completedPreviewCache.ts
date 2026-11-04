import type { QueryClient } from '@tanstack/react-query'
import type { CompletedOutfitPreview } from '@closet/types'
import { queryKeys } from '../../../lib/queryKeys'
import { removeRecommendationPreviewAsset } from '../../plan/utils/recommendationPreviewCache'
import { clearCompletedPendingPreview, clearCompletedPreviewPointer, readCompletedPreviewPointer } from './completedPreviewPointer'
import { removeCachedOutfitPreviewAsset } from './outfitPreviewCache'

export const completedPreviewKeys = {
  result: (viewerId: string, requestKey: string, assetId: string) => ['outfit-preview-completed', viewerId, requestKey, assetId] as const,
  lookup: (viewerId: string, requestKey: string) => ['outfit-preview-for-items', viewerId, requestKey] as const,
}

/** 코디 저장·교체·삭제 후 현재 계정의 완료 이미지를 서버에서 다시 확인한다. 비활성 URL 캐시는 없애고 진행 작업·사용권·로컬 완료 번호는 보존한다. */
export function invalidateCompletedOutfitPreviews(client: QueryClient) {
  const viewerId = client.getQueryData<{ id: string }>(queryKeys.me)?.id
  const predicate = (query: { queryKey: readonly unknown[] }) => {
    const [kind, owner] = query.queryKey
    return ((kind === 'outfit-preview-completed' || kind === 'outfit-preview-for-items') && owner === viewerId)
      || (kind === 'outfits' && owner === 'preview-asset')
  }
  client.removeQueries({ predicate, type: 'inactive' })
  return client.invalidateQueries({ predicate, refetchType: 'active' })
}

/** 삭제·접근 거절이 확정된 asset만 완료 포인터와 이전 URL 캐시에서 폐기한다. 같은 조합의 새 이미지·새 진행 요청에는 영향을 주지 않는다. */
export function discardCompletedOutfitPreview(client: QueryClient, viewerId: string, requestKey: string, assetId: string, jobId?: string, storage?: Storage | null) {
  const current = readCompletedPreviewPointer(requestKey, storage)
  if (current?.assetId === assetId) clearCompletedPreviewPointer(requestKey, storage)
  clearCompletedPendingPreview(requestKey, jobId, storage)
  // null을 남겨 이전 알림 목록이 같은 삭제 이미지를 다시 수집하지 않게 한다.
  client.setQueryData(completedPreviewKeys.result(viewerId, requestKey, assetId), null)
  // 첫 조회의 데이터가 없는 오류 상태도 정리한다. undefined를 반환하면 Query가 이전 오류를 그대로 유지한다.
  client.setQueryData<CompletedOutfitPreview | null>(completedPreviewKeys.lookup(viewerId, requestKey), (image) => image && image.assetId !== assetId ? image : null)
  void client.cancelQueries({ queryKey: queryKeys.outfits.previewAsset(assetId), exact: true })
  client.setQueriesData({ queryKey: queryKeys.outfits.previewAsset(assetId), exact: true }, null)
  client.removeQueries({ queryKey: queryKeys.outfits.previewAsset(assetId), exact: true, type: 'inactive' })
  removeCachedOutfitPreviewAsset(viewerId, assetId, storage)
  removeRecommendationPreviewAsset(viewerId, assetId)
}
