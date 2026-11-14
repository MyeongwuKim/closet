import { useEffect } from 'react'
import { useKoreaDay } from '../../../hooks/useKoreaDay'
import { useLocation } from 'react-router-dom'
import { useMeQuery } from '../../settings/api/profileQueries'
import { useWardrobeRediscoveryQuery } from '../api/wardrobeRediscoveryQueries'
import { useClosetStore } from '../stores/useClosetStore'

/** 옷장 하이라이트의 계정별 조회·한국 날짜 전환을 연결한다. 상세 경로·필터·접힌 영역에서는 조회를 멈춘다. */
export function useWardrobeRediscovery(visible: boolean, expanded: boolean) {
  const location = useLocation()
  const meQuery = useMeQuery()
  const day = useKoreaDay()
  const enabled = visible && location.pathname === '/closet'
  const query = useWardrobeRediscoveryQuery(meQuery.data?.id ?? null, day, enabled && expanded)

  // 다음 페이지에 있던 옷도 상세와 기존 코디 추천에서 참조할 수 있도록 Store에 병합한다.
  useEffect(() => {
    if (query.data) useClosetStore.getState().mergeItems(query.data.items.map((entry) => entry.item))
  }, [query.data])

  return { query, enabled, viewerId: meQuery.data?.id ?? null }
}
