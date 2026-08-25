import { ArrowDownUp } from 'lucide-react'

export type DateSortOrder = 'latest' | 'oldest'

interface DateSortButtonProps {
  value: DateSortOrder
  onChange: (value: DateSortOrder) => void
}

export function DateSortButton({ value, onChange }: DateSortButtonProps) {
  const label = value === 'latest' ? '최신순' : '오래된순'
  const nextValue = value === 'latest' ? 'oldest' : 'latest'

  return (
    <button
      type="button"
      onClick={() => onChange(nextValue)}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-bold text-muted transition hover:border-ink hover:text-ink"
      aria-label={`${label} 정렬 중, ${nextValue === 'latest' ? '최신순' : '오래된순'}으로 변경`}
      title={`${label} 정렬`}
    >
      <ArrowDownUp size={15} aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}
