import type { WardrobeItem } from '@closet/types'

/** 현재 옷 ID와 보류 설정의 비교 키. 장소·표시명만 바뀔 때는 유료 추천 조건을 바꾸지 않는다. */
export function getWardrobePreferenceKey(items: WardrobeItem[]) {
  return JSON.stringify(items.map((item) => [item.id, item.wearAvoidanceReason ?? null, item.recommendationResumeOn ?? null]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))))
}
