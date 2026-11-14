/** 시각을 한국 날짜로 바꾼다. 추천 보류의 기한은 시각이 아닌 이 날짜로 비교한다. */
export function getKoreaDate(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(now)
}

/** 사이즈 문제는 해제 전까지, 일시 보류는 재개일 전까지 자동 추천 후보에서 제외한다. */
export function isWardrobeRecommendationPaused(item, date) {
  return item.wearAvoidanceReason === 'fit_issue' ||
    (item.wearAvoidanceReason === 'temporarily_unused' && Boolean(item.recommendationResumeOn) && date < item.recommendationResumeOn)
}

/** 저장된 추천의 구성 전체가 현재 옷장에 있고 보류 조건에 맞는지 확인한다. 직접 고른 기준 옷은 허용한다. */
export function canReuseWardrobeRecommendation(items, wardrobe, date, explicitItemIds = []) {
  const current = new Map(wardrobe.map((item) => [item.id, item]))
  return items.every((item) => {
    const owned = current.get(item.id)
    return owned && !owned.archivedAt && (explicitItemIds.includes(item.id) || !isWardrobeRecommendationPaused(owned, date))
  })
}
