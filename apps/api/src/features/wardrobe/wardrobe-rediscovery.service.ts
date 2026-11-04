import { ServiceError } from '../../graphql/errors.js'
import { wardrobeRepository } from './wardrobe.repository.js'
import { getKoreaTodayUtc, getWardrobeWearStats } from './wardrobe.service.js'
import { wardrobeRediscoveryRepository as repository } from './wardrobe-rediscovery.repository.js'
import { getRediscoveryReason, parseRediscoveryImpressions, rankRediscoveryCandidates, REDISCOVERY_LIMIT } from './wardrobe-rediscovery.rules.js'

export const wardrobeRediscoveryService = {
  /**
   * 전체 옷장·오늘까지의 착용 기록으로 최대 세 벌을 선정하고 하루 선택을 계정에 고정한다.
   * 삭제·분류 변경·최근 착용으로 자격을 잃은 옷은 당일에도 제외하며, 노출 기록은 별도 확인 요청에서만 남긴다.
   */
  async get(userId: string) {
    const today = getKoreaTodayUtc()
    const day = today.toISOString().slice(0, 10)
    const [candidates, records] = await Promise.all([
      repository.findCandidates(userId), wardrobeRepository.findWearHistory(userId, today),
    ])
    const wear = getWardrobeWearStats(records)
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const state = await repository.findState(userId)
      const impressions = parseRediscoveryImpressions(state?.impressions)
      const ranked = rankRediscoveryCandidates(candidates, wear, impressions, today)
      let itemIds = state?.itemIds ?? []
      if (!state || state.day < day) {
        itemIds = ranked.slice(0, REDISCOVERY_LIMIT).map((item) => item.id)
        // 보관한 옷의 이력은 정리하고 현재 옷장의 마지막 노출일만 유지한다.
        const ownedIds = new Set(candidates.map((item) => item.id))
        const retained = Object.fromEntries(Object.entries(impressions).filter(([id]) => ownedIds.has(id)))
        const saved = state
          ? await repository.updateState(userId, state.version, { day, itemIds, impressions: retained })
          : await repository.createState(userId, day, itemIds)
        if (!saved) continue
      }
      const eligibleIds = new Set(ranked.map((item) => item.id))
      const selectedIds = itemIds.filter((id) => eligibleIds.has(id))
      const items = selectedIds.length ? await wardrobeRepository.findManyOwnedWithImagesByIds(userId, selectedIds) : []
      return {
        day,
        items: selectedIds.flatMap((id) => {
          const item = items.find((candidate) => candidate.id === id)
          if (!item) return []
          const stats = wear.get(id)
          return [{ item: { ...item, wearCount: stats?.wearCount ?? 0, lastWornAt: stats?.lastWornAt ?? null }, ...getRediscoveryReason(stats, today) }]
        }),
      }
    }
    throw new ServiceError('옷장 하이라이트를 다시 불러와주세요.', 'WARDROBE_REDISCOVERY_CONFLICT')
  },

  /** 오늘 선정한 내 옷 중 실제 보인 ID만 기록한다. 같은 날 중복 확인은 쓰기 없이 성공하고 다른 날짜·임의 ID는 거절한다. */
  async markSeen(userId: string, day: string, itemIds: string[]) {
    const today = getKoreaTodayUtc().toISOString().slice(0, 10)
    if (day !== today || itemIds.length === 0 || itemIds.length > REDISCOVERY_LIMIT || new Set(itemIds).size !== itemIds.length) {
      throw new ServiceError('올바른 오늘의 하이라이트가 필요합니다.', 'INVALID_WARDROBE_REDISCOVERY')
    }
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const state = await repository.findState(userId)
      if (!state || state.day !== day || itemIds.some((id) => !state.itemIds.includes(id))) {
        throw new ServiceError('오늘 선정한 내 옷만 확인할 수 있습니다.', 'INVALID_WARDROBE_REDISCOVERY')
      }
      const impressions = parseRediscoveryImpressions(state.impressions)
      const items = await wardrobeRepository.findManyOwnedByIds(userId, itemIds)
      if (items.length !== itemIds.length) {
        throw new ServiceError('옷장에서 삭제된 옷은 확인할 수 없습니다.', 'INVALID_WARDROBE_REDISCOVERY')
      }
      if (itemIds.every((id) => impressions[id] === day)) return true
      for (const id of itemIds) impressions[id] = day
      if (await repository.updateState(userId, state.version, { impressions })) return true
    }
    throw new ServiceError('노출 기록을 다시 저장해주세요.', 'WARDROBE_REDISCOVERY_CONFLICT')
  },
}
