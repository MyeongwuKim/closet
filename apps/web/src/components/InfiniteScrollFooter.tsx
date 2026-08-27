import { useEffect, useRef } from 'react'

interface InfiniteScrollFooterProps {
  hasNextPage: boolean
  isFetching: boolean
  isError: boolean
  onLoadMore: () => Promise<unknown>
}

export function InfiniteScrollFooter({ hasNextPage, isFetching, isError, onLoadMore }: InfiniteScrollFooterProps) {
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = sentinel.current
    if (!element || !hasNextPage || isFetching || isError || !window.IntersectionObserver) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        observer.disconnect()
        void onLoadMore().catch(() => undefined)
      }
    }, { rootMargin: '300px 0px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [hasNextPage, isFetching, isError, onLoadMore])

  return (
    <div ref={sentinel} className="flex min-h-20 items-center justify-center py-6" aria-live="polite">
      {isFetching ? <p role="status" className="text-sm text-muted">더 불러오는 중...</p> : hasNextPage ? (
        <button type="button" onClick={() => void onLoadMore().catch(() => undefined)}
          className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-bold">
          {isError ? '불러오지 못했어요 · 다시 시도' : '더 보기'}
        </button>
      ) : <p className="text-xs text-muted">모두 확인했어요</p>}
    </div>
  )
}
