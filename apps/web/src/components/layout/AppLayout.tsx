import { useEffect } from 'react'
import { Outlet, ScrollRestoration } from 'react-router-dom'
import { GlobalUi } from '../GlobalUi'
import { useClosetStore } from '../../features/closet/stores/useClosetStore'
import { useUiStore } from '../../stores/useUiStore'
import { AppHeader } from './AppHeader'
import { MobileTabBar } from './MobileTabBar'

export function AppLayout() {
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
    <div className="min-h-dvh bg-canvas pb-[calc(4.125rem+env(safe-area-inset-bottom))] text-ink md:pb-8">
      <GlobalUi />
      <AppHeader />
      <main className="mx-auto max-w-6xl px-5 py-5 sm:px-8 sm:py-12">
        <Outlet />
      </main>
      <MobileTabBar />
      <ScrollRestoration />
    </div>
  )
}
