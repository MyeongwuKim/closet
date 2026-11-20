/**
 * 사용 위치: 로그인 완료 → 네이티브 앱 메인 화면
 *
 * 용도:
 * 웹 앱을 WebView로 표시하고 네이티브 브리지·딥 링크·앱 복귀 알림을 연결한다.
 *
 * 구조:
 * WebView와 로딩·오류 화면으로 구성되어 있다.
 */
import { wearroomColors } from '../../theme/wearroomTheme'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, StyleSheet, View } from 'react-native'
import WebView from 'react-native-webview'
import { resolveWebBundle, markResolvedWebBundleReady, rollbackResolvedWebBundle, type ResolvedWebBundle } from '../../webBundle/webBundleLoader'
import { createWebViewReadyRecoveryController, type WebViewReadyRecoveryController } from '../../webBundle/webViewReadyRecovery'
import { useDeepLinkNavigation } from '../../navigation/useDeepLinkNavigation'
import { createWebViewNavigationScript } from '../../navigation/webViewNavigation'
import {
  CLOSET_WEBVIEW_BRIDGE_SCRIPT,
  handleNativeBridgeMessage,
} from '../../webview/bridge'
import {
  openExternalUrl,
  shouldKeepUrlInWebView,
} from '../../webview/bridge/externalLinkBridge'
import { NativeWebViewLoading } from './NativeWebViewLoading'

const WEB_ACCESS_TOKEN_KEY = 'closet-test-access-token'

interface NativeWebViewScreenProps {
  accessToken: string
  notificationPath?: string | null
  onNotificationPathHandled?: () => void
  onAuthSessionChange: (accessToken: string | null) => Promise<void> | void
}

export function NativeWebViewScreen({
  accessToken,
  notificationPath,
  onNotificationPathHandled,
  onAuthSessionChange,
}: NativeWebViewScreenProps) {
  const webViewRef = useRef<WebView>(null)
  const webReadyRef = useRef(false)
  const pendingWebPathRef = useRef<string | null>(null)
  const [bundle, setBundle] = useState<ResolvedWebBundle | null>(null)
  const bundleRef = useRef<ResolvedWebBundle | null>(null)
  bundleRef.current = bundle
  const recoveryRef = useRef<WebViewReadyRecoveryController | null>(null)
  const failureRef = useRef<(message: string) => void>(() => {})
  const rollingBackRef = useRef(false)
  const mountedRef = useRef(false)
  const [resolveAttempt, setResolveAttempt] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const bundleKey = bundle?.key ?? null
  const loadKey = (bundleKey ?? 'preparing') + ':' + reloadKey
  const currentLoadKey = useRef(loadKey)
  currentLoadKey.current = loadKey
  const injectedScript = useMemo(
    () => `
      window.__closetBundleLoadKey = ${JSON.stringify(loadKey)};
      try {
        window.localStorage.setItem(
          ${JSON.stringify(WEB_ACCESS_TOKEN_KEY)},
          ${JSON.stringify(accessToken)}
        );
      } catch (error) {}
      ${CLOSET_WEBVIEW_BRIDGE_SCRIPT}
    `,
    [accessToken, loadKey],
  )

  const flushPendingNavigation = useCallback(() => {
    webReadyRef.current = true
    const current = bundleRef.current
    if (current) {
      recoveryRef.current?.markReady(current.key)
      void markResolvedWebBundleReady(current).catch(() => failureRef.current('업데이트 저장에 실패했어요.'))
    }
    setIsLoading(false)
    setLoadError(null)
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new CustomEvent('closet:native-app-state', { detail: { isActive: ${AppState.currentState === 'active'} } })); true;`,
    )
    const path = pendingWebPathRef.current
    if (!path) return

    pendingWebPathRef.current = null
    webViewRef.current?.injectJavaScript(createWebViewNavigationScript(path))
  }, [])

  const navigateToWebPath = useCallback((path: string) => {
    if (!webReadyRef.current) {
      pendingWebPathRef.current = path
      return
    }

    webViewRef.current?.injectJavaScript(createWebViewNavigationScript(path))
  }, [])

  useDeepLinkNavigation(navigateToWebPath)

  useEffect(() => {
    if (!notificationPath) return
    navigateToWebPath(notificationPath)
    onNotificationPathHandled?.()
  }, [navigateToWebPath, notificationPath, onNotificationPathHandled])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      recoveryRef.current?.setAppActive(state === 'active')
      if (!webReadyRef.current) return
      // 웹은 백그라운드에서 완료 팝업을 멈추고, 복귀하면 저장된 작업을 다시 확인한다.
      webViewRef.current?.injectJavaScript(
        `window.dispatchEvent(new CustomEvent('closet:native-app-state', { detail: { isActive: ${state === 'active'} } })); ${state === 'active' ? "window.dispatchEvent(new Event('closet:native-app-active'));" : ''} true;`,
      )
    })
    return () => subscription.remove()
  }, [])

  useEffect(() => {
    mountedRef.current = true
    let cancelled = false
    setIsLoading(true)
    setLoadError(null)
    void resolveWebBundle().then((resolved) => {
      if (!cancelled) setBundle(resolved)
    }).catch(() => {
      if (!cancelled) { setLoadError('업데이트를 준비하지 못했어요.'); setIsLoading(false) }
    })
    return () => { cancelled = true; mountedRef.current = false }
  }, [resolveAttempt])

  failureRef.current = (message) => {
    const current = bundleRef.current
    if (!current || rollingBackRef.current) return
    recoveryRef.current?.stopWaiting(current.key)
    if (current.kind !== 'installed') { setLoadError(message); setIsLoading(false); return }
    rollingBackRef.current = true
    void rollbackResolvedWebBundle(current).then((fallback) => {
      if (!mountedRef.current || bundleRef.current?.key !== current.key) return
      webReadyRef.current = false
      setLoadError(null)
      setIsLoading(true)
      setBundle(fallback)
      setReloadKey(key => key + 1)
    }).catch(() => {
      if (mountedRef.current) { setLoadError(message); setIsLoading(false) }
    }).finally(() => { rollingBackRef.current = false })
  }

  useEffect(() => {
    if (!bundleKey) return
    const recovery = createWebViewReadyRecoveryController({
      initialAppActive: AppState.currentState === 'active',
      requestReadySignal: () => webViewRef.current?.injectJavaScript("window.dispatchEvent(new Event('closet:request-web-app-ready')); true;"),
      reloadWebView: () => {
        webReadyRef.current = false
        setLoadError(null)
        setIsLoading(true)
        setReloadKey(key => key + 1)
      },
      onRecoveryFailed: () => failureRef.current('화면 준비 시간이 초과됐어요.'),
    })
    recoveryRef.current = recovery
    recovery.prepareBundle(bundleKey)
    recovery.waitForReady(bundleKey)
    return () => { recovery.dispose(); if (recoveryRef.current === recovery) recoveryRef.current = null }
  }, [bundleKey])

  const retry = () => {
    if (!bundle) { setResolveAttempt(value => value + 1); return }
    recoveryRef.current?.retryManually(bundle.key)
    webReadyRef.current = false
    setLoadError(null)
    setIsLoading(true)
  }

  return (
    <View style={styles.container}>
      {bundle ? <WebView
        key={loadKey}
        ref={webViewRef}
        source={bundle.source}
        style={styles.webView}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        hideKeyboardAccessoryView
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        setBuiltInZoomControls={false}
        setDisplayZoomControls={false}
        scalesPageToFit={false}
        setSupportMultipleWindows={false}
        injectedJavaScriptBeforeContentLoaded={injectedScript}
        injectedJavaScript={injectedScript}
        onLoadStart={() => {
          if (currentLoadKey.current !== loadKey) return
          webReadyRef.current = false
          setIsLoading(true)
          setLoadError(null)
        }}
        onLoadEnd={() => {
          if (currentLoadKey.current !== loadKey) return
          if (!webReadyRef.current) recoveryRef.current?.waitForReady(bundle.key)
        }}
        onError={({ nativeEvent }) => {
          if (currentLoadKey.current !== loadKey) return
          failureRef.current(nativeEvent.description || '웹 화면을 불러오지 못했어요.')
        }}
        onHttpError={() => { if (currentLoadKey.current === loadKey) failureRef.current('웹 화면 요청이 실패했어요.') }}
        onContentProcessDidTerminate={() => { if (currentLoadKey.current === loadKey) recoveryRef.current?.handleProcessTerminated(bundle.key) }}
        onRenderProcessGone={() => recoveryRef.current?.handleProcessTerminated(bundle.key)}
        onMessage={(event) => {
          if (currentLoadKey.current !== loadKey) return
          try {
            const message = JSON.parse(event.nativeEvent.data)
            if (message.type === 'closet:web-app-ready' && message.loadKey !== loadKey) return
          } catch { return }
          void handleNativeBridgeMessage(event, webViewRef, {
            accessToken,
            onWebAppReady: flushPendingNavigation,
            onAuthSessionChange,
          })
        }}
        onShouldStartLoadWithRequest={(request) => {
          if (shouldKeepUrlInWebView(request.url)) return true

          void openExternalUrl(request.url)
          return false
        }}
      /> : null}

      {isLoading || loadError ? (
        <NativeWebViewLoading error={loadError} onRetry={retry} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: wearroomColors.canvas,
  },
  webView: {
    flex: 1,
    backgroundColor: wearroomColors.canvas,
  },
})
