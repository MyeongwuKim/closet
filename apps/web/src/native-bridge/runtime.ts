export function isNativeWebViewRuntime() {
  return window.ClosetRuntimeConfig?.isNativeWebView === true
}

export function navigateNativeWebView(path: string) {
  if (!isNativeWebViewRuntime()) return false

  window.location.hash = path.startsWith('/') ? path : `/${path}`
  return true
}
