import type { ClothingCategory, Season } from '@prisma/client'

const DAY_MS = 86_400_000
/** 한 번에 표시하는 하루 하이라이트의 최대 개수. */
export const REDISCOVERY_LIMIT = 3

/** 후보 조회는 전체 활성 옷장의 최소 메타데이터를 사용한다. 착용일은 플래너에서 별도로 집계한다. */
export interface RediscoveryCandidate {
  id: string
  createdAt: Date
  seasons: Season[]
  category: ClothingCategory | null
  classificationStatus: string
}

export interface RediscoveryWearStats {
  wearCount: number
  lastWornAt: Date | null
}

/** 저장된 노출 이력에서 올바른 옷 ID·한국 날짜 쌍만 복원한다. 잘못된 값은 후보 선정에 사용하지 않는다. */
export function parseRediscoveryImpressions(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([id, day]) =>
    /^[a-f\d]{24}$/i.test(id) && typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day),
  ))
}

/**
 * 등록 후 30일 이상 지나고 최근 30일간 착용 기록이 없는 옷을 고른다.
 * 미노출·오래전에 노출한 순서로 순환하고 노출일이 같으면 한국 날짜의 현재 계절을 우선한다.
 * 같은 날의 선택 고정은 서비스가 담당하며 입력 배열은 변경하지 않는다.
 */
export function rankRediscoveryCandidates(
  items: RediscoveryCandidate[],
  wear: Map<string, RediscoveryWearStats>,
  impressions: Record<string, string>,
  today: Date,
) {
  const month = today.getUTCMonth() + 1
  const season: Season = month >= 3 && month <= 5 ? 'spring'
    : month >= 6 && month <= 8 ? 'summer'
      : month >= 9 && month <= 11 ? 'autumn' : 'winter'
  const cutoff = today.getTime() - 30 * DAY_MS
  return items.filter((item) => {
    const lastWornAt = wear.get(item.id)?.lastWornAt
    return item.classificationStatus === 'classified' && item.category && item.category !== 'other'
      && item.seasons.length > 0 && item.createdAt.getTime() <= cutoff
      && (!lastWornAt || lastWornAt.getTime() <= cutoff)
  }).sort((left, right) => {
    const seasonOrder = Number(!left.seasons.includes(season)) - Number(!right.seasons.includes(season))
    const exposureOrder = (impressions[left.id] ?? '').localeCompare(impressions[right.id] ?? '')
    const lastWear = (item: RediscoveryCandidate) => wear.get(item.id)?.lastWornAt?.getTime() ?? 0
    return exposureOrder || seasonOrder || lastWear(left) - lastWear(right)
      || left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id)
  })
}

/** 플래너의 마지막 착용일로 하이라이트 이유와 경과 일수를 만든다. 기록이 없으면 실제 미착용으로 단정하지 않는다. */
export function getRediscoveryReason(stats: RediscoveryWearStats | undefined, today: Date) {
  return stats?.lastWornAt
    ? { reason: 'long_unworn' as const, daysSinceLastWorn: Math.floor((today.getTime() - stats.lastWornAt.getTime()) / DAY_MS) }
    : { reason: 'no_wear_record' as const, daysSinceLastWorn: null }
}
