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
import { createWebViewNavigationQueue, createWebViewNavigationScript, WEB_VIEW_NAVIGATION_DELIVERED } from '../../navigation/webViewNavigation'
import {
  createClosetWebViewBridgeScript,
  handleNativeBridgeMessage,
} from '../../webview/bridge'
import {
  openExternalUrl,
  shouldKeepUrlInWebView,
} from '../../webview/bridge/externalLinkBridge'
import { supportsPreviewSubmissionInBackground } from '../../webview/bridge/previewSubmissionBackgroundTask'
import { supportsWardrobeCutout } from '../../webview/bridge/wardrobeCutoutBridge'
import { INITIAL_WEB_BUNDLE_PROGRESS } from '../../webBundle/webBundleProgress'
import type { WebBundleProgress } from '../../webBundle/webBundleTypes'
import { NativeWebViewLoading } from './NativeWebViewLoading'

const FIRST_FRAME_TIMEOUT_MS = 1500
const FIRST_FRAME_MESSAGE = 'closet:web-first-frame'

const WEB_ACCESS_TOKEN_KEY = 'closet-test-access-token'

interface NativeWebViewScreenProps {
  isSplashHidden: boolean
  onInitialFrameReady: () => void
  accessToken: string
  notificationPath?: string | null
  onNotificationPathHandled?: () => void
  onAuthSessionChange: (accessToken: string | null) => Promise<void> | void
}

export function NativeWebViewScreen({
  isSplashHidden,
  onInitialFrameReady,
  accessToken,
  notificationPath,
  onNotificationPathHandled,
  onAuthSessionChange,
}: NativeWebViewScreenProps) {
  const webViewRef = useRef<WebView>(null)
  const webReadyRef = useRef(false)
  const webNavigation = useMemo(createWebViewNavigationQueue, [])
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
  const [firstFrameKey, setFirstFrameKey] = useState<string | null>(null)
  const [showUpdateSteps, setShowUpdateSteps] = useState(false)
  const [bundleProgress, setBundleProgress] = useState<WebBundleProgress>(INITIAL_WEB_BUNDLE_PROGRESS)
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
      ${createClosetWebViewBridgeScript(supportsPreviewSubmissionInBackground, supportsWardrobeCutout)}
    `,
    [accessToken, loadKey],
  )

  const flushWebNavigation = useCallback((isActive = AppState.currentState === 'active') => {
    const webView = webViewRef.current
    if (!webView) return
    webNavigation.flush({ isActive, isReady: webReadyRef.current }, (path, id) => {
      webView.injectJavaScript(createWebViewNavigationScript(path, id))
    })
  }, [webNavigation])

  const flushPendingNavigation = useCallback(() => {
    webReadyRef.current = true
    const current = bundleRef.current
    if (current) {
      recoveryRef.current?.markReady(current.key)
      void markResolvedWebBundleReady(current).catch(() => failureRef.current('업데이트 저장에 실패했어요.'))
    }
    setBundleProgress({ stage: 'ready', progress: 1, message: '옷장이 준비됐어요' })
    setIsLoading(false)
    setLoadError(null)
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new CustomEvent('closet:native-app-state', { detail: { isActive: ${AppState.currentState === 'active'} } })); true;`,
    )
    flushWebNavigation()
  }, [flushWebNavigation])

  // 기존 번들의 준비 신호는 라우터가 첫 본문을 그리기 전에 도착할 수 있다.
  useEffect(() => {
    if (isLoading || loadError || firstFrameKey === loadKey) return
    const timeout = setTimeout(() => setFirstFrameKey(loadKey), FIRST_FRAME_TIMEOUT_MS)
    webViewRef.current?.injectJavaScript(`
      (() => {
        const loadKey = ${JSON.stringify(loadKey)};
        const deadline = Date.now() + ${FIRST_FRAME_TIMEOUT_MS};
        const waitForContent = () => {
          if (window.__closetBundleLoadKey !== loadKey || Date.now() >= deadline) return;
          const content = document.querySelector('.app-main .room-page-enter');
          if (!content?.firstElementChild || content.getBoundingClientRect().height === 0) {
            requestAnimationFrame(waitForContent);
            return;
          }
          requestAnimationFrame(() => requestAnimationFrame(() => {
            window.ReactNativeWebView?.postMessage(JSON.stringify({
              type: ${JSON.stringify(FIRST_FRAME_MESSAGE)}, loadKey
            }));
          }));
        };
        requestAnimationFrame(waitForContent);
      })();
      true;
    `)
    return () => clearTimeout(timeout)
  }, [firstFrameKey, isLoading, loadError, loadKey])

  const navigateToWebPath = useCallback((path: string) => {
    webNavigation.enqueue(path)
    flushWebNavigation()
  }, [flushWebNavigation, webNavigation])

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
      if (state === 'active') flushWebNavigation(true)
      // 웹은 백그라운드에서 완료 팝업을 멈추고, 복귀하면 저장된 작업을 다시 확인한다.
      webViewRef.current?.injectJavaScript(
        `window.dispatchEvent(new CustomEvent('closet:native-app-state', { detail: { isActive: ${state === 'active'} } })); ${state === 'active' ? "window.dispatchEvent(new Event('closet:native-app-active'));" : ''} true;`,
      )
    })
    return () => subscription.remove()
  }, [flushWebNavigation])

  useEffect(() => {
    mountedRef.current = true
    let cancelled = false
    setIsLoading(true)
    setLoadError(null)
    setBundleProgress(INITIAL_WEB_BUNDLE_PROGRESS)
    setShowUpdateSteps(false)
    void resolveWebBundle(progress => {
      if (cancelled) return
      setBundleProgress(progress)
      if (progress.stage === 'downloading') setShowUpdateSteps(true)
    }).then((resolved) => {
      if (!cancelled) {
        setBundleProgress({ stage: 'loading', progress: 0.94, message: '옷장을 열고 있어요' })
        setBundle(resolved)
      }
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
    setBundleProgress({ stage: 'rollback', progress: 0.92, message: '이전 버전으로 다시 열고 있어요' })
    void rollbackResolvedWebBundle(current).then((fallback) => {
      if (!mountedRef.current || bundleRef.current?.key !== current.key) return
      webReadyRef.current = false
      setLoadError(null)
      setIsLoading(true)
      setBundleProgress({ stage: 'loading', progress: 0.94, message: '옷장을 열고 있어요' })
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
        setBundleProgress({ stage: 'loading', progress: 0.94, message: '옷장을 열고 있어요' })
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
          setFirstFrameKey(null)
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
            if (message.type === FIRST_FRAME_MESSAGE) {
              if (message.loadKey === loadKey && webReadyRef.current) setFirstFrameKey(loadKey)
              return
            }
            if (message.type === WEB_VIEW_NAVIGATION_DELIVERED) {
              if (message.loadKey === loadKey && Number.isSafeInteger(message.id)) webNavigation.acknowledge(message.id)
              return
            }
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

      <NativeWebViewLoading
        canOpenWardrobe={isSplashHidden}
        onInitialFrameReady={onInitialFrameReady}
        visible={!isSplashHidden || isLoading || Boolean(loadError) || firstFrameKey !== loadKey}
        stage={firstFrameKey !== loadKey && bundleProgress.stage === 'ready' ? 'loading' : bundleProgress.stage}
        showUpdateSteps={showUpdateSteps}
        error={loadError}
        onRetry={retry}
      />
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
