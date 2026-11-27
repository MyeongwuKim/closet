import { GraphqlRequestError } from '../../../lib/graphql'

/**
 * 룩북 요청 중 앱이 숨겨졌다가 통신 오류가 나면, 포그라운드에서 해당 호출을 한 번 더 보낸다.
 * 호출자는 재전송 전 계정을 확인하고, 생성 접수에는 첫 시도의 요청 번호를 그대로 사용한다.
 */
export function createPreviewRequestRetry(assertSameAccount: () => void) {
  let nativeActive = true
  const isForeground = () => nativeActive && document.visibilityState === 'visible'
  let wasBackgrounded = !isForeground()
  let resolveReturn: (() => void) | undefined

  const onVisibilityChange = () => {
    if (!isForeground()) {
      wasBackgrounded = true
      return
    }
    resolveReturn?.()
    resolveReturn = undefined
  }
  const onNativeState = (event: Event) => {
    const isActive = (event as CustomEvent<{ isActive: boolean }>).detail?.isActive
    if (typeof isActive !== 'boolean') return
    nativeActive = isActive
    onVisibilityChange()
  }
  const onNativeReturn = () => {
    nativeActive = true
    onVisibilityChange()
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('closet:native-app-state', onNativeState)
  window.addEventListener('closet:native-app-active', onNativeReturn)

  return {
    async run<T>(request: () => Promise<T>) {
      try {
        return await request()
      } catch (error) {
        if ((!wasBackgrounded && isForeground()) || !(error instanceof Error) || error.name === 'AbortError' ||
          (error instanceof GraphqlRequestError && error.code)) throw error

        if (!isForeground()) await new Promise<void>((resolve) => { resolveReturn = resolve })
        assertSameAccount()
        return request()
      }
    },
    dispose() {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('closet:native-app-state', onNativeState)
      window.removeEventListener('closet:native-app-active', onNativeReturn)
    },
  }
}
