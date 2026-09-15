/**
 * 진입 경로: 앱 실행
 *
 * 용도:
 * 최초 권한 안내와 인증 상태에 따라 시작 화면을 전환한다.
 *
 * 구조:
 * 권한 안내, 인증 확인, 로그인, 로그인 완료 WebView와
 * 하단 탭과 자연스럽게 이어지는 기기 세이프 영역으로 구성되어 있다.
 */
import { StatusBar } from 'expo-status-bar'
import { useCallback, useState } from 'react'
import { SafeAreaView, StyleSheet, View } from 'react-native'
import { useNativeAuth } from './auth/useNativeAuth'
import { NativeLoginScreen } from './components/native-auth/NativeLoginScreen'
import { InitialPermissionPromptHost } from './components/native-permission/InitialPermissionPromptHost'
import { NativeWebViewScreen } from './components/native-webview/NativeWebViewScreen'
import { usePushRegistration } from './notifications/usePushRegistration'
import { useNotificationNavigation } from './notifications/useNotificationNavigation'

export default function App() {
  const auth = useNativeAuth()
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

  if (
    !isPermissionFlowComplete ||
    auth.status === 'checking' ||
    auth.status === 'signed-out' ||
    !auth.session
  ) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <NativeLoginScreen
          isPreparing={!isPermissionFlowComplete || auth.status === 'checking'}
          onTestLogin={auth.loginWithTestAccount}
        />
        {!isPermissionFlowComplete ? (
          <InitialPermissionPromptHost onComplete={completePermissionFlow} />
        ) : null}
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.signedInScreen}>
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
    backgroundColor: '#f3f0e9',
  },
  signedInScreen: {
    flex: 1,
    backgroundColor: '#fffdf8',
  },
  topSafeAreaBackground: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: 80,
    backgroundColor: '#f3f0e9',
  },
})
