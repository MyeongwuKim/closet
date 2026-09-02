import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clearAccessToken, setAccessToken } from '../../../lib/auth'
import { graphqlRequest } from '../../../lib/graphql'
import { queryKeys } from '../../../lib/queryKeys'
import { syncNativeAuthSession } from '../../../native-bridge'
import type { ViewerProfile } from '../../settings/api/profileQueries'
import { useClosetStore } from '../../closet/stores/useClosetStore'
import { useLookbookStore } from '../../lookbook/stores/useLookbookStore'

export interface TestLoginVariables {
  loginId: string
  password: string
  displayName?: string
}

export function useTestLoginMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: TestLoginVariables) => {
      const data = await graphqlRequest<
        {
          testLogin: {
            accessToken: string
            viewer: ViewerProfile
          }
        },
        { input: TestLoginVariables }
      >(
        `
          mutation TestLogin($input: TestLoginInput!) {
            testLogin(input: $input) {
              accessToken
              viewer {
                id displayName email isTemporary
                styleProfile {
                  gender bodyBuild heightCm weightKg
                  chestCircumferenceCm waistCircumferenceCm hipCircumferenceCm
                  shoulderWidthCm inseamCm preferredFit preferredStyles
                }
                wearReminderPreferences {
                  enabled intervalDays combinationReminderEnabled itemReminderEnabled
                }
              }
            }
          }
        `,
        { input },
      )
      return data.testLogin
    },
    onSuccess: ({ accessToken, viewer }) => {
      setAccessToken(accessToken)
      void syncNativeAuthSession(accessToken)
      queryClient.clear()
      useClosetStore.getState().hydrateItems([])
      useLookbookStore.getState().hydrateOutfits([])
      queryClient.setQueryData(queryKeys.me, viewer)
    },
  })
}

export function useLogoutMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      graphqlRequest<{ logout: boolean }>(
        'mutation Logout { logout }',
      ),
    onSettled: () => {
      clearAccessToken()
      void syncNativeAuthSession(null)
      queryClient.clear()
      useClosetStore.getState().hydrateItems([])
      useLookbookStore.getState().hydrateOutfits([])
    },
  })
}
