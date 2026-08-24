import { useEffect } from 'react'
import { Linking } from 'react-native'
import { deepLinkToWebPath } from './deepLinks'

export function useDeepLinkNavigation(
  onWebPath: (path: string) => void,
) {
  useEffect(() => {
    let active = true

    const handleUrl = (url: string) => {
      const path = deepLinkToWebPath(url)
      if (path) onWebPath(path)
    }

    void Linking.getInitialURL().then((url) => {
      if (active && url) handleUrl(url)
    })

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url)
    })

    return () => {
      active = false
      subscription.remove()
    }
  }, [onWebPath])
}
