/** 빈 문장·과도한 길이·코드 조각이 섞인 추천 설명을 거절한다. 실패 시 호출자가 규칙 기반 결과를 사용한다. */
export function isRecommendationText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength &&
    !/\b(?:candidateId|targetStyle|preferredFit|fashionAttributes|wardrobeItemId|safe|harmony|accent|regular|relaxed|oversized|unknown)\b/iu.test(value) &&
    !/\b(?:java|javax)\.[a-z][\w.]*|(?:[\][}{();]\s*){6,}|(?:[}\]]\s*){2,}|[}\]]\s*$|```/iu.test(value)
}
