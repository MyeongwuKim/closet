/** 조회 중 사진과 코디 버튼의 자리를 보여주고, 카드가 준비되기 전에는 조작 요소를 노출하지 않는다. */
export function WardrobeRediscoverySkeleton() {
  return (
    <div className="rediscovery-carousel" data-single="true">
      <div className="rediscovery-card">
        <div className="rediscovery-card-visual">
          <span role="status" className="sr-only">잊고 있던 옷을 불러오는 중</span>
          <svg viewBox="0 0 64 64" className="rediscovery-loading-hanger size-16 text-accent" fill="none" aria-hidden="true">
            <path d="M27 21a5 5 0 1 1 8.1 3.9C33 26.6 32 27.4 32 30v1m0 0L8.5 46a3 3 0 0 0 1.6 5.5h43.8a3 3 0 0 0 1.6-5.5L32 31Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="rediscovery-card-content px-5 pt-4 pb-3 sm:px-6 sm:pt-5" aria-hidden="true">
          <div className="flex h-7 items-center"><div className="h-4 w-1/2 rounded-full bg-line" /></div>
          <div className="mt-1.5 flex h-5 items-center"><div className="h-3 w-2/5 rounded-full bg-line/70" /></div>
          <div className="rediscovery-recommend mt-5 min-h-12 rounded-xl bg-sage" />
          <div className="flex h-9 items-center justify-center"><div className="h-2.5 w-20 rounded-full bg-line/70" /></div>
        </div>
      </div>
    </div>
  )
}
