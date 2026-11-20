import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import { queryClient } from './lib/queryClient'

function App() {
  useEffect(() => {
    const notifyReady = () => window.ReactNativeWebView?.postMessage(
      JSON.stringify({ type: 'closet:web-app-ready', loadKey: (window as Window & { __closetBundleLoadKey?: string }).__closetBundleLoadKey }),
    )
    notifyReady()
    window.addEventListener('closet:request-web-app-ready', notifyReady)
    return () => window.removeEventListener('closet:request-web-app-ready', notifyReady)
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

export default App
