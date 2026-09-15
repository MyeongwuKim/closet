/**
 * 진입 경로: 앱 실행 → 로그인 필요
 *
 * 용도:
 * 소셜 로그인 또는 개발용 테스트 계정으로 앱을 시작한다.
 *
 * 구조:
 * 스플래시와 이어지는 옷장 이미지, 로그인 안내, 소셜 로그인, 테스트 로그인으로 구성되어 있다.
 */
import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { beginNativeProviderLogin } from '../../auth/nativeProviderAuth'
import type {
  NativeAuthProvider,
  NativeTestLoginInput,
} from '../../auth/nativeAuthTypes'
import { WardrobeProgressHero } from './WardrobeProgressHero'

interface NativeLoginScreenProps {
  isPreparing: boolean
  onTestLogin: (input: NativeTestLoginInput) => Promise<void>
}

export function NativeLoginScreen({
  isPreparing,
  onTestLogin,
}: NativeLoginScreenProps) {
  const { height: screenHeight } = useWindowDimensions()
  const [viewportHeight, setViewportHeight] = useState(screenHeight)
  const entrance = useRef(new Animated.Value(0)).current
  const progress = useRef(new Animated.Value(0)).current
  const [loginId, setLoginId] = useState('native_test')
  const [password, setPassword] = useState('1234')
  const [displayName, setDisplayName] = useState('네이티브 테스트')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isPreparing) {
      entrance.setValue(0)
      const loadingAnimation = Animated.sequence([
        Animated.timing(progress, {
          toValue: 0.72,
          duration: 1050,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(progress, {
              toValue: 0.82,
              duration: 460,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(progress, {
              toValue: 0.7,
              duration: 460,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ),
      ])

      loadingAnimation.start()
      return () => loadingAnimation.stop()
    }

    const completionAnimation = Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.back(1.45)),
        useNativeDriver: true,
      }),
      Animated.delay(180),
      Animated.timing(entrance, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ])

    completionAnimation.start()
    return () => completionAnimation.stop()
  }, [entrance, isPreparing, progress])

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
      onLayout={({ nativeEvent }) => setViewportHeight(nativeEvent.layout.height)}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          pointerEvents={isPreparing ? 'none' : 'auto'}
          style={[
            styles.hero,
            {
              transform: [
                {
                  translateY: entrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [Math.max(0, viewportHeight / 2 - 118), 0],
                  }),
                },
                {
                  scale: entrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0.62],
                  }),
                },
              ],
            },
          ]}
        >
          <WardrobeProgressHero progress={progress} />
        </Animated.View>

        <Animated.View
          pointerEvents={isPreparing ? 'none' : 'auto'}
          style={[
            styles.loginContent,
            {
              opacity: entrance.interpolate({
                inputRange: [0, 0.42, 1],
                outputRange: [0, 0, 1],
              }),
              transform: [
                {
                  translateY: entrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.logo}>closet</Text>
          <Text style={styles.tagline}>나만의 옷장</Text>

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
        </Animated.View>
      </ScrollView>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.loadingStatus,
          {
            opacity: entrance.interpolate({
              inputRange: [0, 0.34],
              outputRange: [1, 0],
              extrapolate: 'clamp',
            }),
          },
        ]}
      >
        <Text style={styles.loadingLogo}>closet</Text>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                transform: [
                  {
                    translateX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-132, 0],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
      </Animated.View>
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
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  hero: {
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 220,
  },
  loginContent: {
    width: '100%',
  },
  loadingStatus: {
    position: 'absolute',
    right: 0,
    bottom: 64,
    left: 0,
    alignItems: 'center',
  },
  loadingLogo: {
    color: '#171714',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  progressTrack: {
    overflow: 'hidden',
    width: 132,
    height: 5,
    marginTop: 16,
    borderRadius: 3,
    backgroundColor: '#d8d3c8',
  },
  progressFill: {
    width: 132,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#f05a3c',
  },
  logo: {
    color: '#171714',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1.1,
    textAlign: 'center',
  },
  tagline: {
    marginTop: 6,
    color: '#6f6c65',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  providerGroup: {
    gap: 10,
    marginTop: 26,
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
