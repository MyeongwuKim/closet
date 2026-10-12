import { useLayoutEffect, useRef, type ReactNode } from 'react'

interface CatalogScrollRegionProps {
  children: ReactNode
  label: string
  /** 검색·정렬·필터 조건을 구분하는 값. 조건이 바뀔 때 목록만 맨 위로 돌리고, 추가 조회·상세 팝업에서는 위치를 유지한다. */
  resetKey: string
}

/** 옷장·코디북의 목록과 추가 조회 영역만 스크롤한다. 제목·필터는 이 영역 밖에 두어 화면 위에 유지한다. */
export function CatalogScrollRegion({ children, label, resetKey }: CatalogScrollRegionProps) {
  const scrollRegionRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    scrollRegionRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [resetKey])

  return (
    <div ref={scrollRegionRef} className="catalog-scroll-region" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  )
}
