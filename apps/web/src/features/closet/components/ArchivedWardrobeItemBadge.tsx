interface ArchivedWardrobeItemBadgeProps {
  className?: string
  compact?: boolean
  label?: string
}

/** 저장된 코디의 옷이 현재 옷장에서 삭제됐음을 한 줄로 표시한다. 작은 사진에는 compact 배지를 사용한다. */
export function ArchivedWardrobeItemBadge({ className = '', compact = false, label = '삭제된 옷' }: ArchivedWardrobeItemBadgeProps) {
  return (
    <span className={`pointer-events-none inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md bg-ink/80 py-0.5 leading-tight font-medium text-white ${compact ? 'px-0.5 text-[8px]' : 'px-1.5 text-[9px]'} ${className}`}>
      {label}
    </span>
  )
}
