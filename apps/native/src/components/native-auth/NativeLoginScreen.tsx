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
import { WearroomWordmark } from '../branding/WearroomWordmark'
import { WardrobeProgressHero } from '../wardrobe/WardrobeProgressHero'

interface NativeLoginScreenProps {
  isPreparing: boolean
  /** 닫힌 옷장을 화면 중앙에 배치한 첫 프레임이 준비되면 호출한다. */
  onInitialFrameReady?: () => void
  onTestLogin: (input: NativeTestLoginInput) => Promise<void>
}

export function NativeLoginScreen({
  isPreparing,
  onInitialFrameReady,
  onTestLogin,
}: NativeLoginScreenProps) {
  const { height: screenHeight } = useWindowDimensions()
  const viewportRef = useRef<View>(null)
  /** 화면 창 기준 ScrollView의 시작 y좌표. 첫 측정 전에는 정적 스플래시를 유지한다. */
  const [viewportTop, setViewportTop] = useState<number | null>(null)
  /** 첫 닫힌 이미지가 실제로 로드됐는지 확인해 빈 프레임에서 스플래시를 닫지 않는다. */
  const [isClosedImageLoaded, setIsClosedImageLoaded] = useState(false)
  const entrance = useRef(new Animated.Value(0)).current
  /** 준비 중에는 닫힌 상태(0)를 유지하고, 준비 완료 후 문 열림을 1까지 전환한다. */
  const progress = useRef(new Animated.Value(0)).current
  const [loginId, setLoginId] = useState('native_test')
  const [password, setPassword] = useState('1234')
  const [displayName, setDisplayName] = useState('네이티브 테스트')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  /** SafeAreaView 내부 상대 좌표 대신 화면 창의 실제 y좌표를 측정해 옷장 중심을 맞춘다. */
  const handleViewportLayout = () => {
    viewportRef.current?.measureInWindow((_x, y) => setViewportTop(y))
  }

  useEffect(() => {
    if (viewportTop === null || !isClosedImageLoaded) return

    // 이미지와 측정값이 렌더링된 다음 프레임에 정적 스플래시를 닫는다.
    const frame = requestAnimationFrame(() => onInitialFrameReady?.())
    return () => cancelAnimationFrame(frame)
  }, [isClosedImageLoaded, onInitialFrameReady, viewportTop])

  useEffect(() => {
    if (isPreparing) {
      entrance.setValue(0)
      progress.setValue(0)
      return
    }

    const completionAnimation = Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: 900,
        easing: Easing.inOut(Easing.quad),
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
    <View onLayout={handleViewportLayout} ref={viewportRef} style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
                      outputRange: [Math.max(0, screenHeight / 2 - (viewportTop ?? 0) - 126), 0],
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
            <WardrobeProgressHero
              onClosedImageLoad={() => setIsClosedImageLoaded(true)}
              progress={progress}
            />
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
            <WearroomWordmark accessibilityRole="header" width={220} />
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
          <WearroomWordmark width={236} />
          <Text accessibilityLiveRegion="polite" style={styles.loadingCaption}>내 옷장을 준비하는 중</Text>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
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
  loadingCaption: {
    marginTop: 8,
    color: wearroomColors.muted,
    fontSize: 13,
    letterSpacing: -0.2,
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
