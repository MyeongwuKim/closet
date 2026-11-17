import { Bell, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

/** 재발견 목록에서 알림 설정으로 연결한다. 현재 옷을 쿼리에 담아 설정에서 돌아온 뒤 같은 카드로 복원한다. */
export function RediscoveryNotificationLink({ itemId }: { itemId?: string }) {
  const params = new URLSearchParams({ from: 'rediscovery' })
  if (itemId) params.set('item', itemId)
  return (
    <Link to={`/settings/notifications?${params}`} className="rediscovery-notification-link" aria-label="잊고 있던 옷 알림 설정">
      <Bell size={18} strokeWidth={1.7} aria-hidden="true" />
      <span>주 1회 알림 받기</span>
      <ChevronRight size={17} aria-hidden="true" />
    </Link>
  )
}
