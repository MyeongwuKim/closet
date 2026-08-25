import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createEmptyWeeklyPlan,
  mergeWeeklyPlanEntries,
  moveArrayItem,
  moveWeeklyPlanOutfits,
  placePlanOutfitInDate,
  shouldMovePlanRow,
} from '../src/features/plan/data/weeklyPlan'

test('빈 요일로 옮기면 코디만 이동하고 날짜 정보는 유지한다', () => {
  const entries = createEmptyWeeklyPlan('2026-08-24').map((entry, index) => ({
    ...entry,
    occasion: index === 0 ? '출근' : index === 1 ? '약속' : '',
    weather: index === 0 ? '25° · 맑음' : index === 1 ? '23° · 비' : '',
    ...(index === 0
      ? {
          title: '월요일 코디',
          itemIds: ['coat', 'pants'],
          outfitId: 'outfit-monday',
          plannerOnly: false,
        }
      : {}),
  }))

  const moved = moveWeeklyPlanOutfits(entries, '2026-08-24', '2026-08-25')
  const monday = moved.find((entry) => entry.date === '2026-08-24')
  const tuesday = moved.find((entry) => entry.date === '2026-08-25')

  assert.equal(monday?.outfitId, undefined)
  assert.equal(monday?.occasion, '출근')
  assert.equal(monday?.weather, '25° · 맑음')
  assert.equal(tuesday?.outfitId, 'outfit-monday')
  assert.deepEqual(tuesday?.itemIds, ['coat', 'pants'])
  assert.equal(tuesday?.occasion, '약속')
  assert.equal(tuesday?.weather, '23° · 비')
})

test('여러 요일을 건너 이동하면 사이 코디가 한 칸씩 당겨진다', () => {
  const entries = createEmptyWeeklyPlan('2026-08-24').map((entry, index) => ({
    ...entry,
    ...(index === 0
      ? { title: 'A', itemIds: ['a'], outfitId: 'outfit-a' }
      : index === 1
        ? { title: 'B', itemIds: ['b'], outfitId: 'outfit-b' }
        : index === 2
          ? { title: 'C', itemIds: ['c'], outfitId: 'outfit-c' }
        : {}),
  }))

  const moved = moveWeeklyPlanOutfits(entries, '2026-08-24', '2026-08-26')

  assert.equal(moved[0]?.outfitId, 'outfit-b')
  assert.equal(moved[0]?.title, 'B')
  assert.equal(moved[1]?.outfitId, 'outfit-c')
  assert.equal(moved[1]?.title, 'C')
  assert.equal(moved[2]?.outfitId, 'outfit-a')
  assert.equal(moved[2]?.title, 'A')
})

test('화면 미리보기 순서도 드래그 위치에 맞춰 이동한다', () => {
  assert.deepEqual(moveArrayItem(['월', '화', '수', '목'], 0, 2), [
    '화',
    '수',
    '월',
    '목',
  ])
  assert.deepEqual(moveArrayItem(['월', '화', '수', '목'], 3, 1), [
    '월',
    '목',
    '화',
    '수',
  ])
})

test('드래그 포인터가 행의 중간을 지나야 순서를 바꾼다', () => {
  assert.equal(shouldMovePlanRow(0, 1, 39, 80), false)
  assert.equal(shouldMovePlanRow(0, 1, 40, 80), true)
  assert.equal(shouldMovePlanRow(2, 1, 41, 80), false)
  assert.equal(shouldMovePlanRow(2, 1, 40, 80), true)
})

test('미리보기 코디를 옮겨도 화면 슬롯의 날짜 정보는 유지한다', () => {
  const [monday, tuesday] = createEmptyWeeklyPlan('2026-08-24')
  const mondayOutfit = {
    ...monday!,
    title: '월요일 코디',
    itemIds: ['coat'],
    outfitId: 'outfit-monday',
  }
  const preview = placePlanOutfitInDate(tuesday!, mondayOutfit)

  assert.equal(preview.date, '2026-08-25')
  assert.equal(preview.dayLabel, '화')
  assert.equal(preview.outfitId, 'outfit-monday')
  assert.deepEqual(preview.itemIds, ['coat'])
})

test('서버에 없는 날짜를 합칠 때도 한 주 7일을 채운다', () => {
  const remoteEntry = {
    ...createEmptyWeeklyPlan('2026-08-24')[2]!,
    title: '수요일 코디',
    itemIds: ['shirt'],
    outfitId: 'outfit-wednesday',
  }
  const merged = mergeWeeklyPlanEntries('2026-08-24', [remoteEntry])

  assert.equal(merged.length, 7)
  assert.equal(merged[2]?.outfitId, 'outfit-wednesday')
  assert.deepEqual(merged[0]?.itemIds, [])
})
