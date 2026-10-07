import type { ReactNode } from 'react'

interface CollectionHeadingProps {
  title: string
  label: string
  description?: string
  /** 제목 옆에 배치할 날씨 등 짧은 보조 정보. */
  titleAccessory?: ReactNode
  actions?: ReactNode
}

/** 주요 컬렉션 화면의 이름과 짧은 설명을 표시한다. 검색·추가 등 화면별 조작은 actions로 전달받는다. */
export function CollectionHeading({ title, label, description, titleAccessory, actions }: CollectionHeadingProps) {
  return (
    <header className="collection-heading">
      <div className="min-w-0">
        <p className="collection-kicker"><span aria-hidden="true" />{label}</p>
        <div className="flex items-center gap-2.5">
          <h1 className="collection-title shrink-0">{title}</h1>
          {titleAccessory && <div className="mt-2 min-w-0">{titleAccessory}</div>}
        </div>
        {description && <p className="mt-2 text-xs leading-5 text-muted sm:text-sm">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2 pt-5">{actions}</div>}
    </header>
  )
}
