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
