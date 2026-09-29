interface ToggleSwitchProps {
  checked: boolean
  disabled?: boolean
  ariaLabel: string
  onChange: (checked: boolean) => void
}

/**
 * 설정값의 켜짐·꺼짐 상태를 표시하고 사용자의 클릭을 반대 상태로 전달한다.
 * disabled일 때는 상태를 변경하지 않으며, ariaLabel로 토글 대상을 구분한다.
 */
export function ToggleSwitch({
  checked,
  disabled = false,
  ariaLabel,
  onChange,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-ink' : 'bg-line'
      }`}
    >
      <span
        className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
