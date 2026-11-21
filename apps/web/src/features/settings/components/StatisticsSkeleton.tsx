import './StatisticsSkeleton.css'

/** 초기 조회 동안 요약 카드, 탭, 분포 영역의 배치를 잡아준다. */
export function StatisticsSkeleton() {
  return (
    <div className="min-h-0 flex-1 overflow-hidden" role="status">
      <span className="sr-only">옷장 통계를 불러오는 중</span>
      <div aria-hidden="true">
        <div className="border-b border-line px-5 pt-4 pb-3 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <div className="mb-3 h-4 w-36 rounded-full bg-line/60" />
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="rounded-2xl border border-line bg-surface px-3 py-3 sm:px-4">
                  <div className="h-4 w-3/4 rounded-full bg-line/60" />
                  <div className="mt-1 flex h-7 items-center sm:h-8"><div className="h-5 w-9 rounded-md bg-line" /></div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-surface p-1">
              <div className="h-11 rounded-lg bg-line/50" />
              <div className="h-11 rounded-lg bg-line/25" />
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-5 py-5 sm:px-6">
          <div className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
            <div className="h-5 w-40 max-w-full rounded-full bg-line" />
            <div className="mt-2 h-3 w-52 max-w-full rounded-full bg-line/60" />
            <div className="statistics-loading-bars mt-6 grid gap-3">
              {[0, 1, 2, 3].map((index) => <div key={index} className="h-3 rounded-full bg-line" />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
