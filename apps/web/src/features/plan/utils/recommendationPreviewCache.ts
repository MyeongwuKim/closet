/**
 * 용도:
 * 같은 추천 코디에서 이미 만든 AI 룩북을 팝업 사이에 공유한다.
 *
 * 동작 방식:
 * 사용자, 스타일, 아이템 구성으로 순서와 무관한 키를 만들고
 * 최근 생성 결과만 메모리에 보관해 같은 조합의 중복 생성을 막는다.
 */
import type { OutfitPreview } from '@closet/types'

const MAX_CACHED_RECOMMENDATION_PREVIEWS = 10
const recommendationPreviewCache = new Map<string, OutfitPreview>()

export function getRecommendationPreviewKey(
  viewerId: string,
  style: string,
  itemIds: string[],
) {
  const itemKey = [...new Set(itemIds)].sort().join(':')
  return `recommendation-preview:v1:${viewerId}:${style}:${itemKey}`
}

export function readRecommendationPreview(key: string) {
  const preview = recommendationPreviewCache.get(key)
  if (!preview) return undefined

  recommendationPreviewCache.delete(key)
  recommendationPreviewCache.set(key, preview)
  return preview
}

export function cacheRecommendationPreview(
  key: string,
  preview: OutfitPreview,
) {
  recommendationPreviewCache.delete(key)
  recommendationPreviewCache.set(key, preview)

  while (
    recommendationPreviewCache.size > MAX_CACHED_RECOMMENDATION_PREVIEWS
  ) {
    const oldestKey = recommendationPreviewCache.keys().next().value
    if (typeof oldestKey !== 'string') break
    recommendationPreviewCache.delete(oldestKey)
  }
}
