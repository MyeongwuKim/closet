/**
 * 진입 경로: 앱 실행
 *
 * 용도:
 * 최초 권한 안내와 인증 상태에 따라 시작 화면을 전환한다.
 *
 * 구조:
 * 권한 안내, 인증 확인, 로그인, 로그인 완료 WebView 화면으로 구성되어 있다.
 */
import { StatusBar } from 'expo-status-bar'
import { useCallback, useState } from 'react'
import { SafeAreaView, StyleSheet } from 'react-native'
import { useNativeAuth } from './auth/useNativeAuth'
import { NativeAuthBootScreen } from './components/native-auth/NativeAuthBootScreen'
import { NativeLoginScreen } from './components/native-auth/NativeLoginScreen'
import { InitialPermissionPromptHost } from './components/native-permission/InitialPermissionPromptHost'
import { NativeWebViewScreen } from './components/native-webview/NativeWebViewScreen'

export default function App() {
  const auth = useNativeAuth()
  const [isPermissionFlowComplete, setIsPermissionFlowComplete] =
    useState(false)
  const completePermissionFlow = useCallback(() => {
    setIsPermissionFlowComplete(true)
  }, [])

  if (!isPermissionFlowComplete) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <NativeAuthBootScreen />
        <InitialPermissionPromptHost onComplete={completePermissionFlow} />
      </SafeAreaView>
    )
  }

  if (auth.status === 'checking') {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <NativeAuthBootScreen />
      </SafeAreaView>
    )
  }

  if (auth.status === 'signed-out' || !auth.session) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <NativeLoginScreen onTestLogin={auth.loginWithTestAccount} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <NativeWebViewScreen
        accessToken={auth.session.accessToken}
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
})
