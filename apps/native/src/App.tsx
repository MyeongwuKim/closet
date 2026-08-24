import { StatusBar } from 'expo-status-bar'
import { SafeAreaView, StyleSheet } from 'react-native'
import { useNativeAuth } from './auth/useNativeAuth'
import { NativeAuthBootScreen } from './components/native-auth/NativeAuthBootScreen'
import { NativeLoginScreen } from './components/native-auth/NativeLoginScreen'
import { NativeWebViewScreen } from './components/native-webview/NativeWebViewScreen'

export default function App() {
  const auth = useNativeAuth()

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
