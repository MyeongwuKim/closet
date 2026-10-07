/**
 * 진입 경로: 앱 실행 → 로그인 필요
 *
 * 용도:
 * 소셜 로그인 또는 개발용 테스트 계정으로 앱을 시작한다.
 *
 * 구조:
 * 스플래시와 이어지는 옷장 이미지, 브랜드와 어디서든 여는 내 작은 옷장 슬로건, 소셜 로그인, 테스트 로그인으로 구성되어 있다.
 */
import { wearroomColors } from '../../theme/wearroomTheme'
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
      progress.setValue(0)
      return
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

  /** 선택한 소셜 서비스의 인증을 시작한다. 시작에 실패하면 화면에 오류를 표시한다. */
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

  /** 입력한 테스트 계정으로 로그인을 요청하고 완료 여부와 오류를 표시한다. 계정 저장은 onTestLogin에 맡긴다. */
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
          <Text accessibilityRole="header" style={styles.brand}>wearroom<Text style={styles.brandDot}>.</Text></Text>
          <Text style={styles.tagline}>어디서든 여는 내 작은 옷장</Text>

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
              placeholderTextColor={wearroomColors.muted}
              style={styles.input}
              value={loginId}
            />
            <TextInput
              autoCapitalize="none"
              maxLength={72}
              onChangeText={setPassword}
              placeholder="비밀번호"
              placeholderTextColor={wearroomColors.muted}
              secureTextEntry
              style={styles.input}
              value={password}
            />
            <TextInput
              maxLength={30}
              onChangeText={setDisplayName}
              placeholder="표시 이름 (선택)"
              placeholderTextColor={wearroomColors.muted}
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
        <Text style={styles.loadingLogo}>웨어룸</Text>
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
    backgroundColor: wearroomColors.canvas,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
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
    maxWidth: 440,
    alignSelf: 'center',
    borderWidth: 5,
    borderColor: wearroomColors.wood,
    borderRadius: 18,
    padding: 18,
    backgroundColor: wearroomColors.surface,
  },
  loadingStatus: {
    position: 'absolute',
    right: 0,
    bottom: 64,
    left: 0,
    alignItems: 'center',
  },
  loadingLogo: {
    color: wearroomColors.ink,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.8,
  },
  progressTrack: {
    overflow: 'hidden',
    width: 132,
    height: 5,
    marginTop: 16,
    borderRadius: 3,
    backgroundColor: wearroomColors.line,
  },
  progressFill: {
    width: 132,
    height: 5,
    borderRadius: 3,
    backgroundColor: wearroomColors.accent,
  },
  brand: {
    color: wearroomColors.ink,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 24,
    letterSpacing: -1,
    textAlign: 'center',
  },
  brandDot: {
    color: wearroomColors.accent,
  },
  tagline: {
    marginTop: 12,
    color: wearroomColors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
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
    borderRadius: 16,
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
    borderColor: wearroomColors.line,
    backgroundColor: wearroomColors.surface,
  },
  googleIcon: {
    position: 'absolute',
    left: 20,
    color: '#4285f4',
    fontSize: 19,
    fontWeight: '900',
  },
  googleButtonText: {
    color: wearroomColors.ink,
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
    backgroundColor: wearroomColors.line,
  },
  dividerText: {
    color: wearroomColors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  testPanel: {
    gap: 10,
    borderWidth: 1,
    borderColor: wearroomColors.line,
    borderRadius: 22,
    padding: 18,
    backgroundColor: wearroomColors.surface,
  },
  testPanelTitle: {
    color: wearroomColors.ink,
    fontSize: 16,
    fontWeight: '600',
  },
  testPanelDescription: {
    marginBottom: 4,
    color: wearroomColors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: wearroomColors.line,
    borderRadius: 13,
    paddingHorizontal: 14,
    color: wearroomColors.ink,
    backgroundColor: wearroomColors.canvas,
    fontSize: 16,
  },
  errorMessage: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: wearroomColors.danger,
    backgroundColor: wearroomColors.dangerSoft,
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
    backgroundColor: wearroomColors.accent,
  },
  testLoginButtonText: {
    color: wearroomColors.surface,
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
