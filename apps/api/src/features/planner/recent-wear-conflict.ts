/**
 * 용도:
 * 최근 플래너 착용 기록과 새로 고른 옷을 비교해
 * 같은 코디나 핵심 조합, 개별 아이템 충돌을 찾는다.
 *
 * 동작 방식:
 * 전체 구성이 같은 기록을 먼저 찾고, 그다음 핵심 옷 두 개 이상의 조합과
 * 핵심 옷 한 개의 최근 기록 순서로 우선순위를 적용한다.
 */

import type { ClothingCategory } from '@prisma/client'

const coreCategories = new Set<ClothingCategory>([
  'top',
  'bottom',
  'outer',
  'midlayer',
  'dress',
])

export type RecentWearConflictKind = 'exact' | 'combination' | 'item'

export interface RecentWearHistoryRecord {
  date: Date
  outfit: {
    name: string
    items: Array<{
      wardrobeItemId: string
      slot: ClothingCategory
    }>
  } | null
}

export interface RecentWearConflictMatch {
  kind: RecentWearConflictKind
  wornDate: Date
  itemIds: string[]
  outfitName: string | null
}

export interface RecentWearConflictOptions {
  combinationReminderEnabled: boolean
  itemReminderEnabled: boolean
}

function isSameItemSet(leftIds: string[], rightIds: string[]) {
  if (leftIds.length !== rightIds.length) return false
  const rightIdSet = new Set(rightIds)
  return leftIds.every((itemId) => rightIdSet.has(itemId))
}

function findLatestMatch(
  records: RecentWearHistoryRecord[],
  createMatch: (
    record: RecentWearHistoryRecord,
  ) => RecentWearConflictMatch | null,
) {
  let latestMatch: RecentWearConflictMatch | null = null

  for (const record of records) {
    const match = createMatch(record)
    if (
      match &&
      (!latestMatch || match.wornDate.getTime() > latestMatch.wornDate.getTime())
    ) {
      latestMatch = match
    }
  }

  return latestMatch
}

export function findRecentWearConflict(
  records: RecentWearHistoryRecord[],
  selectedItemIds: string[],
  options: RecentWearConflictOptions,
): RecentWearConflictMatch | null {
  const selectedItemIdSet = new Set(selectedItemIds)

  if (options.combinationReminderEnabled) {
    const exactMatch = findLatestMatch(records, (record) => {
      if (!record.outfit) return null
      const outfitItemIds = [
        ...new Set(record.outfit.items.map(({ wardrobeItemId }) => wardrobeItemId)),
      ]
      if (!isSameItemSet(selectedItemIds, outfitItemIds)) return null

      return {
        kind: 'exact',
        wornDate: record.date,
        itemIds: [...selectedItemIds],
        outfitName: record.outfit.name,
      }
    })
    if (exactMatch) return exactMatch

    const combinationMatch = findLatestMatch(records, (record) => {
      if (!record.outfit) return null
      const matchingCoreItemIds = record.outfit.items.flatMap((item) =>
        selectedItemIdSet.has(item.wardrobeItemId) &&
        coreCategories.has(item.slot)
          ? [item.wardrobeItemId]
          : [],
      )
      const uniqueMatchingItemIds = [...new Set(matchingCoreItemIds)]
      if (uniqueMatchingItemIds.length < 2) return null

      return {
        kind: 'combination',
        wornDate: record.date,
        itemIds: selectedItemIds.filter((itemId) =>
          uniqueMatchingItemIds.includes(itemId),
        ),
        outfitName: record.outfit.name,
      }
    })
    if (combinationMatch) return combinationMatch
  }

  if (!options.itemReminderEnabled) return null

  return findLatestMatch(records, (record) => {
    if (!record.outfit) return null
    const matchingItem = record.outfit.items.find(
      (item) =>
        selectedItemIdSet.has(item.wardrobeItemId) &&
        coreCategories.has(item.slot),
    )
    if (!matchingItem) return null

    return {
      kind: 'item',
      wornDate: record.date,
      itemIds: [matchingItem.wardrobeItemId],
      outfitName: record.outfit.name,
    }
  })
}
