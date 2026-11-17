/**
 * 용도:
 * 로그인 사용자의 스타일 프로필과 최근 착용 리마인드 설정을 조회하고 저장한다.
 *
 * 동작 방식:
 * Viewer 데이터를 React Query에 보관하고, 저장을 시작한 계정·인증 토큰이 그대로일 때만 결과를 반영한다.
 */
import { useIsMutating, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { OutfitStyle } from '../../../constants/styleOptions'
import { graphqlRequest } from '../../../lib/graphql'
import { queryKeys } from '../../../lib/queryKeys'
import { getAccessToken } from '../../../lib/auth'
import {
  useStyleProfileStore,
  type BodyBuild,
  type Gender,
  type PreferredFit,
} from '../stores/useStyleProfileStore'

export interface WearReminderPreferences {
  enabled: boolean
  intervalDays: number
  combinationReminderEnabled: boolean
  itemReminderEnabled: boolean
}

export const defaultWearReminderPreferences: WearReminderPreferences = {
  enabled: false,
  intervalDays: 7,
  combinationReminderEnabled: true,
  itemReminderEnabled: true,
}

export interface ViewerProfile {
  id: string
  displayName: string | null
  email: string | null
  isTemporary: boolean
  rediscoveryPushEnabled: boolean
  completionPushEnabled: boolean
  styleProfile: {
    gender: Gender | null
    bodyBuild: BodyBuild | null
    heightCm: number | null
    weightKg: number | null
    chestCircumferenceCm: number | null
    waistCircumferenceCm: number | null
    hipCircumferenceCm: number | null
    thighCircumferenceCm: number | null
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
  thighCircumferenceCm: number | null
  shoulderWidthCm: number | null
  inseamCm: number | null
  preferredFit: PreferredFit
  preferredStyles: OutfitStyle[]
}

export type UpdateWearReminderPreferencesVariables = WearReminderPreferences

const wearReminderMutationKey = ['updateWearReminderPreferences'] as const

/** 화면을 닫은 뒤 계정이 바뀐 저장 응답이다. 호출 화면은 로컬 프로필 갱신과 성공·실패 토스트를 생략한다. */
export class ViewerSessionChangedError extends Error {
  constructor() {
    super('로그인 계정이 변경되어 저장 결과를 적용하지 않았어요.')
    this.name = 'ViewerSessionChangedError'
  }
}

function captureViewerSession(client: QueryClient) {
  const ownerId = client.getQueryData<ViewerProfile>(queryKeys.me)?.id
  const accessToken = getAccessToken()
  if (!ownerId || !accessToken) throw new Error('로그인 상태를 확인해주세요.')
  return { ownerId, accessToken }
}

/** 같은 계정 재로그인도 토큰으로 구분하여 이전 요청이 새 세션의 캐시나 로컬 폼을 갱신하지 않게 한다. */
function assertCurrentViewerSession(client: QueryClient, session: ReturnType<typeof captureViewerSession>, viewer?: ViewerProfile) {
  if (getAccessToken() !== session.accessToken
    || client.getQueryData<ViewerProfile>(queryKeys.me)?.id !== session.ownerId
    || (viewer && viewer.id !== session.ownerId)) {
    throw new ViewerSessionChangedError()
  }
}

const viewerFields = `
  id
  displayName
  email
  isTemporary
  rediscoveryPushEnabled
  completionPushEnabled
  styleProfile {
    gender
    bodyBuild
    heightCm
    weightKg
    chestCircumferenceCm
    waistCircumferenceCm
    hipCircumferenceCm
    thighCircumferenceCm
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

/** 설정 저장의 시작·전송·캐시 반영·호출부 반환마다 같은 인증 세션인지 검사한다. */
function useViewerUpdateMutation<TVariables>(
  request: (input: TVariables) => Promise<ViewerProfile>,
  { updateLocalProfile = false, mutationKey }: { updateLocalProfile?: boolean; mutationKey?: readonly string[] } = {},
) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationKey,
    mutationFn: async ({ input, session }: { input: TVariables; session: ReturnType<typeof captureViewerSession> }) => {
      assertCurrentViewerSession(queryClient, session)
      const viewer = await request(input)
      return { viewer, session }
    },
    onSuccess: async ({ viewer, session }) => {
      assertCurrentViewerSession(queryClient, session, viewer)
      // 저장 전에 시작한 조회가 늦게 도착해 최신 설정을 덮지 않게 한다.
      await queryClient.cancelQueries({ queryKey: queryKeys.me, exact: true })
      assertCurrentViewerSession(queryClient, session, viewer)
      queryClient.setQueryData(queryKeys.me, viewer)
      if (updateLocalProfile) {
        const profile = viewer.styleProfile
        useStyleProfileStore.getState().updateProfile({
          ...profile,
          heightCm: profile.heightCm?.toString() ?? '',
          weightKg: profile.weightKg?.toString() ?? '',
          chestCircumferenceCm: profile.chestCircumferenceCm?.toString() ?? '',
          waistCircumferenceCm: profile.waistCircumferenceCm?.toString() ?? '',
          hipCircumferenceCm: profile.hipCircumferenceCm?.toString() ?? '',
          thighCircumferenceCm: profile.thighCircumferenceCm?.toString() ?? '',
          shoulderWidthCm: profile.shoulderWidthCm?.toString() ?? '',
          inseamCm: profile.inseamCm?.toString() ?? '',
        })
      }
    },
  })
  return {
    isPending: mutation.isPending,
    /** 현재 폼에만 완료 결과를 돌려준다. 다른 세션의 응답은 호출부의 토스트에도 사용하지 않는다. */
    mutateAsync: async (input: TVariables) => {
      const result = await mutation.mutateAsync({ input, session: captureViewerSession(queryClient) })
      assertCurrentViewerSession(queryClient, result.session, result.viewer)
      return result.viewer
    },
  }
}

/** 프로필 저장 결과를 현재 세션의 서버 캐시와 로컬 문자열 폼 값에 함께 반영한다. */
export function useUpdateStyleProfileMutation() {
  return useViewerUpdateMutation(async (input: UpdateStyleProfileVariables) => {
    const data = await graphqlRequest<
      { updateMyStyleProfile: ViewerProfile },
      { input: UpdateStyleProfileVariables }
    >(`
      mutation UpdateMyStyleProfile($input: UpdateMyStyleProfileInput!) {
        updateMyStyleProfile(input: $input) { ${viewerFields} }
      }
    `, { input })
    return data.updateMyStyleProfile
  }, { updateLocalProfile: true })
}

/** 최근 착용 리마인드 설정을 저장하고 현재 세션의 Viewer 캐시만 갱신한다. */
export function useUpdateWearReminderPreferencesMutation() {
  const pendingSaves = useIsMutating({ mutationKey: wearReminderMutationKey, exact: true })
  const mutation = useViewerUpdateMutation(async (input: UpdateWearReminderPreferencesVariables) => {
    const data = await graphqlRequest<
      { updateWearReminderPreferences: ViewerProfile },
      { input: UpdateWearReminderPreferencesVariables }
    >(`
      mutation UpdateWearReminderPreferences($input: UpdateWearReminderPreferencesInput!) {
        updateWearReminderPreferences(input: $input) { ${viewerFields} }
      }
    `, { input })
    return data.updateWearReminderPreferences
  }, { mutationKey: wearReminderMutationKey })

  // 저장 중 화면을 닫았다가 돌아와도 다음 저장을 시작하기 전에 이전 응답을 기다린다.
  return { mutateAsync: mutation.mutateAsync, isPending: pendingSaves > 0 }
}

/** 잠든 옷 푸시의 별도 수신 동의를 저장한다. 다른 계정·재로그인 세션의 응답은 기존 Viewer 보호 경로에서 차단한다. */
export function useSetRediscoveryPushEnabledMutation() {
  const mutationKey = ['setWardrobeRediscoveryPushEnabled'] as const
  const pending = useIsMutating({ mutationKey, exact: true })
  const mutation = useViewerUpdateMutation(async (enabled: boolean) => {
    const data = await graphqlRequest<{ setWardrobeRediscoveryPushEnabled: ViewerProfile }>(`
      mutation SetWardrobeRediscoveryPushEnabled($enabled: Boolean!) {
        setWardrobeRediscoveryPushEnabled(enabled: $enabled) { ${viewerFields} }
      }
    `, { enabled })
    return data.setWardrobeRediscoveryPushEnabled
  }, { mutationKey })
  return { mutateAsync: mutation.mutateAsync, isPending: pending > 0 }
}

/** 완료·실패 푸시 수신 선택을 계정에 저장한다. 저장 중 재진입과 계정 변경은 기존 Viewer 세션 보호 경로를 따른다. */
export function useSetCompletionPushEnabledMutation() {
  const mutationKey = ['setCompletionPushEnabled'] as const
  const pending = useIsMutating({ mutationKey, exact: true })
  const mutation = useViewerUpdateMutation(async (enabled: boolean) => {
    const data = await graphqlRequest<{ setCompletionPushEnabled: ViewerProfile }>(`
      mutation SetCompletionPushEnabled($enabled: Boolean!) {
        setCompletionPushEnabled(enabled: $enabled) { ${viewerFields} }
      }
    `, { enabled })
    return data.setCompletionPushEnabled
  }, { mutationKey })
  return { mutateAsync: mutation.mutateAsync, isPending: pending > 0 }
}
