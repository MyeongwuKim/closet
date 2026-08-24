import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { beginNativeProviderLogin } from '../../auth/nativeProviderAuth'
import type {
  NativeAuthProvider,
  NativeTestLoginInput,
} from '../../auth/nativeAuthTypes'

interface NativeLoginScreenProps {
  onTestLogin: (input: NativeTestLoginInput) => Promise<void>
}

export function NativeLoginScreen({ onTestLogin }: NativeLoginScreenProps) {
  const [loginId, setLoginId] = useState('native_test')
  const [password, setPassword] = useState('1234')
  const [displayName, setDisplayName] = useState('네이티브 테스트')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleProviderLogin = async (provider: NativeAuthProvider) => {
    setErrorMessage(null)

    try {
      await beginNativeProviderLogin(provider)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '로그인을 시작하지 못했어요.',
      )
    }
  }

  const handleTestLogin = async () => {
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      await onTestLogin({
        loginId,
        password,
        displayName: displayName.trim() || undefined,
      })
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '로그인하지 못했어요.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>C</Text>
        </View>
        <Text style={styles.logo}>closet</Text>
        <Text style={styles.title}>내 옷장으로 시작하기</Text>
        <Text style={styles.description}>
          로그인하면 옷장과 코디, 플래너 기록을 안전하게 이어서 볼 수 있어요.
        </Text>

        <View style={styles.providerGroup}>
          {Platform.OS === 'ios' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void handleProviderLogin('apple')}
              style={({ pressed }) => [
                styles.providerButton,
                styles.appleButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.appleIcon}></Text>
              <Text style={styles.appleButtonText}>Apple로 계속하기</Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => void handleProviderLogin('google')}
            style={({ pressed }) => [
              styles.providerButton,
              styles.googleButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.googleButtonText}>Google로 계속하기</Text>
          </Pressable>
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>테스트 계정</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.testPanel}>
          <Text style={styles.testPanelTitle}>개발용 빠른 로그인</Text>
          <Text style={styles.testPanelDescription}>
            처음 사용하는 ID는 테스트 계정으로 자동 생성됩니다.
          </Text>

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
            onChangeText={setLoginId}
            placeholder="테스트 ID"
            placeholderTextColor="#918e86"
            style={styles.input}
            value={loginId}
          />
          <TextInput
            autoCapitalize="none"
            maxLength={72}
            onChangeText={setPassword}
            placeholder="비밀번호"
            placeholderTextColor="#918e86"
            secureTextEntry
            style={styles.input}
            value={password}
          />
          <TextInput
            maxLength={30}
            onChangeText={setDisplayName}
            placeholder="표시 이름 (선택)"
            placeholderTextColor="#918e86"
            style={styles.input}
            value={displayName}
          />

          {errorMessage ? (
            <Text accessibilityRole="alert" style={styles.errorMessage}>
              {errorMessage}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => void handleTestLogin()}
            style={({ pressed }) => [
              styles.testLoginButton,
              pressed && styles.pressed,
              isSubmitting && styles.disabled,
            ]}
          >
            <Text style={styles.testLoginButtonText}>
              {isSubmitting ? '로그인 중...' : '테스트 계정으로 로그인'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f0e9',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  brandMark: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#f05a3c',
  },
  brandMarkText: {
    color: '#ffffff',
    fontSize: 25,
    fontWeight: '900',
  },
  logo: {
    marginTop: 18,
    color: '#171714',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  title: {
    marginTop: 8,
    color: '#171714',
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  description: {
    marginTop: 10,
    color: '#6f6c65',
    fontSize: 15,
    lineHeight: 23,
  },
  providerGroup: {
    gap: 10,
    marginTop: 30,
  },
  providerButton: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 15,
  },
  appleButton: {
    backgroundColor: '#171714',
  },
  appleIcon: {
    position: 'absolute',
    left: 18,
    color: '#ffffff',
    fontSize: 22,
  },
  appleButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  googleButton: {
    borderWidth: 1,
    borderColor: '#d8d3c8',
    backgroundColor: '#fffdf9',
  },
  googleIcon: {
    position: 'absolute',
    left: 20,
    color: '#4285f4',
    fontSize: 19,
    fontWeight: '900',
  },
  googleButtonText: {
    color: '#171714',
    fontSize: 15,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 22,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#d8d3c8',
  },
  dividerText: {
    color: '#77736b',
    fontSize: 12,
    fontWeight: '700',
  },
  testPanel: {
    gap: 10,
    borderWidth: 1,
    borderColor: '#ded9cf',
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#fffdf9',
  },
  testPanelTitle: {
    color: '#171714',
    fontSize: 16,
    fontWeight: '800',
  },
  testPanelDescription: {
    marginBottom: 4,
    color: '#77736b',
    fontSize: 12,
    lineHeight: 18,
  },
  input: {
    height: 49,
    borderWidth: 1,
    borderColor: '#d8d3c8',
    borderRadius: 13,
    paddingHorizontal: 14,
    color: '#171714',
    backgroundColor: '#f8f5ee',
    fontSize: 15,
  },
  errorMessage: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#b33b27',
    backgroundColor: '#f05a3c14',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  testLoginButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    marginTop: 2,
    borderRadius: 13,
    backgroundColor: '#f05a3c',
  },
  testLoginButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.55,
  },
})
