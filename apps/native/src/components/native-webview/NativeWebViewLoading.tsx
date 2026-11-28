import type { WebBundleProgressStage } from '../../webBundle/webBundleTypes'
import { getWebBundleLoadingPresentation, WEB_BUNDLE_LOADING_STEPS } from '../../webBundle/webBundleLoadingPresentation'
import { wearroomColors } from '../../theme/wearroomTheme'
import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { WearroomWordmark } from '../branding/WearroomWordmark'
import { WardrobeLoadingAnimation } from '../wardrobe/WardrobeLoadingAnimation'
import { WARDROBE_HERO_SIZE, WardrobeProgressHero } from '../wardrobe/WardrobeProgressHero'
import { getWardrobeSplashOffset } from '../wardrobe/wardrobeSplashLayout'

const SLOW_LOADING_MESSAGE_DELAY_MS = 5_000

interface NativeWebViewLoadingProps {
  visible: boolean
  canOpenWardrobe: boolean
  onInitialFrameReady: () => void
  stage?: WebBundleProgressStage
  showUpdateSteps?: boolean
  error?: string | null
  onRetry?: () => void
}

/**
 * 앱 시작 화면과 같은 위치에서 옷장의 문을 열고 WebView 준비 안내를 표시한다.
 * 오류가 있으면 움직임을 멈추고 설명·재시도 버튼을 표시한다. 로딩 완료와 다시 불러오기는 부모에 맡긴다.
 */
export function NativeWebViewLoading({
  visible,
  canOpenWardrobe,
  onInitialFrameReady,
  stage = 'preparing',
  showUpdateSteps = false,
  error,
  onRetry,
}: NativeWebViewLoadingProps) {
  const { height: screenHeight } = useWindowDimensions()
  const viewportRef = useRef<View>(null)
  const [viewportTop, setViewportTop] = useState<number | null>(null)
  const [isClosedImageLoaded, setIsClosedImageLoaded] = useState(false)
  const progress = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(1)).current
  const [isPresented, setIsPresented] = useState(true)
  const [isTakingLonger, setIsTakingLonger] = useState(false)
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    let changed = false
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      changed = true
      setReduceMotion(enabled)
    })
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active && !changed) setReduceMotion(enabled)
    }).catch(() => {})
    return () => { active = false; subscription.remove() }
  }, [])

  // 로그인 직후에도 화면 좌표와 닫힌 이미지가 그려진 프레임까지 런치 화면을 유지한다.
  useEffect(() => {
    if (canOpenWardrobe || viewportTop === null || (!isClosedImageLoaded && !error)) return
    const frame = requestAnimationFrame(onInitialFrameReady)
    return () => cancelAnimationFrame(frame)
  }, [canOpenWardrobe, error, isClosedImageLoaded, onInitialFrameReady, viewportTop])

  useEffect(() => {
    if (!canOpenWardrobe || reduceMotion === null || viewportTop === null) return
    if (reduceMotion || error) { progress.setValue(1); return }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    })
    animation.start()
    return () => animation.stop()
  }, [canOpenWardrobe, error, progress, reduceMotion, viewportTop])

  useEffect(() => {
    if (visible) {
      opacity.setValue(1)
      setIsPresented(true)
      return
    }
    if (reduceMotion !== false) { setIsPresented(false); return }
    const animation = Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true })
    animation.start(({ finished }) => { if (finished) setIsPresented(false) })
    return () => animation.stop()
  }, [opacity, reduceMotion, visible])

  useEffect(() => {
    if (!visible || error) {
      setIsTakingLonger(false)
      return
    }
    const timer = setTimeout(() => setIsTakingLonger(true), SLOW_LOADING_MESSAGE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [error, visible])

  if (!visible && !isPresented) return null
  const presentation = getWebBundleLoadingPresentation(stage)
  const message = isTakingLonger && stage !== 'rollback' ? '옷장을 정리하고 있어요. 잠시만요!' : presentation.message
  const hasSteps = !error && showUpdateSteps && presentation.step !== null
  return (
    <Animated.View accessibilityViewIsModal={visible} style={[styles.container, { opacity }]}>
      <View
        ref={viewportRef}
        collapsable={false}
        onLayout={() => viewportRef.current?.measureInWindow((_x, y) => setViewportTop(y))}
        style={styles.viewport}
      >
        <View style={!error && [styles.hero, viewportTop !== null && {
          top: getWardrobeSplashOffset(screenHeight, viewportTop, WARDROBE_HERO_SIZE / 2),
        }]}>
          {error
            ? <WardrobeLoadingAnimation isAnimating={false} />
            : <WardrobeProgressHero progress={progress} onClosedImageLoad={() => setIsClosedImageLoaded(true)} />}
        </View>
        <View style={error ? styles.errorStatus : styles.status}>
          <WearroomWordmark width={236} />
          <Text accessibilityRole={error ? 'alert' : 'text'} accessibilityLiveRegion="polite" style={styles.title}>
            {error ? '화면을 불러오지 못했어요' : message}
          </Text>
          {!error ? (
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="옷장 업데이트"
              accessibilityValue={{ text: message }}
              accessibilityElementsHidden={!hasSteps}
              importantForAccessibility={hasSteps ? 'auto' : 'no-hide-descendants'}
              style={[styles.steps, !hasSteps && styles.hiddenSteps]}
            >
              {WEB_BUNDLE_LOADING_STEPS.map((label, index) => (
                <View key={label} style={styles.step} accessible={false}>
                  <View style={[styles.stepBar, index <= (presentation.step ?? -1) && styles.stepBarActive]} />
                  <Text style={[styles.stepLabel, index === presentation.step && styles.stepLabelActive]}>{label}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {error ? <Text style={styles.description}>{error}</Text> : null}
          {error && onRetry ? (
            <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
              <Text style={styles.retryText}>다시 시도</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: wearroomColors.canvas,
  },
  viewport: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: { position: 'absolute' },
  status: { position: 'absolute', right: 24, bottom: 64, left: 24, alignItems: 'center' },
  errorStatus: { marginTop: 24, paddingHorizontal: 24, alignItems: 'center' },
  hiddenSteps: { opacity: 0 },
  steps: { position: 'absolute', top: '100%', flexDirection: 'row', width: '100%', maxWidth: 280, gap: 8, marginTop: 14 },
  step: { flex: 1, alignItems: 'center', gap: 8 },
  stepBar: { width: '100%', height: 3, borderRadius: 2, backgroundColor: wearroomColors.line },
  stepBarActive: { backgroundColor: wearroomColors.accent },
  stepLabel: { fontSize: 11, color: wearroomColors.muted },
  stepLabelActive: { color: wearroomColors.accent, fontWeight: '600' },
  title: {
    marginTop: 8,
    color: wearroomColors.muted,
    fontSize: 13,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  description: {
    marginTop: 12,
    color: wearroomColors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  retry: {
    marginTop: 20,
    overflow: 'hidden',
    borderRadius: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: wearroomColors.accent,
  },
  retryText: {
    color: wearroomColors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
})
