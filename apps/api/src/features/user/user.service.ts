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
  shoulderWidthCm?: number | null
  inseamCm?: number | null
  preferredFit: PreferredFit
  preferredStyles: OutfitStyle[]
}

function validateBodyValue(
  value: number | null | undefined,
  min: number,
  max: number,
  label: string,
) {
  if (value === null || value === undefined) return
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new ServiceError(
      `${label} 값은 ${min}에서 ${max} 사이여야 합니다.`,
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
      shoulderWidthCm: viewer.styleProfile?.shoulderWidthCm ?? null,
      inseamCm: viewer.styleProfile?.inseamCm ?? null,
      preferredFit: viewer.styleProfile?.preferredFit ?? 'regular',
      preferredStyles: viewer.preferredStyles.map(({ style }) => style),
    },
  }
}

export const userService = {
  async updateStyleProfile(
    userId: string,
    input: UpdateMyStyleProfileInput,
  ) {
    validateBodyValue(input.heightCm, 100, 250, '키')
    validateBodyValue(input.weightKg, 30, 250, '몸무게')
    validateBodyValue(input.chestCircumferenceCm, 40, 200, '가슴둘레')
    validateBodyValue(input.waistCircumferenceCm, 40, 200, '허리둘레')
    validateBodyValue(input.hipCircumferenceCm, 40, 200, '엉덩이둘레')
    validateBodyValue(input.shoulderWidthCm, 20, 80, '어깨너비')
    validateBodyValue(input.inseamCm, 40, 130, '인심')

    const preferredStyles = [...new Set(input.preferredStyles)]
    const viewer = await userRepository.updateStyleProfile(userId, {
      ...input,
      preferredStyles,
    })

    if (!viewer) {
      throw new ServiceError('사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND')
    }

    return viewer
  },
}
