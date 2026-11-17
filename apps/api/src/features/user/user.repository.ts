/**
 * 용도:
 * 로그인 사용자의 프로필과 계정 설정을 조회하고 저장한다.
 *
 * 요청 흐름:
 * 사용자 단위 설정을 각각 저장한 뒤 최신 Viewer 데이터를 다시 조회해 반환한다.
 */
import type {
  BodyBuild,
  Gender,
  OutfitStyle,
  PreferredFit,
  Prisma,
} from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { nextRediscoveryMorning } from '../push/rediscovery-push.rules.js'

export const viewerInclude = {
  styleProfile: true,
  settings: true,
  preferredStyles: true,
} satisfies Prisma.UserInclude

export type ViewerRecord = Prisma.UserGetPayload<{
  include: typeof viewerInclude
}>

export interface UpdateStyleProfileData {
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

export interface UpdateWearReminderPreferencesData {
  enabled: boolean
  intervalDays: number
  combinationReminderEnabled: boolean
  itemReminderEnabled: boolean
}

export const userRepository = {
  /** 계정 관리에 필요한 본인 이름·이메일·로그인 ID만 읽는다. 비밀번호 해시와 세션 정보는 선택하지 않는다. */
  findAccountInfoById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, email: true, testAccount: { select: { loginId: true } } },
    })
  },

  /** 완료·실패 푸시 수신 여부만 저장하고 다른 알림·리마인드 설정은 유지한다. */
  async setCompletionPushEnabled(userId: string, enabled: boolean) {
    await prisma.userSettings.upsert({
      where: { userId },
      update: { completionPushEnabled: enabled },
      create: { userId, completionPushEnabled: enabled },
    })
    return this.findViewerById(userId)
  },

  /** 재발견 푸시 동의를 별도로 저장한다. 같은 값의 재요청은 이미 정한 발송 간격을 초기화하지 않는다. */
  async setRediscoveryPushEnabled(userId: string, enabled: boolean) {
    const current = await prisma.userSettings.findUnique({ where: { userId } })
    if (current?.rediscoveryPushEnabled === enabled) return this.findViewerById(userId)
    const data = { rediscoveryPushEnabled: enabled, rediscoveryPushNextAt: enabled ? nextRediscoveryMorning(new Date()) : null }
    await prisma.userSettings.upsert({ where: { userId }, update: data, create: { userId, ...data } })
    return this.findViewerById(userId)
  },

  findViewerById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: viewerInclude,
    })
  },

  async updateStyleProfile(userId: string, input: UpdateStyleProfileData) {
    await prisma.styleProfile.upsert({
      where: { userId },
      update: {
        gender: input.gender,
        bodyBuild: input.bodyBuild,
        heightCm: input.heightCm,
        weightKg: input.weightKg,
        chestCircumferenceCm: input.chestCircumferenceCm,
        waistCircumferenceCm: input.waistCircumferenceCm,
        hipCircumferenceCm: input.hipCircumferenceCm,
        thighCircumferenceCm: input.thighCircumferenceCm,
        shoulderWidthCm: input.shoulderWidthCm,
        inseamCm: input.inseamCm,
        preferredFit: input.preferredFit,
      },
      create: {
        userId,
        gender: input.gender,
        bodyBuild: input.bodyBuild,
        heightCm: input.heightCm,
        weightKg: input.weightKg,
        chestCircumferenceCm: input.chestCircumferenceCm,
        waistCircumferenceCm: input.waistCircumferenceCm,
        hipCircumferenceCm: input.hipCircumferenceCm,
        thighCircumferenceCm: input.thighCircumferenceCm,
        shoulderWidthCm: input.shoulderWidthCm,
        inseamCm: input.inseamCm,
        preferredFit: input.preferredFit,
      },
    })

    await prisma.userStylePreference.deleteMany({ where: { userId } })

    if (input.preferredStyles.length > 0) {
      await prisma.userStylePreference.createMany({
        data: input.preferredStyles.map((style) => ({ userId, style })),
      })
    }

    return this.findViewerById(userId)
  },

  async updateWearReminderPreferences(
    userId: string,
    input: UpdateWearReminderPreferencesData,
  ) {
    await prisma.userSettings.upsert({
      where: { userId },
      update: input,
      create: { userId, ...input },
    })

    return this.findViewerById(userId)
  },
}
