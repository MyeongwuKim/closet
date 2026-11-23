import { Search, Shirt } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'

/** 옷장 목록을 스크롤하는 동안에도 하단에서 재발견 화면을 연다. 후보는 화면을 열 때 조회한다. */
export function WardrobeRediscoveryButton() {
  const navigate = useNavigate()
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--app-bottom-space)+0.75rem)] z-30 mx-auto flex w-full max-w-6xl justify-end px-4 sm:px-8">
      <button type="button" aria-label="잊고 있던 옷 확인하기" aria-haspopup="dialog" onClick={() => navigate('/closet/rediscovery')}
        title="잊고 있던 옷"
        className="pointer-events-auto grid size-12 shrink-0 place-items-center rounded-full border border-line bg-surface text-accent shadow-md hover:border-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2">
        <span aria-hidden="true" className="relative block size-7">
          <Shirt size={22} strokeWidth={1.8} className="absolute top-0.5 left-0.5" />
          <span className="absolute right-0 bottom-0 grid size-4 place-items-center rounded-full bg-surface">
            <Search size={12} strokeWidth={2.2} />
          </span>
        </span>
      </button>
    </div>, document.body,
  )
}
