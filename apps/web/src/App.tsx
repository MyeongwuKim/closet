import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import { queryClient } from './lib/queryClient'

function App() {
  useEffect(() => {
    window.ReactNativeWebView?.postMessage(
      JSON.stringify({ type: 'closet:web-app-ready' }),
    )
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

export default App
