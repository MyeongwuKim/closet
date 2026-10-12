import type { ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import type { WardrobeTransitionPhase } from '../hooks/useWardrobeTransition'

interface WardrobeCabinetProps {
  children: ReactNode
  label: string
  countLabel: string
  phase?: WardrobeTransitionPhase
  /** 종류 변경 시 목록 영역에만 적용할 이동 효과. */
  contentClassName?: string
  /** 목록 전환 중 실제 조회 결과를 기다리는지 여부. 이전 목록 조작을 막고 목록 영역에 로딩 표시를 띄운다. */
  isContentLoading?: boolean
}

/** 옷장·코디북의 제목·개수와 목록을 표시한다. 계절 전환에만 문을 닫았다 열며, 검색·필터 전환에서 새 목록을 기다리는 동안 이전 목록 조작을 막고 작은 로딩 아이콘을 표시한다. */
export function WardrobeCabinet({
  children,
  label,
  countLabel,
  phase = 'idle',
  contentClassName = '',
  isContentLoading = false,
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
        <div className={`wardrobe-cabinet-contents ${contentClassName}`} inert={closed || isContentLoading} aria-busy={transitioning || isContentLoading}>
          {children}
        </div>
        <span className="wardrobe-door wardrobe-door-left" aria-hidden="true" />
        <span className="wardrobe-door wardrobe-door-right" aria-hidden="true" />
        {(phase === 'waiting' || isContentLoading) && (
          <span className="wardrobe-door-loading" role="status" aria-label="목록 불러오는 중">
            <LoaderCircle size={18} strokeWidth={1.5} className="motion-safe:animate-spin" aria-hidden="true" />
          </span>
        )}
      </div>
    </section>
  )
}
