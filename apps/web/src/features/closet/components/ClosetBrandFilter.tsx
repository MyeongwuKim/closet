import { useEffect, useRef } from 'react'
import { ChevronDown, Tags } from 'lucide-react'
import { useDrawerDisclosure } from '../../../hooks/useDrawerDisclosure'
import { ClosetBrandFilterSheet } from './ClosetBrandFilterSheet'

interface ClosetBrandFilterProps {
  /** 현재 목록에 적용한 브랜드명. null이면 전체 또는 unbrandedOnly 조건을 사용한다. */
  value: string | null
  /** true이면 브랜드 미지정 옷만 표시한다. */
  unbrandedOnly?: boolean
  /** 브랜드명과 미지정 여부를 부모 필터에 전달한다. */
  onChange: (value: string | null, unbrandedOnly?: boolean) => void
}

/** 옷장의 브랜드 선택·관리 창을 연다. 닫힘 애니메이션 뒤 필터 버튼으로 초점을 돌리고 긴 선택 이름은 한 줄로 줄여 표시한다. */
export function ClosetBrandFilter({ value, unbrandedOnly = false, onChange }: ClosetBrandFilterProps) {
  const { isOpen, isVisible, open, close } = useDrawerDisclosure()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const label = unbrandedOnly ? '브랜드 미지정' : value ?? '브랜드'
  const isActive = Boolean(value) || unbrandedOnly

  useEffect(() => {
    if (!isVisible) return
    const trigger = triggerRef.current
    return () => { trigger?.focus({ preventScroll: true }) }
  }, [isVisible])

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={open}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={isActive ? `브랜드 필터: ${label}` : '브랜드 필터'}
        title={label}
        className={`flex h-9 min-w-0 max-w-40 items-center gap-1.5 rounded-full border px-2 text-xs font-medium transition sm:max-w-56 sm:px-3 sm:text-sm ${isActive ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-muted hover:border-ink hover:text-ink'}`}
      >
        <Tags size={15} className="shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
        <ChevronDown size={14} className="shrink-0" aria-hidden="true" />
      </button>
      {isVisible && <ClosetBrandFilterSheet value={value} unbrandedOnly={unbrandedOnly} isOpen={isOpen} onChange={onChange} onClose={close} />}
    </>
  )
}
