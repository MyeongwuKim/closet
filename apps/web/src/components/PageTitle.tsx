interface PageTitleProps {
  title: string
  description: string
  compact?: boolean
}

export function PageTitle({
  title,
  description,
  compact = false,
}: PageTitleProps) {
  return (
    <div className={compact ? 'min-w-0' : undefined}>
      <h1
        className={
          compact
            ? 'truncate text-lg font-black tracking-[-0.03em] sm:text-xl'
            : 'text-2xl font-black tracking-[-0.04em] sm:text-3xl'
        }
      >
        {title}
      </h1>
      <p
        className={
          compact
            ? 'mt-0.5 truncate text-xs text-muted'
            : 'mt-2 text-sm leading-6 text-muted'
        }
      >
        {description}
      </p>
    </div>
  )
}
