import { Image } from 'lucide-react'
import type { LookbookViewMode } from '../types'

interface LookbookViewSwitchProps {
  /** AI 이미지를 우선 표시할지 옷 사진을 펼쳐 표시할지 결정하는 목록의 보기 옵션. */
  value: LookbookViewMode
  onChange: (value: LookbookViewMode) => void
}

/** 같은 코디 목록의 이미지 표현을 전환한다. 조회 조건과 저장된 코디는 변경하지 않고 다음 보기 옵션을 부모에 전달한다. */
export function LookbookViewSwitch({ value, onChange }: LookbookViewSwitchProps) {
  const showAiLookbook = value === 'ai'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={showAiLookbook}
      aria-label="AI 룩북으로 보기"
      onClick={() => onChange(showAiLookbook ? 'items' : 'ai')}
      className="lookbook-view-switch"
    >
      <Image size={16} strokeWidth={1.6} className="hidden sm:block" aria-hidden="true" />
      <span>AI 룩북<span className="hidden sm:inline">으로 보기</span></span>
      <span className="lookbook-view-switch-track" aria-hidden="true">
        <span className="lookbook-view-switch-thumb" />
      </span>
    </button>
  )
}
