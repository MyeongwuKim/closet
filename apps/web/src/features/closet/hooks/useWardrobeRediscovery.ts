import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useMeQuery } from '../../settings/api/profileQueries'
import { useWardrobeRediscoveryQuery } from '../api/wardrobeRediscoveryQueries'
import { useClosetStore } from '../stores/useClosetStore'

/** 기기 시간대와 관계없이 하이라이트를 고정하는 한국 날짜를 반환한다. */
function getRediscoveryDay() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())
}

/** 옷장 하이라이트의 계정별 조회·한국 날짜 전환을 연결한다. 상세 경로·필터·접힌 영역에서는 조회를 멈춘다. */
export function useWardrobeRediscovery(visible: boolean, expanded: boolean) {
  const location = useLocation()
  const meQuery = useMeQuery()
  const [day, setDay] = useState(getRediscoveryDay)
  const enabled = visible && location.pathname === '/closet'
  const query = useWardrobeRediscoveryQuery(meQuery.data?.id ?? null, day, enabled && expanded)

  // 화면을 계속 열어둔 채 한국 자정을 넘기거나 앱에 돌아오면 새 날짜의 선택을 조회한다.
  useEffect(() => {
    const updateDay = () => setDay(getRediscoveryDay())
    const interval = window.setInterval(updateDay, 60_000)
    window.addEventListener('focus', updateDay)
    document.addEventListener('visibilitychange', updateDay)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', updateDay)
      document.removeEventListener('visibilitychange', updateDay)
    }
  }, [])

  // 다음 페이지에 있던 옷도 상세와 기존 코디 추천에서 참조할 수 있도록 Store에 병합한다.
  useEffect(() => {
    if (query.data) useClosetStore.getState().mergeItems(query.data.items.map((entry) => entry.item))
  }, [query.data])

  return { query, enabled, viewerId: meQuery.data?.id ?? null }
}
