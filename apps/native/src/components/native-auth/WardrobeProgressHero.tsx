/**
 * 사용 위치: 앱 시작 로딩, 로그인 진입
 *
 * 용도:
 * 전달받은 진행률에 맞춰 닫힌 옷장 문을 열고 내부 옷과 반짝이를 보여준다.
 *
 * 동작 방식:
 * 크림색 문과 원목 프레임을 직접 그린 뒤 문, 옷, 완료 효과를 진행 구간에 맞춰 움직인다.
 * 색상은 웹과 같은 테마를 사용하며 별도 이미지의 색에 의존하지 않는다.
 */
import { wearroomColors } from '../../theme/wearroomTheme'
import { Animated, StyleSheet, Text, View } from 'react-native'

export const WARDROBE_HERO_SIZE = 280

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
  return (
    <View accessible accessibilityLabel="크림색 문과 원목 프레임의 작은 옷장" style={[styles.viewport, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.scaledCanvas,
          {
            top: (size - WARDROBE_HERO_SIZE) / 2,
            left: (size - WARDROBE_HERO_SIZE) / 2,
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
                <View style={[styles.hangingItem, styles.accentItem]} />
              </View>

              <View style={styles.shelfGroup}>
                <View style={[styles.foldedItem, styles.warmWhiteItem]} />
                <View style={[styles.foldedItem, styles.sageItem]} />
                <View style={[styles.foldedItem, styles.accentItem]} />
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
    borderColor: wearroomColors.wood,
    borderRadius: 7,
    backgroundColor: wearroomColors.sage,
  },
  interior: {
    position: 'absolute',
    top: 9,
    right: 9,
    bottom: 14,
    left: 9,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: wearroomColors.line,
    backgroundColor: wearroomColors.sage,
  },
  rail: {
    position: 'absolute',
    top: 25,
    left: 13,
    width: 86,
    height: 4,
    borderRadius: 2,
    backgroundColor: wearroomColors.ink,
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
    borderWidth: 1,
    borderColor: wearroomColors.accent,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  warmWhiteItem: {
    backgroundColor: wearroomColors.surface,
  },
  sageItem: {
    backgroundColor: wearroomColors.sageDeep,
  },
  accentItem: {
    backgroundColor: wearroomColors.accent,
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
    borderWidth: 1,
    borderColor: wearroomColors.accent,
    borderRadius: 7,
  },
  door: {
    position: 'absolute',
    top: 8,
    bottom: 14,
    width: 82,
    borderWidth: 1,
    borderColor: wearroomColors.line,
    backgroundColor: wearroomColors.canvas,
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
    borderWidth: 1,
    borderColor: wearroomColors.accent,
    borderRadius: 6,
    backgroundColor: wearroomColors.wood,
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
    borderWidth: 1,
    borderColor: wearroomColors.wood,
    borderTopWidth: 0,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    backgroundColor: wearroomColors.sage,
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
    color: wearroomColors.accent,
    fontSize: 28,
    fontWeight: '900',
  },
})
