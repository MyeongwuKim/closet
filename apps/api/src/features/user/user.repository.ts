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
}
