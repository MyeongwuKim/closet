import { useEffect } from 'react'
import { useKoreaDay } from '../../../hooks/useKoreaDay'
import { useMeQuery } from '../../settings/api/profileQueries'
import { useWardrobeRediscoveryQuery } from '../api/wardrobeRediscoveryQueries'
import { useClosetStore } from '../stores/useClosetStore'

/** 전체 화면 재발견 목록의 계정별 조회와 한국 날짜 전환을 연결한다. 옷 상세·기준 옷 추천에서 참조할 항목도 Store에 병합한다. */
export function useWardrobeRediscovery() {
  const meQuery = useMeQuery()
  const day = useKoreaDay()
  const query = useWardrobeRediscoveryQuery(meQuery.data?.id ?? null, day, true)

  // 다음 페이지에 있던 옷도 상세와 기존 코디 추천에서 참조할 수 있도록 Store에 병합한다.
  useEffect(() => {
    if (query.data) useClosetStore.getState().mergeItems(query.data.items.map((entry) => entry.item))
  }, [query.data])

  return { query, meQuery, viewerId: meQuery.data?.id ?? null }
}
