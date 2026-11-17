import { useId, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { ToggleSwitch } from '../../../components/ToggleSwitch'

interface PermissionSettingRowProps {
  title: string
  description: string
  status: string
  actionLabel?: string
  disabled?: boolean
  onActivate?: () => void
}

/** 권한 상태와 변경 경로를 한 행에 표시한다. onActivate가 있을 때만 행 전체를 권한 요청·기기 설정 이동 버튼으로 만든다. */
export function PermissionSettingRow({
  title,
  description,
  status,
  actionLabel,
  disabled,
  onActivate,
}: PermissionSettingRowProps) {
  const rowId = useId()
  const content = (
    <>
      <span className="settings-detail-row-heading">
        <span className="settings-detail-row-title">{title}</span>
        <span id={`${rowId}-status`} className="settings-detail-permission-status">{status}</span>
      </span>
      <span id={`${rowId}-description`} className="settings-detail-description">{description}</span>
      {actionLabel && (
        <span className="settings-detail-row-action">
          {actionLabel}<ChevronRight size={15} aria-hidden="true" />
        </span>
      )}
    </>
  )

  return onActivate ? (
    <button
      type="button"
      className="settings-detail-row settings-detail-permission-row"
      aria-label={`${title} ${actionLabel}`}
      aria-describedby={`${rowId}-status ${rowId}-description`}
      onClick={onActivate}
      disabled={disabled}
    >
      {content}
    </button>
  ) : <div className="settings-detail-row">{content}</div>
}

interface ToggleSettingRowProps {
  title: string
  description: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
  loading?: boolean
  compact?: boolean
  children?: ReactNode
}

/** 화면에서 바로 변경할 수 있는 이용 설정만 스위치로 표시한다. 보충 설명과 재시도는 같은 행 아래에 배치한다. */
export function ToggleSettingRow({
  title,
  description,
  checked,
  disabled,
  onChange,
  loading,
  compact = false,
  children,
}: ToggleSettingRowProps) {
  return (
    <div className="settings-detail-row">
      <div className="settings-detail-row-heading">
        <div className="settings-detail-row-copy">
          <p className="settings-detail-row-title">{title}</p>
          {compact && <p className="settings-detail-description">{description}</p>}
        </div>
        {loading ? (
          <span role="status" className="settings-detail-loading">불러오는 중…</span>
        ) : (
          <ToggleSwitch
            checked={checked}
            disabled={disabled}
            ariaLabel={title}
            onChange={onChange}
          />
        )}
      </div>
      {!compact && <p className="settings-detail-description">{description}</p>}
      {children}
    </div>
  )
}
