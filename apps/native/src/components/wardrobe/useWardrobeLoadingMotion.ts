import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing } from 'react-native'

/**
 * 로딩 중 열린 옷장 안의 옷걸이를 작게 흔들고 반짝이의 밝기를 반복해서 바꾼다.
 * 옷장 전체의 크기와 위치는 바꾸지 않는다. 실제 로딩 완료 여부는 호출자가 결정한다.
 * isAnimating이 false이거나 기기의 동작 줄이기가 켜져 있으면 모든 움직임을 멈춘다.
 */
export function useWardrobeLoadingMotion(isAnimating: boolean) {
  /** -1~1은 옷걸이 좌우 흔들림, 0은 원래 각도다. */
  const sway = useRef(new Animated.Value(0)).current
  /** 반짝이 밝기 보간 값. 1은 원래 밝기이며 정지 상태에서도 유지한다. */
  const sparkle = useRef(new Animated.Value(1)).current
  // 기기 설정을 확인하기 전에는 움직임을 시작하지 않는다.
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null)

  useEffect(() => {
    let isActive = true
    let hasReceivedChange = false
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      hasReceivedChange = true
      setReduceMotion(enabled)
    })
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (isActive && !hasReceivedChange) setReduceMotion(enabled)
    }).catch(() => {
      // 설정을 읽지 못하면 정지된 열린 옷장을 유지한다.
    })

    return () => {
      isActive = false
      subscription.remove()
    }
  }, [])

  useEffect(() => {
    sway.setValue(0)
    sparkle.setValue(1)
    if (!isAnimating || reduceMotion !== false) return

    const timingOptions = {
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: true,
      isInteraction: false,
    }
    const hanger = Animated.loop(Animated.sequence([
      Animated.timing(sway, { ...timingOptions, toValue: 1, duration: 900 }),
      Animated.timing(sway, { ...timingOptions, toValue: -1, duration: 1800 }),
      Animated.timing(sway, { ...timingOptions, toValue: 0, duration: 900 }),
    ]))
    const twinkle = Animated.loop(Animated.sequence([
      Animated.timing(sparkle, { ...timingOptions, toValue: 0, duration: 1000 }),
      Animated.timing(sparkle, { ...timingOptions, toValue: 1, duration: 1000 }),
    ]))

    hanger.start()
    twinkle.start()
    return () => {
      hanger.stop()
      twinkle.stop()
    }
  }, [isAnimating, sparkle, sway, reduceMotion])

  return { sway, sparkle }
}
