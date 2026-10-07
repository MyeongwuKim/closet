import { useEffect } from 'react'
import { matchPath, Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { GlobalUi } from '../GlobalUi'
import { useClosetStore } from '../../features/closet/stores/useClosetStore'
import { useUiStore } from '../../stores/useUiStore'
import { OutfitRecommendationActions } from '../../features/plan/components/OutfitRecommendationActions'
import { AppHeader } from './AppHeader'
import { MobileTabBar } from './MobileTabBar'

/** 주요 탭의 공통 헤더·추천 버튼·하단 탭을 표시한다. 날짜별 코디·옷 상세·코디 맞춰보기는 최상위 팝업으로 열리므로 해당 경로에서는 하단 탭을 숨긴다. */
export function AppLayout() {
  const location = useLocation()
  const hasHeaderRecommendations = ['/plan', '/closet', '/lookbook'].includes(location.pathname)
  const isDetailRoute = ['/plan/:date', '/plan/:date/item/:itemId', '/closet/:itemId', '/lookbook/new']
    .some((pattern) => matchPath(pattern, location.pathname))
  const room = location.pathname.startsWith('/closet') || location.pathname.startsWith('/lookbook') ? 'wardrobe' : 'drawer'
  const disposeUploadedImages = useClosetStore(
    (state) => state.disposeUploadedImages,
  )
  const disposeClassificationImages = useUiStore(
    (state) => state.disposeClassificationImages,
  )

  useEffect(
    () => () => {
      disposeUploadedImages()
      disposeClassificationImages()
    },
    [disposeClassificationImages, disposeUploadedImages],
  )

  return (
    <div className="flow-root min-h-dvh bg-canvas pb-[calc(4.125rem+env(safe-area-inset-bottom))] text-ink md:pb-8">
      <GlobalUi />
      <div className="wearroom-shell" data-room={room}>
        <AppHeader actions={hasHeaderRecommendations ? <OutfitRecommendationActions placement="header" /> : undefined} />
        <main className="app-main mx-auto w-full max-w-6xl px-4 pt-3 pb-6 sm:px-8 sm:pt-6 sm:pb-12">
          <div className="room-page-enter" key={location.pathname.split('/')[1]}><Outlet /></div>
        </main>
      </div>
      {!isDetailRoute && <MobileTabBar />}
      <ScrollRestoration />
    </div>
  )
}
