/**
 * 사용 위치: 로그인 완료 → 네이티브 앱 메인 화면
 *
 * 용도:
 * 웹 앱을 WebView로 표시하고 네이티브 브리지·딥 링크·앱 복귀 알림을 연결한다.
 *
 * 구조:
 * WebView와 로딩·오류 화면으로 구성되어 있다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, StyleSheet, View } from 'react-native'
import WebView from 'react-native-webview'
import {
  WEB_BUNDLE_BASE_URL,
  WEB_BUNDLE_HTML,
} from '../../generated/webBundle'
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
  const [reloadKey, setReloadKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const injectedScript = useMemo(
    () => `
      try {
        window.localStorage.setItem(
          ${JSON.stringify(WEB_ACCESS_TOKEN_KEY)},
          ${JSON.stringify(accessToken)}
        );
      } catch (error) {}
      ${CLOSET_WEBVIEW_BRIDGE_SCRIPT}
    `,
    [accessToken],
  )

  const flushPendingNavigation = useCallback(() => {
    webReadyRef.current = true
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
      if (state !== 'active' || !webReadyRef.current) return
      webViewRef.current?.injectJavaScript(
        "window.dispatchEvent(new Event('closet:native-app-active')); true;",
      )
    })
    return () => subscription.remove()
  }, [])

  const retry = () => {
    webReadyRef.current = false
    setLoadError(null)
    setIsLoading(true)
    setReloadKey((current) => current + 1)
  }

  return (
    <View style={styles.container}>
      <WebView
        key={reloadKey}
        ref={webViewRef}
        source={{ html: WEB_BUNDLE_HTML, baseUrl: WEB_BUNDLE_BASE_URL }}
        style={styles.webView}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        bounces={false}
        overScrollMode="never"
        setBuiltInZoomControls={false}
        setDisplayZoomControls={false}
        scalesPageToFit={false}
        setSupportMultipleWindows={false}
        injectedJavaScriptBeforeContentLoaded={injectedScript}
        onLoadStart={() => {
          webReadyRef.current = false
          setIsLoading(true)
          setLoadError(null)
        }}
        onLoadEnd={() => {
          setIsLoading(false)
        }}
        onError={({ nativeEvent }) => {
          setIsLoading(false)
          setLoadError(nativeEvent.description || '웹 화면을 불러오지 못했어요.')
        }}
        onMessage={(event) => {
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
      />

      {isLoading || loadError ? (
        <NativeWebViewLoading error={loadError} onRetry={retry} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f0e9',
  },
  webView: {
    flex: 1,
    backgroundColor: '#f3f0e9',
  },
})
