import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { OutfitStyle } from '../../../constants/styleOptions'
import { graphqlRequest } from '../../../lib/graphql'
import { queryKeys } from '../../../lib/queryKeys'
import type {
  BodyBuild,
  Gender,
  PreferredFit,
} from '../stores/useStyleProfileStore'

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
