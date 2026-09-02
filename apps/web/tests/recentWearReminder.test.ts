import assert from 'node:assert/strict'
import test from 'node:test'
import type { WardrobeItem } from '@closet/types'
import {
  getRecentWearReminderCopy,
  type RecentWearReminderRequest,
} from '../src/features/plan/utils/recentWearReminder'
import { useUiStore } from '../src/stores/useUiStore'

const wardrobeItems = [
  { id: 'denim', name: '데님 팬츠' },
  { id: 'shirt', name: '흰 셔츠' },
  { id: 'jacket', name: '검은 재킷' },
] as WardrobeItem[]

function createReminder(
  input: Partial<RecentWearReminderRequest>,
): RecentWearReminderRequest {
  return {
    kind: 'combination',
    wornDate: '2026-08-26',
    itemIds: ['denim', 'shirt'],
    outfitName: null,
    targetDate: '2026-09-02',
    intervalDays: 7,
    confirmLabel: '그래도 추가',
    cancelLabel: '다시 고르기',
    ...input,
  }
}

test('같은 핵심 조합과 일주일 전 착용 시점을 함께 안내한다', () => {
  const copy = getRecentWearReminderCopy(
    createReminder({}),
    wardrobeItems,
  )

  assert.equal(copy.title, '최근에 입은 조합이에요')
  assert.match(copy.description, /데님 팬츠와 흰 셔츠 조합/)
  assert.match(copy.description, /일주일 전에 입었어요/)
  assert.match(copy.description, /최근 7일 이내/)
})

test('완전히 같은 코디는 코디 이름을 우선해서 안내한다', () => {
  const copy = getRecentWearReminderCopy(
    createReminder({
      kind: 'exact',
      outfitName: '출근 코디',
      itemIds: ['denim', 'shirt', 'jacket'],
    }),
    wardrobeItems,
  )

  assert.equal(copy.title, '같은 코디를 최근에 입었어요')
  assert.match(copy.description, /'출근 코디'와 같은 구성/)
})

test('개별 옷 충돌은 해당 옷 이름만 보여준다', () => {
  const copy = getRecentWearReminderCopy(
    createReminder({
      kind: 'item',
      wornDate: '2026-08-30',
      itemIds: ['denim'],
    }),
    wardrobeItems,
  )

  assert.equal(copy.title, '최근에 입은 옷이에요')
  assert.match(copy.description, /데님 팬츠/)
  assert.match(copy.description, /3일 전에/)
  assert.doesNotMatch(copy.description, /흰 셔츠/)
})

test('전역 확인창의 응답을 저장 동작에 전달한다', async () => {
  const reminder = createReminder({})
  const confirmation = useUiStore
    .getState()
    .requestRecentWearConfirmation(reminder, 'first-owner')

  assert.deepEqual(useUiStore.getState().recentWearConfirmation, reminder)
  useUiStore.getState().resolveRecentWearConfirmation(true)

  assert.equal(await confirmation, true)
  assert.equal(useUiStore.getState().recentWearConfirmation, null)
})

test('확인창이 열린 동안 들어온 두 번째 요청은 기존 확인을 바꾸지 않는다', async () => {
  const firstReminder = createReminder({})
  const secondReminder = createReminder({
    kind: 'item',
    itemIds: ['jacket'],
  })
  const firstConfirmation = useUiStore
    .getState()
    .requestRecentWearConfirmation(firstReminder, 'first-owner')
  const secondConfirmation = useUiStore
    .getState()
    .requestRecentWearConfirmation(secondReminder, 'second-owner')

  assert.equal(await secondConfirmation, false)
  assert.deepEqual(
    useUiStore.getState().recentWearConfirmation,
    firstReminder,
  )

  useUiStore.getState().resolveRecentWearConfirmation(false)
  assert.equal(await firstConfirmation, false)
  assert.equal(useUiStore.getState().recentWearConfirmation, null)
})

test('확인창을 연 화면만 자신의 대기 요청을 취소할 수 있다', async () => {
  const reminder = createReminder({})
  const confirmation = useUiStore
    .getState()
    .requestRecentWearConfirmation(reminder, 'dialog-owner')

  useUiStore.getState().cancelRecentWearConfirmation('another-owner')
  assert.deepEqual(useUiStore.getState().recentWearConfirmation, reminder)

  useUiStore.getState().cancelRecentWearConfirmation('dialog-owner')
  assert.equal(await confirmation, false)
  assert.equal(useUiStore.getState().recentWearConfirmation, null)
})
