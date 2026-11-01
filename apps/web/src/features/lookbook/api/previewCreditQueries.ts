import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AiCreditKind, PreviewCredits, PreviewRewardSession } from '@closet/types'
import { queryKeys } from '../../../lib/queryKeys'
import { graphqlRequest } from '../../../lib/graphql'
import { getNativeAppInfo, isNativeWebViewRuntime } from '../../../native-bridge'
import { useMeQuery } from '../../settings/api/profileQueries'

export const previewCreditKeys = { all: ['preview-credits'] as const, balance: (userId: string, kind: AiCreditKind = 'preview') => ['preview-credits', userId, kind] as const }
const creditFields = 'freeRemaining rewardRemaining totalRemaining adRewardsRemaining rewardMode resetsAt pendingRewardSessionId capacity nextRefillAt serverNow'
const sessionFields = 'id mode adUnitId status watchedAt validUntil'

/** kind에 해당하는 오늘의 무료·광고 잔액을 읽는다. 기본값 preview는 이미지 생성권이고 recommendation은 추천권이다. 조회로 횟수를 차감하지 않는다. */
export async function getPreviewCredits(kind: AiCreditKind = 'preview') {
  return (await graphqlRequest<{ previewCredits: PreviewCredits }>(`query PreviewCredits($kind: AiCreditKind!) { previewCredits(kind: $kind) { ${creditFields} } }`, { kind })).previewCredits
}

/** 서버의 한국 시간 초기화 시각에 맞춰 잔액을 다시 읽고, 앱이 전면으로 돌아올 때 광고 지급 결과도 갱신한다. */
export function usePreviewCreditsQuery(enabled = true, kind: AiCreditKind = 'preview') {
  const me = useMeQuery()
  return useQuery({ queryKey: previewCreditKeys.balance(me.data?.id ?? '', kind), enabled: enabled && Boolean(me.data?.id), retry: 1,
    queryFn: () => getPreviewCredits(kind), staleTime: 5000, refetchOnWindowFocus: true,
    refetchInterval: (query) => query.state.data ? Math.max(1000, Math.min(60_000, query.state.data.nextRefillAt && query.state.data.serverNow ? Date.parse(query.state.data.nextRefillAt) - Date.parse(query.state.data.serverNow) - (Date.now() - query.state.dataUpdatedAt) + 100 : Date.parse(query.state.data.resetsAt) - Date.now() + 100)) : false,
  })
}

/** 네이티브 앱이 광고 브리지를 지원하는지 확인한다. 일반 브라우저나 이전 앱 빌드에는 광고 버튼을 활성화하지 않는다. */
export function useNativeRewardSupport(enabled: boolean) {
  return useQuery({ queryKey: ['native-reward-support'], enabled, staleTime: Infinity, retry: false,
    queryFn: async () => isNativeWebViewRuntime() && Boolean(window.ClosetNative?.showRewardedAd) && Boolean((await getNativeAppInfo())?.capabilities.includes('rewarded-ad')),
  })
}

/** 광고 완료 보고만으로 성공 처리하지 않고 서버 지급 확정을 기다린다. 지연 시 같은 번호를 다시 확인할 수 있도록 남긴다. */
export async function waitForPreviewReward(id: string, { timeoutMs = 15_000, wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)), now = Date.now } = {}) {
  const deadline = now() + timeoutMs
  do {
    const session = (await graphqlRequest<{ previewRewardSession: PreviewRewardSession }>(`query PreviewRewardSession($id: ID!) { previewRewardSession(id: $id) { ${sessionFields} } }`, { id })).previewRewardSession
    if (session.status === 'granted') return
    await wait(1000)
  } while (now() < deadline)
  throw new Error('광고 시청은 완료됐어요. 보상을 확인 중이니 잠시 후 보상 확인을 눌러주세요.')
}

/** 서버 광고 번호 발급 → 네이티브 광고 표시 → 서버 지급 확인 순서로 처리한다. 취소·광고 실패에는 대기 중인 생성·추천 요청을 재개하지 않는다. 지급 대상은 서버가 해당 종류로 발급한 광고 번호에 저장한다. */
export function useEarnPreviewCreditMutation(kind: AiCreditKind = 'preview') {
  const client = useQueryClient()
  return useMutation({ mutationFn: async () => {
    if (!window.ClosetNative?.showRewardedAd || !isNativeWebViewRuntime()) throw new Error('광고 보상은 iOS 앱에서 이용할 수 있어요.')
    const ownerId = client.getQueryData<{ id: string }>(queryKeys.me)?.id
    if (!ownerId) throw new Error('로그인한 뒤 광고를 시청해 주세요.')
    const assertOwner = () => { if (client.getQueryData<{ id: string }>(queryKeys.me)?.id !== ownerId) throw new Error('계정이 바뀌었어요. 현재 계정에서 다시 시도해 주세요.') }
    const balance = await getPreviewCredits(kind)
    assertOwner()
    if (balance.totalRemaining > 0) return { ownerId, balance }
    let sessionId = balance.pendingRewardSessionId
    if (!sessionId) {
      const session = (await graphqlRequest<{ startPreviewReward: PreviewRewardSession }>(`mutation StartPreviewReward($kind: AiCreditKind!) { startPreviewReward(kind: $kind) { ${sessionFields} } }`, { kind })).startPreviewReward
      sessionId = session.id
      assertOwner()
      const result = await window.ClosetNative.showRewardedAd(session.id)
      assertOwner()
      if (result.status === 'cancelled') throw new Error('광고 시청을 취소했어요. 이용권은 차감되지 않았습니다.')
      if (result.status !== 'earned') throw new Error(result.message ?? '지금은 광고를 불러올 수 없어요. 잠시 후 다시 시도해 주세요.')
    }
    await waitForPreviewReward(sessionId)
    const updated = await getPreviewCredits(kind)
    assertOwner()
    return { ownerId, balance: updated }
  }, onSuccess: ({ ownerId, balance }) => {
    client.setQueryData(previewCreditKeys.balance(ownerId, kind), balance)
  }, onSettled: () => { void client.invalidateQueries({ queryKey: previewCreditKeys.all }) } })
}
