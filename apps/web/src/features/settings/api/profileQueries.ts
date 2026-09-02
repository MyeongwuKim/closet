/**
 * 용도:
 * 로그인 사용자의 스타일 프로필과 최근 착용 리마인드 설정을 조회하고 저장한다.
 *
 * 동작 방식:
 * Viewer 데이터를 React Query에 보관하고 설정 저장 성공 시 같은 캐시를 갱신한다.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { OutfitStyle } from '../../../constants/styleOptions'
import { graphqlRequest } from '../../../lib/graphql'
import { queryKeys } from '../../../lib/queryKeys'
import type {
  BodyBuild,
  Gender,
  PreferredFit,
} from '../stores/useStyleProfileStore'

export interface WearReminderPreferences {
  enabled: boolean
  intervalDays: number
  combinationReminderEnabled: boolean
  itemReminderEnabled: boolean
}

export interface ViewerProfile {
  id: string
  displayName: string | null
  email: string | null
  isTemporary: boolean
  styleProfile: {
    gender: Gender | null
    bodyBuild: BodyBuild | null
    heightCm: number | null
    weightKg: number | null
    chestCircumferenceCm: number | null
    waistCircumferenceCm: number | null
    hipCircumferenceCm: number | null
    shoulderWidthCm: number | null
    inseamCm: number | null
    preferredFit: PreferredFit
    preferredStyles: OutfitStyle[]
  }
  wearReminderPreferences: WearReminderPreferences
}

export interface UpdateStyleProfileVariables {
  gender: Gender
  bodyBuild: BodyBuild
  heightCm: number | null
  weightKg: number | null
  chestCircumferenceCm: number | null
  waistCircumferenceCm: number | null
  hipCircumferenceCm: number | null
  shoulderWidthCm: number | null
  inseamCm: number | null
  preferredFit: PreferredFit
  preferredStyles: OutfitStyle[]
}

export type UpdateWearReminderPreferencesVariables = WearReminderPreferences

const viewerFields = `
  id
  displayName
  email
  isTemporary
  styleProfile {
    gender
    bodyBuild
    heightCm
    weightKg
    chestCircumferenceCm
    waistCircumferenceCm
    hipCircumferenceCm
    shoulderWidthCm
    inseamCm
    preferredFit
    preferredStyles
  }
  wearReminderPreferences {
    enabled
    intervalDays
    combinationReminderEnabled
    itemReminderEnabled
  }
`

export function useMeQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.me,
    enabled,
    queryFn: async ({ signal }) => {
      const data = await graphqlRequest<{ me: ViewerProfile }>(
        `query Me { me { ${viewerFields} } }`,
        undefined,
        signal,
      )
      return data.me
    },
  })
}

export function useUpdateStyleProfileMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateStyleProfileVariables) => {
      const data = await graphqlRequest<
        { updateMyStyleProfile: ViewerProfile },
        { input: UpdateStyleProfileVariables }
      >(
        `
          mutation UpdateMyStyleProfile($input: UpdateMyStyleProfileInput!) {
            updateMyStyleProfile(input: $input) { ${viewerFields} }
          }
        `,
        { input },
      )
      return data.updateMyStyleProfile
    },
    onSuccess: (viewer) => {
      queryClient.setQueryData(queryKeys.me, viewer)
    },
  })
}

export function useUpdateWearReminderPreferencesMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateWearReminderPreferencesVariables) => {
      const data = await graphqlRequest<
        { updateWearReminderPreferences: ViewerProfile },
        { input: UpdateWearReminderPreferencesVariables }
      >(
        `
          mutation UpdateWearReminderPreferences(
            $input: UpdateWearReminderPreferencesInput!
          ) {
            updateWearReminderPreferences(input: $input) { ${viewerFields} }
          }
        `,
        { input },
      )
      return data.updateWearReminderPreferences
    },
    onSuccess: (viewer) => {
      queryClient.setQueryData(queryKeys.me, viewer)
    },
  })
}
