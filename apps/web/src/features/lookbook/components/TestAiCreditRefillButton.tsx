import { LoaderCircle, Plus } from 'lucide-react'
import { usePreviewCreditsQuery, useRefillTestAiCreditsMutation } from '../api/previewCreditQueries'
import { useUiStore } from '../../../stores/useUiStore'

/** 개발 서버가 허용할 때 상단에 표시한다. 로그인 계정의 공통 사용권을 5개로 채우고 결과만 안내한다. */
export function TestAiCreditRefillButton() {
  const credits = usePreviewCreditsQuery()
  const refill = useRefillTestAiCreditsMutation()
  const pushToast = useUiStore((state) => state.pushToast)
  if (!credits.data?.testRefillAvailable) return null

  const refillCredits = async () => {
    try {
      const result = await refill.mutateAsync()
      pushToast(`AI 사용권을 ${result.credits.totalRemaining}개로 충전했어요.`, 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '테스트 충전에 실패했어요.', 'error')
    }
  }

  return (
    <button
      type="button"
      onClick={() => void refillCredits()}
      disabled={refill.isPending}
      aria-label="테스트용 AI 사용권 5개 충전"
      aria-busy={refill.isPending}
      title="테스트용 AI 사용권 5개 충전"
      className="flex h-10 shrink-0 items-center justify-center gap-1 rounded-full border border-dashed border-accent/50 bg-surface px-2.5 text-[10px] font-bold text-accent hover:bg-sage disabled:opacity-50"
    >
      {refill.isPending ? <LoaderCircle className="animate-spin" size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
      <span className="hidden whitespace-nowrap min-[380px]:inline">{refill.isPending ? '충전 중…' : '테스트 충전'}</span>
    </button>
  )
}
