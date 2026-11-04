import assert from 'node:assert/strict'
import test from 'node:test'
import { canConfirmPlannerWear, getKoreaPlannerToday } from '../src/features/plan/utils/plannerWear'

test('착용 확인 날짜는 기기의 현지 날짜가 아닌 한국 자정을 기준으로 바뀐다', () => {
  assert.equal(getKoreaPlannerToday(new Date('2026-11-03T14:59:59Z')), '2026-11-03')
  assert.equal(getKoreaPlannerToday(new Date('2026-11-03T15:00:00Z')), '2026-11-04')
})

test('저장한 오늘·지난 코디만 확인할 수 있고 미래·저장 전 편집은 제외한다', () => {
  const today = '2026-11-04'
  assert.equal(canConfirmPlannerWear({ date: today, outfitId: 'saved' }, today), true)
  assert.equal(canConfirmPlannerWear({ date: '2026-11-03', outfitId: 'saved' }, today), true)
  assert.equal(canConfirmPlannerWear({ date: '2026-11-05', outfitId: 'saved' }, today), false)
  assert.equal(canConfirmPlannerWear({ date: today }, today), false)
})
