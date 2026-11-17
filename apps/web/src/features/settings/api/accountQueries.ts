import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { graphqlRequest } from '../../../lib/graphql'
import { queryKeys } from '../../../lib/queryKeys'
import { clearAccessToken, getAccessToken } from '../../../lib/auth'
import { syncNativeAuthSession } from '../../../native-bridge'
import { useClosetStore } from '../../closet/stores/useClosetStore'
import { useLookbookStore } from '../../lookbook/stores/useLookbookStore'
import { usePlanStore } from '../../plan/stores/usePlanStore'
import { createEmptyWeeklyPlan, getCurrentWeekStart } from '../../plan/data/weeklyPlan'
import { useStyleProfileStore } from '../stores/useStyleProfileStore'
import { ViewerSessionChangedError, type ViewerProfile } from './profileQueries'

export interface AccountInfo {
  displayName: string | null
  email: string | null
  loginId: string | null
}

/** 로그인한 본인의 계정 식별 정보만 조회한다. 다른 사용자 ID를 입력받지 않고 로그아웃 시 공통 캐시 정리를 따른다. */
export function useAccountInfoQuery() {
  return useQuery({
    queryKey: queryKeys.accountInfo,
    queryFn: async ({ signal }) => {
      const data = await graphqlRequest<{ myAccount: AccountInfo }>(
        'query MyAccount { myAccount { displayName email loginId } }', undefined, signal,
      )
      return data.myAccount
    },
  })
}

/** 서버 탈퇴 성공 후에만 현재 세션·기기 인증·계정 캐시와 편집 상태를 비운다. 실패·다른 세션의 응답은 현재 계정을 로그아웃시키지 않는다. */
export function useDeleteAccountMutation() {
  const client = useQueryClient()
  return useMutation({
    onMutate: () => ({ token: getAccessToken(), ownerId: client.getQueryData<ViewerProfile>(queryKeys.me)?.id }),
    mutationFn: async () => {
      const data = await graphqlRequest<{ deleteMyAccount: boolean }, { confirmation: string }>(
        'mutation DeleteMyAccount($confirmation: String!) { deleteMyAccount(confirmation: $confirmation) }', { confirmation: '회원탈퇴' },
      )
      if (!data.deleteMyAccount) throw new Error('회원탈퇴를 완료하지 못했어요. 다시 시도해주세요.')
    },
    onSuccess: async (_data, _variables, session) => {
      if (getAccessToken() !== session.token) throw new ViewerSessionChangedError()
      await client.cancelQueries()
      if (getAccessToken() !== session.token) throw new ViewerSessionChangedError()
      clearAccessToken()
      void syncNativeAuthSession(null)
      client.clear()
      useClosetStore.getState().disposeUploadedImages()
      useClosetStore.getState().hydrateItems([])
      useLookbookStore.getState().hydrateOutfits([])
      usePlanStore.setState({ entries: createEmptyWeeklyPlan(getCurrentWeekStart()) })
      useStyleProfileStore.setState({ profile: useStyleProfileStore.getInitialState().profile })
      try { if (session.ownerId) localStorage.removeItem(`closet:planner-wear-review:v1:${session.ownerId}`) } catch { /* 저장소가 제한되어도 서버 탈퇴·인증 정리는 완료한다. */ }
    },
  })
}
