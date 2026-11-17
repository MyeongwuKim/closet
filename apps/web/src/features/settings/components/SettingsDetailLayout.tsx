import type { ReactNode } from 'react'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageTitle } from '../../../components/PageTitle'
import { useSettingsDetailFocus } from '../hooks/useSettingsDetailFocus'
import './SettingsDetailLayout.css'

interface Props {
  title: string
  description: string
  entryTo: string
  backTo?: string
  backLabel?: string
  refreshing?: boolean
  onRefresh?: () => void
  children: ReactNode
}

/** 설정 상세의 제목·복귀 경로·화면 내 초점 순환을 공통으로 제공한다. 권한 화면은 onRefresh를 전달해 권한 새로고침을 추가한다. */
export function SettingsDetailLayout({
  title, description, entryTo, backTo = '/settings', backLabel,
  refreshing, onRefresh, children,
}: Props) {
  const { dialogRef, handleKeyDown } = useSettingsDetailFocus(backTo, entryTo)
  return (
    <section ref={dialogRef} className="settings-detail-page classification-page-enter"
      role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onKeyDown={handleKeyDown}>
      <header className="settings-detail-header">
        <div className="settings-detail-header-inner">
          <Link to={backTo} className="settings-detail-icon-button settings-detail-back" aria-label={backLabel ?? `${title} 닫기`}>
            <ChevronLeft size={23} strokeWidth={1.8} aria-hidden="true" />
          </Link>
          <PageTitle title={title} description={description} compact />
          {onRefresh && <button type="button" onClick={onRefresh} disabled={refreshing} className="settings-detail-icon-button"
            aria-label="권한 상태 다시 확인" title="권한 상태 다시 확인">
            <RefreshCw className={refreshing ? 'animate-spin' : ''} size={18} strokeWidth={1.7} aria-hidden="true" />
          </button>}
        </div>
      </header>
      <div className="settings-detail-scroll"><div className="settings-detail-content">{children}</div></div>
    </section>
  )
}
