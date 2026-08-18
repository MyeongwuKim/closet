import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clearAccessToken, setAccessToken } from '../../../lib/auth'
import { graphqlRequest } from '../../../lib/graphql'
import { queryKeys } from '../../../lib/queryKeys'
import type { ViewerProfile } from '../../settings/api/profileQueries'

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
      queryClient.clear()
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
      queryClient.clear()
    },
  })
}
