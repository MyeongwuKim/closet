import type { TodayOutfitRecommendation } from '@closet/types'

/** 저장된 AI 설명에 코드·반복 기호가 붙었으면 그 지점 이후를 제외한다. 정상 문구는 보존하며 원본 기록을 수정하지 않는다. */
export function cleanRecommendationText(value: string): string {
  const corruptionIndex = value.search(
    /\b(?:java|javax)\.[a-z][\w.]*|(?:[\][}{();]\s*){6,}|```/iu,
  )
  if (corruptionIndex < 0) return value.trim()

  return value
    .slice(0, corruptionIndex)
    .replace(/[\s"'`「」『』[\]{}();,:]+$/gu, '')
    .trim()
}

/** 조회·복원한 추천의 제목·설명·조합 포인트만 정리한다. 옷 구성과 추천 조건은 그대로 유지하고 내용이 남지 않은 포인트는 표시하지 않는다. */
export function normalizeRecommendationText(
  recommendation: TodayOutfitRecommendation,
): TodayOutfitRecommendation {
  return {
    ...recommendation,
    headline: cleanRecommendationText(recommendation.headline) || '오늘의 추천 코디',
    summary: cleanRecommendationText(recommendation.summary) || '내 옷장에서 함께 입을 구성을 골랐어요.',
    reasons: recommendation.reasons.map(cleanRecommendationText).filter(Boolean),
  }
}
