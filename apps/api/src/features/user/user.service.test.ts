import assert from 'node:assert/strict'
import test from 'node:test'
import { userRepository, type ViewerRecord } from './user.repository.js'
import {
  defaultWearReminderPreferences,
  toViewerResponse,
  userService,
  type UpdateWearReminderPreferencesInput,
} from './user.service.js'

function createViewer(
  settings: ViewerRecord['settings'] = null,
): ViewerRecord {
  return {
    id: 'viewer',
    displayName: '테스트 사용자',
    email: null,
    isTemporary: true,
    styleProfile: null,
    preferredStyles: [],
    settings,
  } as unknown as ViewerRecord
}

test('설정이 없는 기존 사용자는 최근 착용 리마인드 기본값을 받는다', () => {
  const viewer = toViewerResponse(createViewer())

  assert.deepEqual(
    viewer.wearReminderPreferences,
    defaultWearReminderPreferences,
  )
})

test('최근 착용 알림 기간은 1일에서 30일 사이의 정수만 허용한다', async () => {
  const validInput: UpdateWearReminderPreferencesInput = {
    enabled: true,
    intervalDays: 7,
    combinationReminderEnabled: true,
    itemReminderEnabled: true,
  }

  for (const intervalDays of [0, 31, 1.5, Number.NaN]) {
    await assert.rejects(
      userService.updateWearReminderPreferences('viewer', {
        ...validInput,
        intervalDays,
      }),
      { code: 'INVALID_WEAR_REMINDER_PREFERENCES' },
    )
  }
})

test('검증한 최근 착용 리마인드 설정을 사용자 계정에 저장한다', async (t) => {
  const input: UpdateWearReminderPreferencesInput = {
    enabled: true,
    intervalDays: 14,
    combinationReminderEnabled: false,
    itemReminderEnabled: true,
  }
  const settings = {
    id: 'settings',
    userId: 'viewer',
    ...input,
    createdAt: new Date('2026-09-02T00:00:00.000Z'),
    updatedAt: new Date('2026-09-02T00:00:00.000Z'),
  }
  const update = t.mock.method(
    userRepository,
    'updateWearReminderPreferences',
    async (userId: string, receivedInput: UpdateWearReminderPreferencesInput) => {
      assert.equal(userId, 'viewer')
      assert.deepEqual(receivedInput, input)
      return createViewer(settings)
    },
  )

  const viewer = await userService.updateWearReminderPreferences('viewer', input)

  assert.equal(update.mock.callCount(), 1)
  assert.deepEqual(toViewerResponse(viewer).wearReminderPreferences, input)
})
