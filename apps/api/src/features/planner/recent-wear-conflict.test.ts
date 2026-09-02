/**
 * 용도:
 * 최근 착용 충돌의 우선순위와 플래너 조회 입력 검증을 확인한다.
 *
 * 동작 방식:
 * 순수 판별 함수에는 여러 날짜의 코디 기록을 넣어 결과를 비교하고,
 * 서비스 테스트에서는 저장소를 대체해 날짜 범위와 오류 코드를 검증한다.
 */

import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import type { ClothingCategory } from '@prisma/client'
import { ServiceError } from '../../graphql/errors.js'
import { toDateOnly } from '../../lib/date.js'
import { getKoreaTodayUtc } from '../wardrobe/wardrobe.service.js'
import { plannerRepository } from './planner.repository.js'
import { plannerService, type RecentWearConflictInput } from './planner.service.js'
import {
  findRecentWearConflict,
  type RecentWearHistoryRecord,
} from './recent-wear-conflict.js'

const itemIds = {
  top: '000000000000000000000001',
  bottom: '000000000000000000000002',
  outer: '000000000000000000000003',
  shoes: '000000000000000000000004',
  accessory: '000000000000000000000005',
  otherTop: '000000000000000000000006',
  otherBottom: '000000000000000000000007',
}

function record(
  date: string,
  name: string,
  items: Array<[string, ClothingCategory]>,
): RecentWearHistoryRecord {
  return {
    date: new Date(`${date}T00:00:00.000Z`),
    outfit: {
      name,
      items: items.map(([wardrobeItemId, slot]) => ({ wardrobeItemId, slot })),
    },
  }
}

const allReminders = {
  combinationReminderEnabled: true,
  itemReminderEnabled: true,
}

test('더 최근의 부분 조합보다 전체 구성이 같은 기록을 우선한다', () => {
  const conflict = findRecentWearConflict(
    [
      record('2026-08-28', '최근 한 벌', [
        [itemIds.top, 'top'],
        [itemIds.otherBottom, 'bottom'],
      ]),
      record('2026-08-27', '최근 조합', [
        [itemIds.top, 'top'],
        [itemIds.bottom, 'bottom'],
        [itemIds.outer, 'outer'],
      ]),
      record('2026-08-24', '같은 코디', [
        [itemIds.top, 'top'],
        [itemIds.bottom, 'bottom'],
        [itemIds.shoes, 'shoes'],
      ]),
    ],
    [itemIds.top, itemIds.bottom, itemIds.shoes],
    allReminders,
  )

  assert.equal(conflict?.kind, 'exact')
  assert.equal(conflict?.wornDate.toISOString(), '2026-08-24T00:00:00.000Z')
  assert.equal(conflict?.outfitName, '같은 코디')
  assert.deepEqual(conflict?.itemIds, [
    itemIds.top,
    itemIds.bottom,
    itemIds.shoes,
  ])
})

test('전체 구성이 없으면 핵심 옷 두 개 이상이 겹치는 가장 최근 조합을 찾는다', () => {
  const conflict = findRecentWearConflict(
    [
      record('2026-08-28', '개별 상의', [
        [itemIds.top, 'top'],
        [itemIds.otherBottom, 'bottom'],
      ]),
      record('2026-08-26', '최근 핵심 조합', [
        [itemIds.top, 'top'],
        [itemIds.bottom, 'bottom'],
        [itemIds.outer, 'outer'],
      ]),
      record('2026-08-23', '이전 핵심 조합', [
        [itemIds.top, 'top'],
        [itemIds.bottom, 'bottom'],
        [itemIds.accessory, 'accessory'],
      ]),
    ],
    [itemIds.bottom, itemIds.top, itemIds.shoes],
    allReminders,
  )

  assert.equal(conflict?.kind, 'combination')
  assert.equal(conflict?.wornDate.toISOString(), '2026-08-26T00:00:00.000Z')
  assert.deepEqual(conflict?.itemIds, [itemIds.bottom, itemIds.top])
})

test('신발과 액세서리만 겹치면 조합이나 개별 아이템 충돌로 보지 않는다', () => {
  const conflict = findRecentWearConflict(
    [
      record('2026-08-28', '소품이 같은 코디', [
        [itemIds.shoes, 'shoes'],
        [itemIds.accessory, 'accessory'],
        [itemIds.otherTop, 'top'],
      ]),
    ],
    [itemIds.shoes, itemIds.accessory],
    allReminders,
  )

  assert.equal(conflict, null)
})

test('조합 알림을 끄면 가장 최근 핵심 단일 아이템 기록만 반환한다', () => {
  const conflict = findRecentWearConflict(
    [
      record('2026-08-28', '최근 하의', [
        [itemIds.bottom, 'bottom'],
        [itemIds.otherTop, 'top'],
      ]),
      record('2026-08-27', '같은 코디', [
        [itemIds.top, 'top'],
        [itemIds.bottom, 'bottom'],
      ]),
    ],
    [itemIds.top, itemIds.bottom],
    { combinationReminderEnabled: false, itemReminderEnabled: true },
  )

  assert.equal(conflict?.kind, 'item')
  assert.equal(conflict?.wornDate.toISOString(), '2026-08-28T00:00:00.000Z')
  assert.deepEqual(conflict?.itemIds, [itemIds.bottom])
})

test('두 알림을 모두 끄거나 유효한 기록이 없으면 충돌을 반환하지 않는다', () => {
  const records = [
    record('2026-08-28', '착용 코디', [
      [itemIds.top, 'top'],
      [itemIds.bottom, 'bottom'],
    ]),
    { date: new Date('2026-08-27T00:00:00.000Z'), outfit: null },
  ]

  assert.equal(
    findRecentWearConflict(records, [itemIds.top, itemIds.bottom], {
      combinationReminderEnabled: false,
      itemReminderEnabled: false,
    }),
    null,
  )
  assert.equal(
    findRecentWearConflict(records, [itemIds.outer], allReminders),
    null,
  )
})

function createServiceInput(
  updates: Partial<RecentWearConflictInput> = {},
): RecentWearConflictInput {
  const tomorrow = new Date(getKoreaTodayUtc().getTime() + 24 * 60 * 60 * 1000)
  return {
    itemIds: [itemIds.top, itemIds.bottom],
    targetDate: toDateOnly(tomorrow),
    intervalDays: 7,
    combinationReminderEnabled: true,
    itemReminderEnabled: true,
    ...updates,
  }
}

function mockRecentWearHistory(
  t: TestContext,
  records: RecentWearHistoryRecord[] = [],
) {
  return t.mock.method(
    plannerRepository,
    'findRecentWearHistory',
    async () => records,
  )
}

test('서비스는 N일 전을 포함하는 범위와 오늘 상한으로 기록을 조회한다', async (t) => {
  const today = getKoreaTodayUtc()
  const input = createServiceInput()
  const targetDate = new Date(`${input.targetDate}T00:00:00.000Z`)
  const rangeStart = new Date(
    targetDate.getTime() - input.intervalDays * 24 * 60 * 60 * 1000,
  )
  const history = mockRecentWearHistory(t, [
    record(toDateOnly(rangeStart), '경계 날짜 코디', [
      [itemIds.top, 'top'],
      [itemIds.bottom, 'bottom'],
    ]),
  ])

  const result = await plannerService.getRecentWearConflict('viewer', input)

  assert.deepEqual(history.mock.calls[0]?.arguments, [
    'viewer',
    input.itemIds,
    rangeStart,
    targetDate,
    today,
  ])
  assert.deepEqual(result, {
    kind: 'exact',
    wornDate: toDateOnly(rangeStart),
    itemIds: input.itemIds,
    outfitName: '경계 날짜 코디',
  })
})

test('대상 날짜 포함 옵션을 켜면 오늘 기록까지 조회한다', async (t) => {
  const today = getKoreaTodayUtc()
  const rangeEndExclusive = new Date(
    today.getTime() + 24 * 60 * 60 * 1000,
  )
  const input = createServiceInput({
    targetDate: toDateOnly(today),
    includeTargetDate: true,
  })
  const rangeStart = new Date(
    today.getTime() - input.intervalDays * 24 * 60 * 60 * 1000,
  )
  const history = mockRecentWearHistory(t, [
    record(toDateOnly(today), '오늘 입은 코디', [
      [itemIds.top, 'top'],
      [itemIds.bottom, 'bottom'],
    ]),
  ])

  const result = await plannerService.getRecentWearConflict('viewer', input)

  assert.deepEqual(history.mock.calls[0]?.arguments, [
    'viewer',
    input.itemIds,
    rangeStart,
    rangeEndExclusive,
    today,
  ])
  assert.deepEqual(result, {
    kind: 'exact',
    wornDate: toDateOnly(today),
    itemIds: input.itemIds,
    outfitName: '오늘 입은 코디',
  })
})

test('알림을 모두 끄거나 조회 시작일이 오늘보다 미래면 저장소를 조회하지 않는다', async (t) => {
  const history = mockRecentWearHistory(t)

  assert.equal(
    await plannerService.getRecentWearConflict(
      'viewer',
      createServiceInput({
        combinationReminderEnabled: false,
        itemReminderEnabled: false,
      }),
    ),
    null,
  )
  assert.equal(
    await plannerService.getRecentWearConflict(
      'viewer',
      createServiceInput({ targetDate: '2099-01-31', intervalDays: 1 }),
    ),
    null,
  )
  assert.equal(history.mock.callCount(), 0)
})

test('최근 착용 조회 입력의 간격과 아이템 ID를 검증한다', async () => {
  const tooManyIds = Array.from({ length: 21 }, (_, index) =>
    index.toString(16).padStart(24, '0'),
  )
  const cases: Array<{
    name: string
    input: Partial<RecentWearConflictInput>
    code: string
  }> = [
    { name: '0일 간격', input: { intervalDays: 0 }, code: 'INVALID_WEAR_REMINDER_INTERVAL' },
    { name: '31일 간격', input: { intervalDays: 31 }, code: 'INVALID_WEAR_REMINDER_INTERVAL' },
    { name: '소수 간격', input: { intervalDays: 1.5 }, code: 'INVALID_WEAR_REMINDER_INTERVAL' },
    { name: '빈 아이템', input: { itemIds: [] }, code: 'INVALID_WEAR_REMINDER_ITEMS' },
    { name: '21개 아이템', input: { itemIds: tooManyIds }, code: 'WEAR_REMINDER_ITEM_LIMIT_EXCEEDED' },
    { name: '잘못된 ID', input: { itemIds: ['not-an-object-id'] }, code: 'INVALID_WARDROBE_ITEM_ID' },
    { name: '중복 ID', input: { itemIds: [itemIds.top, itemIds.top] }, code: 'DUPLICATE_WEAR_REMINDER_ITEM' },
  ]

  for (const example of cases) {
    await assert.rejects(
      plannerService.getRecentWearConflict(
        'viewer',
        createServiceInput(example.input),
      ),
      (error) =>
        error instanceof ServiceError &&
        error.code === example.code &&
        Boolean(example.name),
    )
  }
})
