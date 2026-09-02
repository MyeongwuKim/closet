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
      {isFetching ? (
        <span role="status" className="flex items-center gap-2" aria-label="더 불러오는 중">
          <span className="sr-only">더 불러오는 중...</span>
          <span className="h-2 w-10 animate-pulse rounded-full bg-line/70" />
          <span className="h-2 w-16 animate-pulse rounded-full bg-line/55 [animation-delay:120ms]" />
          <span className="h-2 w-10 animate-pulse rounded-full bg-line/40 [animation-delay:240ms]" />
        </span>
      ) : hasNextPage ? (
        <button type="button" onClick={() => void onLoadMore().catch(() => undefined)}
          className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-bold">
          {isError ? '불러오지 못했어요 · 다시 시도' : '더 보기'}
        </button>
      ) : null}
    </div>
  )
}
