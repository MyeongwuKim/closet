import type { AiCreditKind } from '@closet/types'
import { create } from 'zustand'

interface CreditDialogState {
  /** 이용권을 요청한 계정·요청 번호·종류. kind는 추천권과 이미지 생성권을 구분한다. null이면 대화상자를 닫은 상태다. */
  request: { id: string; ownerId: string; purpose: 'generation' | 'info'; kind: AiCreditKind } | null
  resolver: ((accepted: boolean) => void) | null
  ask: (ownerId: string, purpose?: 'generation' | 'info', kind?: AiCreditKind) => Promise<boolean>
  resolve: (requestId: string, accepted: boolean) => void
}

/** 추천권 또는 생성권이 없는 요청을 광고 선택 화면에서 기다리게 한다. 광고 지급 후에도 실제 작업은 원래 버튼을 다시 눌렀을 때 실행하며 이 상태는 영속 저장하지 않는다. */
export const usePreviewCreditDialogStore = create<CreditDialogState>((set, get) => ({
  request: null, resolver: null,
  /** purpose는 실행 전 충전 선택 또는 단순 안내를 구분하며 kind의 기본값 preview는 이미지 생성권이다. 새 확인 요청을 연다. 이전 대기 요청은 취소로 마치며, 다른 계정의 요청과 섞지 않는다. */
  ask: (ownerId, purpose = 'generation', kind = 'preview') => {
    get().resolver?.(false)
    return new Promise<boolean>((resolver) => set({ request: { id: crypto.randomUUID(), ownerId, purpose, kind }, resolver }))
  },
  /** 같은 요청 번호일 때만 닫고 결과를 전달한다. 늦게 도착한 이전 광고 결과는 새 생성을 재개하지 않는다. */
  resolve: (requestId, accepted) => {
    if (get().request?.id !== requestId) return
    const resolver = get().resolver
    set({ request: null, resolver: null })
    resolver?.(accepted)
  },
}))
