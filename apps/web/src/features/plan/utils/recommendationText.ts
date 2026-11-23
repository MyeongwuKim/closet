import type { TodayOutfitRecommendation } from '@closet/types'

/** 저장된 AI 설명에 코드·반복 기호가 붙었으면 그 지점 이후를 제외한다. 정상 문구는 보존하며 원본 기록을 수정하지 않는다. */
export function cleanRecommendationText(value: string): string {
  const corruptionIndex = value.search(
    /\b(?:java|javax)\.[a-z][\w.]*|(?:[\][}{();]\s*){6,}|(?:[}\]]\s*){2,}|[}\]]\s*$|```/iu,
  )
  if (corruptionIndex < 0) return value.trim()

  return value
    .slice(0, corruptionIndex)
    .replace(/[\s"'`「」『』[\]{}();,:]+$/gu, '')
    .trim()
}

/** 이전 서버와 저장 기록의 기본 추천 문구를 현재 화면 문구로 바꾼다. */
function formatRecommendationCopy(value: string, hasWeather = false): string {
  return cleanRecommendationText(value)
    .replace(/^(봄|여름|가을|겨울)에 입을 기본 구성을 골랐어요\./u, (_, season: string) =>
      hasWeather ? '날씨에 맞춰 옷을 골랐어요.' : `${season}에 입기 좋은 코디예요.`,
    )
    .replaceAll('무채색을 함께 사용해 새로운 색 계열이 늘어나는 것을 줄였어요.', '무채색을 섞어 전체 색감을 차분하게 맞췄어요.')
    .replaceAll('고른 옷들과 이 아이템의 대표색 사이에 밝기 대비가 있어요.', '밝은 색과 짙은 색을 함께 맞췄어요.')
}

/** 조회·복원한 추천의 제목·설명·조합 포인트만 정리한다. 옷 구성과 추천 조건은 그대로 유지하고 내용이 남지 않은 포인트는 표시하지 않는다. */
export function normalizeRecommendationText(
  recommendation: TodayOutfitRecommendation,
): TodayOutfitRecommendation {
  return {
    ...recommendation,
    headline: cleanRecommendationText(recommendation.headline) || '오늘의 추천 코디',
    summary: formatRecommendationCopy(recommendation.summary, Boolean(recommendation.weather)) || '내 옷장에서 함께 입을 구성을 골랐어요.',
    reasons: recommendation.reasons.map((reason) => formatRecommendationCopy(reason)).filter(Boolean),
  }
}
