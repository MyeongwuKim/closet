/**
 * 진입 경로: 앱 실행
 *
 * 용도:
 * 최초 권한 안내와 인증 상태에 따라 로딩, 연결 오류, 로그인, 메인 화면을 전환한다.
 *
 * 구조:
 * 권한 안내, 인증 확인, 서버 연결 오류, 로그인, 로그인 완료 WebView와
 * 하단 탭과 자연스럽게 이어지는 기기 세이프 영역으로 구성되어 있다.
 */
import { wearroomColors } from './theme/wearroomTheme'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useRef, useState } from 'react'
import { SafeAreaView, StyleSheet, View } from 'react-native'
import { useNativeAuth } from './auth/useNativeAuth'
import { NativeConnectionErrorScreen } from './components/native-auth/NativeConnectionErrorScreen'
import { NativeLoginScreen } from './components/native-auth/NativeLoginScreen'
import { InitialPermissionPromptHost } from './components/native-permission/InitialPermissionPromptHost'
import { NativeWebViewScreen } from './components/native-webview/NativeWebViewScreen'
import { usePushRegistration } from './notifications/usePushRegistration'
import { useNotificationNavigation } from './notifications/useNotificationNavigation'

// 첫 닫힌 옷장이 실제 화면 위치에 그려질 때까지 네이티브 스플래시를 유지한다.
const splashHold = SplashScreen.preventAutoHideAsync().catch(() => {})
const SPLASH_SETTLE_DELAY_MS = 400

export default function App() {
  const auth = useNativeAuth()
  const splashReleaseStarted = useRef(false)
  const [isSplashHidden, setIsSplashHidden] = useState(false)
  const [notificationPath, setNotificationPath] = useState<string | null>(null)
  useNotificationNavigation(setNotificationPath)
  usePushRegistration(auth.status === 'signed-in' ? auth.session?.accessToken : undefined)
  const [isPermissionFlowComplete, setIsPermissionFlowComplete] =
    useState(false)
  const completePermissionFlow = useCallback(() => {
    setIsPermissionFlowComplete(true)
  }, [])
  const clearNotificationPath = useCallback(() => {
    setNotificationPath(null)
  }, [])

  /** 닫힌 옷장의 크기·화면 좌표가 준비되면 네이티브 스플래시를 한 번만 닫는다. */
  const releaseSplash = useCallback(() => {
    if (splashReleaseStarted.current) return
    splashReleaseStarted.current = true

    void splashHold
      .then(() => SplashScreen.hideAsync())
      .catch(() => {})
      // iOS의 시작 화면 제거가 실제 프레임에 반영된 뒤 문 열림을 시작한다.
      .finally(() => setTimeout(() => setIsSplashHidden(true), SPLASH_SETTLE_DELAY_MS))
  }, [])

  if (!isPermissionFlowComplete || auth.status === 'checking') {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <NativeLoginScreen
          isPreparing
          onInitialFrameReady={releaseSplash}
          onTestLogin={auth.loginWithTestAccount}
        />
        {!isPermissionFlowComplete ? (
          <InitialPermissionPromptHost onComplete={completePermissionFlow} />
        ) : null}
      </SafeAreaView>
    )
  }

  if (auth.status === 'connection-error') {
    return (
      <SafeAreaView onLayout={releaseSplash} style={styles.screen}>
        <StatusBar style="dark" />
        <NativeConnectionErrorScreen onRetry={auth.retrySessionCheck} />
      </SafeAreaView>
    )
  }

  if (auth.status === 'signed-out' || !auth.session) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <NativeLoginScreen
          isPreparing={!isSplashHidden}
          onInitialFrameReady={releaseSplash}
          onTestLogin={auth.loginWithTestAccount}
        />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView onLayout={releaseSplash} style={styles.signedInScreen}>
      <View pointerEvents="none" style={styles.topSafeAreaBackground} />
      <StatusBar style="dark" />
      <NativeWebViewScreen
        accessToken={auth.session.accessToken}
        notificationPath={notificationPath}
        onNotificationPathHandled={clearNotificationPath}
        onAuthSessionChange={auth.updateSession}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: wearroomColors.canvas,
  },
  signedInScreen: {
    flex: 1,
    backgroundColor: wearroomColors.surface,
  },
  topSafeAreaBackground: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: 80,
    backgroundColor: wearroomColors.canvas,
  },
})
