import type { ReactNode } from 'react'

interface CollectionHeadingProps {
  title: string
  /** 제목 옆에 배치할 날씨 등 짧은 보조 정보. */
  titleAccessory?: ReactNode
  actions?: ReactNode
}

/** 네 주요 탭의 제목과 필요한 조작을 한 줄에 표시한다. titleAccessory로 전달받은 날씨 등 보조 정보는 제목 옆에 배치한다. */
export function CollectionHeading({ title, titleAccessory, actions }: CollectionHeadingProps) {
  return (
    <header className="collection-heading">
      <div className="collection-heading-title">
        <h1 className="collection-title shrink-0">{title}</h1>
        {titleAccessory && <div className="min-w-0">{titleAccessory}</div>}
      </div>
      {actions && <div className="collection-heading-actions">{actions}</div>}
    </header>
  )
}
