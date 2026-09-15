/**
 * 사용 위치: 앱 시작 로딩, 로그인 진입, 추후 패치 다운로드 화면
 *
 * 용도:
 * 전달받은 진행률에 맞춰 닫힌 옷장 문을 열고 내부 옷과 반짝이를 보여준다.
 *
 * 동작 방식:
 * 정적 스플래시와 같은 닫힌 이미지를 첫 프레임으로 사용한 뒤
 * 문, 옷, 완료 효과를 각각의 진행 구간에 맞춰 애니메이션한다.
 */
import { Animated, StyleSheet, Text, View } from 'react-native'

export const WARDROBE_HERO_SIZE = 280

const CLOSED_WARDROBE_IMAGE = require('../../../assets/splash-wardrobe-closed-transparent.png')
const OPEN_WARDROBE_IMAGE = require('../../../assets/wardrobe-open-transparent.png')

interface WardrobeProgressHeroProps {
  progress: Animated.Value
  size?: number
}

export function WardrobeProgressHero({
  progress,
  size = WARDROBE_HERO_SIZE,
}: WardrobeProgressHeroProps) {
  const scale = size / WARDROBE_HERO_SIZE
  const doorScale = progress.interpolate({
    inputRange: [0.08, 0.78],
    outputRange: [1, 0.16],
    extrapolate: 'clamp',
  })
  const leftDoorOffset = progress.interpolate({
    inputRange: [0.08, 0.78],
    outputRange: [0, -36],
    extrapolate: 'clamp',
  })
  const rightDoorOffset = progress.interpolate({
    inputRange: [0.08, 0.78],
    outputRange: [0, 36],
    extrapolate: 'clamp',
  })
  const contentsOpacity = progress.interpolate({
    inputRange: [0.3, 0.62],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  })
  const contentsScale = progress.interpolate({
    inputRange: [0.55, 0.88, 1],
    outputRange: [0.72, 1.08, 1],
    extrapolate: 'clamp',
  })
  const sparkleScale = progress.interpolate({
    inputRange: [0.82, 0.93, 1],
    outputRange: [0, 1.25, 1],
    extrapolate: 'clamp',
  })
  const generatedFrameOpacity = progress.interpolate({
    inputRange: [0, 0.1, 0.66, 0.9],
    outputRange: [0, 1, 1, 0],
    extrapolate: 'clamp',
  })
  const splashFrameOpacity = progress.interpolate({
    inputRange: [0, 0.12],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  })
  const openFrameOpacity = progress.interpolate({
    inputRange: [0.58, 0.88],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  })
  const openFrameScale = progress.interpolate({
    inputRange: [0.62, 0.9, 1],
    outputRange: [0.78, 1.06, 1],
    extrapolate: 'clamp',
  })

  return (
    <View style={[styles.viewport, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.scaledCanvas,
          {
            top: (size - WARDROBE_HERO_SIZE) / 2,
            left: (size - WARDROBE_HERO_SIZE) / 2,
            opacity: generatedFrameOpacity,
            transform: [{ scale }],
          },
        ]}
      >
        <View style={styles.wardrobeBody}>
          <View style={styles.interior}>
            <View style={styles.rail} />
            <Animated.View
              style={[
                styles.wardrobeContents,
                {
                  opacity: contentsOpacity,
                  transform: [{ scale: contentsScale }],
                },
              ]}
            >
              <View style={styles.hangingGroup}>
                <View style={[styles.hangingItem, styles.warmWhiteItem]} />
                <View style={[styles.hangingItem, styles.sageItem]} />
                <View style={[styles.hangingItem, styles.coralItem]} />
              </View>

              <View style={styles.shelfGroup}>
                <View style={[styles.foldedItem, styles.warmWhiteItem]} />
                <View style={[styles.foldedItem, styles.sageItem]} />
                <View style={[styles.foldedItem, styles.coralItem]} />
              </View>
            </Animated.View>
          </View>

          <Animated.View
            style={[
              styles.door,
              styles.leftDoor,
              {
                transform: [
                  { translateX: leftDoorOffset },
                  { scaleX: doorScale },
                ],
              },
            ]}
          >
            <View style={[styles.handle, styles.leftHandle]} />
          </Animated.View>
          <Animated.View
            style={[
              styles.door,
              styles.rightDoor,
              {
                transform: [
                  { translateX: rightDoorOffset },
                  { scaleX: doorScale },
                ],
              },
            ]}
          >
            <View style={[styles.handle, styles.rightHandle]} />
          </Animated.View>
        </View>

        <View style={[styles.foot, styles.leftFoot]} />
        <View style={[styles.foot, styles.rightFoot]} />

        <Animated.View
          style={[
            styles.sparkle,
            styles.leftSparkle,
            { transform: [{ scale: sparkleScale }] },
          ]}
        >
          <Text style={styles.sparkleText}>✦</Text>
        </Animated.View>
        <Animated.View
          style={[
            styles.sparkle,
            styles.rightSparkle,
            { transform: [{ scale: sparkleScale }] },
          ]}
        >
          <Text style={styles.sparkleText}>✦</Text>
        </Animated.View>
      </Animated.View>

      <Animated.Image
        accessibilityLabel="문이 닫힌 옷장"
        resizeMode="contain"
        source={CLOSED_WARDROBE_IMAGE}
        style={[
          styles.splashFrame,
          { width: size, height: size, opacity: splashFrameOpacity },
        ]}
      />
      <Animated.Image
        accessibilityLabel="양쪽 문이 열리고 코랄색 옷걸이가 나타난 옷장"
        resizeMode="contain"
        source={OPEN_WARDROBE_IMAGE}
        style={[
          styles.openFrame,
          {
            width: size,
            height: size,
            opacity: openFrameOpacity,
            transform: [{ scale: openFrameScale }],
          },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  viewport: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaledCanvas: {
    position: 'absolute',
    width: WARDROBE_HERO_SIZE,
    height: WARDROBE_HERO_SIZE,
  },
  wardrobeBody: {
    position: 'absolute',
    top: 45,
    left: 47,
    width: 186,
    height: 186,
    borderWidth: 5,
    borderColor: '#1b2118',
    borderRadius: 10,
    backgroundColor: '#dfe6d2',
  },
  interior: {
    position: 'absolute',
    top: 9,
    right: 9,
    bottom: 14,
    left: 9,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#1b2118',
    backgroundColor: '#f7f4ec',
  },
  rail: {
    position: 'absolute',
    top: 25,
    left: 13,
    width: 86,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1b2118',
  },
  wardrobeContents: {
    ...StyleSheet.absoluteFillObject,
  },
  hangingGroup: {
    position: 'absolute',
    top: 31,
    left: 18,
    flexDirection: 'row',
    gap: 4,
  },
  hangingItem: {
    width: 23,
    height: 84,
    borderWidth: 3,
    borderColor: '#1b2118',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  warmWhiteItem: {
    backgroundColor: '#fffdf8',
  },
  sageItem: {
    backgroundColor: '#bdc8ad',
  },
  coralItem: {
    backgroundColor: '#f05a3c',
  },
  shelfGroup: {
    position: 'absolute',
    right: 13,
    bottom: 16,
    gap: 5,
  },
  foldedItem: {
    width: 43,
    height: 17,
    borderWidth: 3,
    borderColor: '#1b2118',
    borderRadius: 7,
  },
  door: {
    position: 'absolute',
    top: 8,
    bottom: 14,
    width: 82,
    borderWidth: 4,
    borderColor: '#1b2118',
    backgroundColor: '#dfe6d2',
  },
  leftDoor: {
    left: 8,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  rightDoor: {
    right: 8,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  handle: {
    position: 'absolute',
    top: 77,
    width: 11,
    height: 11,
    borderWidth: 3,
    borderColor: '#1b2118',
    borderRadius: 6,
    backgroundColor: '#fffdf8',
  },
  leftHandle: {
    right: 6,
  },
  rightHandle: {
    left: 6,
  },
  foot: {
    position: 'absolute',
    top: 226,
    width: 17,
    height: 22,
    borderWidth: 4,
    borderColor: '#1b2118',
    borderTopWidth: 0,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    backgroundColor: '#dfe6d2',
  },
  leftFoot: {
    left: 60,
    transform: [{ skewX: '-10deg' }],
  },
  rightFoot: {
    right: 60,
    transform: [{ skewX: '10deg' }],
  },
  sparkle: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftSparkle: {
    top: 53,
    left: 27,
  },
  rightSparkle: {
    right: 24,
    bottom: 55,
  },
  sparkleText: {
    color: '#f05a3c',
    fontSize: 28,
    fontWeight: '900',
  },
  splashFrame: {
    position: 'absolute',
  },
  openFrame: {
    position: 'absolute',
  },
})
