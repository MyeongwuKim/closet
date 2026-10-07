import type { ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import type { WardrobeTransitionPhase } from '../hooks/useWardrobeTransition'

interface WardrobeCabinetProps {
  children: ReactNode
  label: string
  countLabel: string
  phase?: WardrobeTransitionPhase
  /** 종류·스타일 변경 시 옷걸이 영역에만 적용할 이동 효과. */
  contentClassName?: string
}

/** 옷장·코디북 목록을 열린 수납 공간으로 표시한다. 계절 전환에만 문을 닫았다 열며, 새 목록을 기다리는 동안 문 위에 작은 로딩 아이콘을 표시한다. */
export function WardrobeCabinet({
  children,
  label,
  countLabel,
  phase = 'idle',
  contentClassName = '',
}: WardrobeCabinetProps) {
  const transitioning = phase !== 'idle'
  const closed = phase === 'closing' || phase === 'waiting'

  return (
    <section className="wardrobe-cabinet" aria-label={label}>
      <div className="wardrobe-cabinet-toolbar">
        <h2 className="min-w-0 truncate text-sm font-medium">{label}</h2>
        <p className="shrink-0 text-xs text-muted" aria-live="polite">{countLabel}</p>
      </div>
      <div className="wardrobe-cabinet-stage" data-door-state={closed ? 'closed' : 'open'} data-phase={phase}>
        <div className={`wardrobe-cabinet-contents ${contentClassName}`} inert={closed} aria-busy={transitioning}>
          {children}
        </div>
        <span className="wardrobe-door wardrobe-door-left" aria-hidden="true" />
        <span className="wardrobe-door wardrobe-door-right" aria-hidden="true" />
        {phase === 'waiting' && (
          <span className="wardrobe-door-loading" role="status" aria-label="목록 불러오는 중">
            <LoaderCircle size={18} strokeWidth={1.5} className="motion-safe:animate-spin" aria-hidden="true" />
          </span>
        )}
      </div>
    </section>
  )
}
