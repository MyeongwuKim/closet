import { useEffect } from 'react'
import { matchPath, Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { GlobalUi } from '../GlobalUi'
import { useClosetStore } from '../../features/closet/stores/useClosetStore'
import { useUiStore } from '../../stores/useUiStore'
import { OutfitRecommendationActions } from '../../features/plan/components/OutfitRecommendationActions'
import { AppHeader } from './AppHeader'
import { MobileTabBar } from './MobileTabBar'
import { useWearWeatherLocationSync } from '../../features/plan/hooks/useWearWeatherLocationSync'

/** 주요 탭의 공통 UI를 표시하고 허용된 날씨 지역을 동기화한다. 전체 화면으로 열리는 코디·옷 상세와 설정 하위 화면에서는 하단 탭을 숨겨 입력·저장 영역을 가리지 않는다. */
export function AppLayout() {
  const location = useLocation()
  useWearWeatherLocationSync(location.pathname)
  const hasHeaderRecommendations = ['/plan', '/closet', '/lookbook'].includes(location.pathname)
  const isDetailRoute = [
    '/plan/:date',
    '/plan/:date/item/:itemId',
    '/closet/:itemId',
    '/lookbook/new',
    '/settings/style-profile',
    '/settings/statistics',
    '/settings/wear-reminder',
    '/settings/notifications-weather',
    '/settings/app-info',
  ]
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
    <div className="app-layout flow-root min-h-dvh bg-canvas text-ink">
      <GlobalUi />
      <div className="wearroom-shell" data-room={room}>
        <AppHeader actions={hasHeaderRecommendations ? <OutfitRecommendationActions placement="header" /> : undefined} />
        <main className="app-main mx-auto w-full max-w-6xl px-4 pt-2 pb-6 sm:px-8 sm:pt-4 sm:pb-12">
          <div className="room-page-enter" key={location.pathname.split('/')[1]}><Outlet /></div>
        </main>
      </div>
      {!isDetailRoute && <MobileTabBar />}
      <ScrollRestoration />
    </div>
  )
}
