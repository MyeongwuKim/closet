export function openNativeExternalUrl(url: string) {
  if (window.ClosetNative) {
    return window.ClosetNative.openExternalUrl(url)
  }

  window.open(url, '_blank', 'noopener,noreferrer')
  return Promise.resolve()
}
