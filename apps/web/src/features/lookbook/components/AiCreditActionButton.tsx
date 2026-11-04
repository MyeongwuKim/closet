import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { AiCreditKind } from '@closet/types'
import { useAiCreditAction } from '../hooks/useAiCreditAction'

type AiCreditActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  kind?: AiCreditKind
  /** 받은 추천 결과나 기존 이미지를 열 때는 false로 지정해 잔액과 관계없이 열 수 있게 한다. */
  requiresCredit?: boolean
  label: string
  adLabel: string
  onClick: () => void | Promise<void>
  children?: ReactNode
}

/** AI 버튼에 남은 사용권과 최대 보유량을 표시한다. 사용권이 필요한 동작은 광고 지급 후 다음 클릭에서 부모의 실행 동작을 호출한다. children은 버튼 아이콘이다. */
export function AiCreditActionButton({ kind = 'preview', requiresCredit = true, label, adLabel, onClick, disabled, children, ...props }: AiCreditActionButtonProps) {
  const action = useAiCreditAction(kind, requiresCredit)
  const creditBalance = action.remainingCredits === undefined ? null : action.capacity ? `${action.remainingCredits}/${action.capacity}` : `${action.remainingCredits}회`
  return (
    <button aria-description={creditBalance ? `남은 AI 사용권 ${creditBalance}` : undefined} {...props} type="button" disabled={disabled || action.isChecking || action.isPending} onClick={() => void action.execute(onClick)}>
      {children && <span className="shrink-0">{children}</span>}
      <span className="min-w-0 text-center leading-5 break-keep text-balance">{action.isPending ? '횟수·보상 확인 중…' : action.isChecking ? '횟수 확인 중…' : action.requiresAd ? (action.usesWallet ? '광고 보고 충전' : adLabel) : label}</span>
      {creditBalance && (
        <span aria-hidden="true" className="shrink-0 rounded-md bg-black/6 px-1.5 py-0.5 text-[10px] font-bold leading-4 tabular-nums whitespace-nowrap">
          {creditBalance}
        </span>
      )}
    </button>
  )
}
