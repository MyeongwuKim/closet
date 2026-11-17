/**
 * 용도:
 * 사용자 프로필과 계정 설정의 입력값을 검증하고 응답 형태로 정리한다.
 *
 * 동작 방식:
 * 설정별 유효성 검사를 거친 뒤 저장소를 호출하고 Viewer 응답을 반환한다.
 */
import type {
  BodyBuild,
  Gender,
  OutfitStyle,
  PreferredFit,
} from '@prisma/client'
import { ServiceError } from '../../graphql/errors.js'
import { userRepository, type ViewerRecord } from './user.repository.js'

export interface UpdateMyStyleProfileInput {
  gender: Gender
  bodyBuild: BodyBuild
  heightCm?: number | null
  weightKg?: number | null
  chestCircumferenceCm?: number | null
  waistCircumferenceCm?: number | null
  hipCircumferenceCm?: number | null
  thighCircumferenceCm?: number | null
  shoulderWidthCm?: number | null
  inseamCm?: number | null
  preferredFit: PreferredFit
  preferredStyles: OutfitStyle[]
}

export interface UpdateWearReminderPreferencesInput {
  enabled: boolean
  intervalDays: number
  combinationReminderEnabled: boolean
  itemReminderEnabled: boolean
}

export const defaultWearReminderPreferences = {
  enabled: false,
  intervalDays: 7,
  combinationReminderEnabled: true,
  itemReminderEnabled: true,
} as const

function validateBodyValue(
  value: number | null | undefined,
  min: number,
  max: number,
  label: string,
) {
  if (value === null || value === undefined) return
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new ServiceError(
      `${label} 값은 ${min}에서 ${max} 사이여야 해요.`,
      'INVALID_STYLE_PROFILE',
    )
  }
}

export function toViewerResponse(viewer: ViewerRecord) {
  return {
    id: viewer.id,
    displayName: viewer.displayName,
    email: viewer.email,
    isTemporary: viewer.isTemporary,
    rediscoveryPushEnabled: viewer.settings?.rediscoveryPushEnabled ?? false,
    completionPushEnabled: viewer.settings?.completionPushEnabled ?? true,
    styleProfile: {
      gender: viewer.styleProfile?.gender ?? null,
      bodyBuild: viewer.styleProfile?.bodyBuild ?? null,
      heightCm: viewer.styleProfile?.heightCm ?? null,
      weightKg: viewer.styleProfile?.weightKg ?? null,
      chestCircumferenceCm:
        viewer.styleProfile?.chestCircumferenceCm ?? null,
      waistCircumferenceCm:
        viewer.styleProfile?.waistCircumferenceCm ?? null,
      hipCircumferenceCm:
        viewer.styleProfile?.hipCircumferenceCm ?? null,
      thighCircumferenceCm:
        viewer.styleProfile?.thighCircumferenceCm ?? null,
      shoulderWidthCm: viewer.styleProfile?.shoulderWidthCm ?? null,
      inseamCm: viewer.styleProfile?.inseamCm ?? null,
      preferredFit: viewer.styleProfile?.preferredFit ?? 'regular',
      preferredStyles: viewer.preferredStyles.map(({ style }) => style),
    },
    wearReminderPreferences: {
      enabled:
        viewer.settings?.enabled ?? defaultWearReminderPreferences.enabled,
      intervalDays:
        viewer.settings?.intervalDays ??
        defaultWearReminderPreferences.intervalDays,
      combinationReminderEnabled:
        viewer.settings?.combinationReminderEnabled ??
        defaultWearReminderPreferences.combinationReminderEnabled,
      itemReminderEnabled:
        viewer.settings?.itemReminderEnabled ??
        defaultWearReminderPreferences.itemReminderEnabled,
    },
  }
}

export const userService = {
  /** 인증된 계정의 로그인 표시 정보를 반환한다. 존재하지 않는 계정은 로그인 만료로 처리한다. */
  async getAccountInfo(userId: string) {
    const account = await userRepository.findAccountInfoById(userId)
    if (!account) throw new ServiceError('로그인이 필요해요.', 'UNAUTHENTICATED')
    return { displayName: account.displayName, email: account.email, loginId: account.testAccount?.loginId ?? null }
  },

  /** 기존 사용자는 기본 ON으로 유지한다. 명시한 본인 계정의 완료·실패 푸시 수신 여부만 변경한다. */
  async setCompletionPushEnabled(userId: string, enabled: boolean) {
    if (typeof enabled !== 'boolean') throw new ServiceError('알림 수신 여부가 필요해요.', 'INVALID_COMPLETION_PUSH_PREFERENCE')
    const viewer = await userRepository.setCompletionPushEnabled(userId, enabled)
    if (!viewer) throw new ServiceError('사용자를 찾을 수 없어요.', 'USER_NOT_FOUND')
    return viewer
  },

  /** 재발견 푸시는 기본 OFF이며 이 요청으로 명시한 본인 계정의 수신 여부만 변경한다. */
  async setRediscoveryPushEnabled(userId: string, enabled: boolean) {
    if (typeof enabled !== 'boolean') throw new ServiceError('알림 수신 여부가 필요해요.', 'INVALID_REDISCOVERY_PUSH_PREFERENCE')
    const viewer = await userRepository.setRediscoveryPushEnabled(userId, enabled)
    if (!viewer) throw new ServiceError('사용자를 찾을 수 없어요.', 'USER_NOT_FOUND')
    return viewer
  },

  async updateStyleProfile(
    userId: string,
    input: UpdateMyStyleProfileInput,
  ) {
    validateBodyValue(input.heightCm, 100, 250, '키')
    validateBodyValue(input.weightKg, 30, 250, '몸무게')
    validateBodyValue(input.chestCircumferenceCm, 40, 200, '가슴둘레')
    validateBodyValue(input.waistCircumferenceCm, 40, 200, '허리둘레')
    validateBodyValue(input.hipCircumferenceCm, 40, 200, '엉덩이둘레')
    validateBodyValue(input.thighCircumferenceCm, 20, 150, '허벅지둘레')
    validateBodyValue(input.shoulderWidthCm, 20, 80, '어깨너비')
    validateBodyValue(input.inseamCm, 40, 130, '인심')

    const preferredStyles = [...new Set(input.preferredStyles)]
    const viewer = await userRepository.updateStyleProfile(userId, {
      ...input,
      preferredStyles,
    })

    if (!viewer) {
      throw new ServiceError('사용자를 찾을 수 없어요.', 'USER_NOT_FOUND')
    }

    return viewer
  },

  async updateWearReminderPreferences(
    userId: string,
    input: UpdateWearReminderPreferencesInput,
  ) {
    if (
      !Number.isInteger(input.intervalDays) ||
      input.intervalDays < 1 ||
      input.intervalDays > 30
    ) {
      throw new ServiceError(
        '최근 착용 알림 기간은 1일에서 30일 사이여야 해요.',
        'INVALID_WEAR_REMINDER_PREFERENCES',
      )
    }

    const viewer = await userRepository.updateWearReminderPreferences(
      userId,
      input,
    )
    if (!viewer) {
      throw new ServiceError('사용자를 찾을 수 없어요.', 'USER_NOT_FOUND')
    }

    return viewer
  },
}
