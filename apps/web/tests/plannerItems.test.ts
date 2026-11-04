import assert from 'node:assert/strict'
import test from 'node:test'
import type { WardrobeItem } from '@closet/types'
import { createEmptyPlanEntry, moveWeeklyPlanOutfits, createEmptyWeeklyPlan } from '../src/features/plan/data/weeklyPlan'
import { getPlanEntryItems } from '../src/features/plan/utils/plannerItems'
import { usePlanStore } from '../src/features/plan/stores/usePlanStore'

function item(id: string, archivedAt?: string): WardrobeItem {
  return {
    id, name: `${id} 옷`, createdAt: '2026-11-01T00:00:00.000Z', archivedAt,
    category: 'top', additionalCategories: [], classificationStatus: 'classified',
    colorName: '네이비', colorHex: '#24364a', seasons: ['autumn'], tags: [], wearCount: 1,
    imageUrl: `https://example.test/${id}.png`,
  }
}

test('활성 옷장에 없는 삭제된 옷도 날짜 코디의 순서·이름·사진으로 표시한다', () => {
  const archived = item('B', '2026-11-05T00:00:00.000Z')
  const active = [item('A'), item('C')]
  const entry = { itemIds: ['C', 'B', 'A'], outfitItems: [item('A'), archived, item('C')] }
  const result = getPlanEntryItems(entry, active)
  assert.deepEqual(result.map((value) => value.id), ['C', 'B', 'A'])
  assert.equal(result[1]?.name, 'B 옷')
  assert.equal(result[1]?.imageUrl, 'https://example.test/B.png')
  assert.equal(result[1]?.archivedAt, archived.archivedAt)
  assert.deepEqual(active.map((value) => value.id), ['A', 'C'])
})

test('삭제 전 옷장 캐시보다 날짜 관계의 삭제 상태를 우선하고 새로 고른 옷은 활성 목록에서 찾는다', () => {
  const archived = item('B', '2026-11-05T00:00:00.000Z')
  const result = getPlanEntryItems({ itemIds: ['B', 'D'], outfitItems: [archived, item('C')] }, [item('B'), item('D')])
  assert.equal(result[0]?.archivedAt, archived.archivedAt)
  assert.deepEqual(result.map((value) => value.id), ['B', 'D'])
  assert.deepEqual(getPlanEntryItems({ itemIds: ['missing'] }, []), [])
})

test('날짜 이동은 삭제된 옷의 표시 정보도 옮기고 원래 날짜에서는 비운다', () => {
  const entries = createEmptyWeeklyPlan('2026-11-02')
  const archived = item('B', '2026-11-05T00:00:00.000Z')
  entries[0] = { ...entries[0]!, itemIds: ['B'], outfitItems: [archived], outfitId: 'snapshot' }
  const moved = moveWeeklyPlanOutfits(entries, '2026-11-02', '2026-11-03')
  assert.deepEqual(getPlanEntryItems(moved[1]!, []), [archived])
  assert.deepEqual(getPlanEntryItems(moved[0]!, []), [])
  assert.equal(moved[0]?.outfitItems, undefined)
})

test('초안에서 남겨둔 삭제 옷은 표시하고 제거한 옷은 숨기며 일정 해제 시 관계 정보도 비운다', () => {
  const original = usePlanStore.getState().entries
  try {
    const archived = item('B', '2026-11-05T00:00:00.000Z')
    usePlanStore.setState({ entries: [{ ...createEmptyPlanEntry('2026-11-02'), itemIds: ['A', 'B', 'C'], outfitItems: [item('A'), archived, item('C')], outfitId: 'snapshot' }] })
    usePlanStore.getState().setEntryItems('2026-11-02', ['B', 'D'])
    assert.deepEqual(getPlanEntryItems(usePlanStore.getState().entries[0]!, [item('D')]).map((value) => value.id), ['B', 'D'])
    usePlanStore.getState().setEntryItems('2026-11-02', ['D'])
    assert.deepEqual(getPlanEntryItems(usePlanStore.getState().entries[0]!, [item('D')]).map((value) => value.id), ['D'])
    usePlanStore.getState().clearOutfit('2026-11-02')
    assert.equal(usePlanStore.getState().entries[0]?.outfitItems, undefined)
  } finally {
    usePlanStore.setState({ entries: original })
  }
})
