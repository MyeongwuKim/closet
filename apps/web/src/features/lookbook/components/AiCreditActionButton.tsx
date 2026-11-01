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

/** 생성·추천 버튼의 문구를 잔액에 맞춰 표시하고, 광고 지급 후에는 정상 문구로 되돌리고, 다음 클릭에서 부모의 실행 동작을 호출한다. children은 버튼 아이콘이다. */
export function AiCreditActionButton({ kind = 'preview', requiresCredit = true, label, adLabel, onClick, disabled, children, ...props }: AiCreditActionButtonProps) {
  const action = useAiCreditAction(kind, requiresCredit)
  return (
    <button {...props} type="button" disabled={disabled || action.isChecking || action.isPending} onClick={() => void action.execute(onClick)}>
      {children && <span className="shrink-0">{children}</span>}
      <span className="min-w-0 text-center leading-5">{action.isPending ? '횟수·보상 확인 중…' : action.isChecking ? '횟수 확인 중…' : action.requiresAd ? (action.usesWallet ? '광고 보고 사용권 얻기' : adLabel) : label}</span>
    </button>
  )
}
