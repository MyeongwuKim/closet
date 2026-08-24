export function syncNativeAuthSession(accessToken: string | null) {
  if (!window.ClosetNative) return Promise.resolve()

  return window.ClosetNative.setAuthSession(accessToken).catch(() => undefined)
}
