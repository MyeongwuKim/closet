import { ChevronRight, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

/** 옷장 기본 목록에서 전체 화면 재발견 목록을 연다. 버튼을 누르기 전에는 후보를 조회하거나 노출로 기록하지 않는다. */
export function WardrobeRediscoverySection({ visible }: { visible: boolean }) {
  const navigate = useNavigate()
  if (!visible) return null
  return (
    <section aria-label="잊고 있던 옷" className="mb-4">
      <button type="button" aria-haspopup="dialog" onClick={() => navigate('/closet/rediscovery')}
        className="catalog-entry-action focus-visible:outline-2 focus-visible:outline-accent">
        <RotateCcw size={15} aria-hidden="true" /><span>잊고 있던 옷 확인하기</span><ChevronRight size={15} aria-hidden="true" />
      </button>
    </section>
  )
}
