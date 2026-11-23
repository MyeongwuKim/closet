interface Props {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
  className?: string
}

/** 옷장의 세부 종류만 가로 버튼으로 보여준다. 검색·색상 조건은 각 선택 화면의 필터에서 관리한다. */
export function OutfitSubcategoryChips({ label, options, value, onChange, className }: Props) {
  if (options.length === 0) return null
  return (
    <nav className={className} aria-label={`${label} 세부 카테고리`}>
      <div className="scrollbar-hidden mx-auto flex max-w-3xl gap-2 overflow-x-auto">
        {['all', ...options].map((option) => (
          <button
            type="button"
            onClick={() => onChange(option)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition ${
              value === option
                ? 'bg-ink text-white'
                : 'border border-line bg-surface text-muted hover:border-ink hover:text-ink'
            }`}
            aria-pressed={value === option}
            key={option}
          >
            {option === 'all' ? '전체' : option}
          </button>
        ))}
      </div>
    </nav>
  )
}
