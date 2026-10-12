import { Animated, Image, StyleSheet, View } from 'react-native'
import type { ImageSourcePropType } from 'react-native'
import { wearroomColors } from '../../theme/wearroomTheme'

export const WARDROBE_HERO_SIZE = 280

const CLOSED_WARDROBE_IMAGE = require('../../../assets/wardrobe-closed-matched.png')
const OPEN_WARDROBE_IMAGE = require('../../../assets/wardrobe-open-matched.png')

// 두 이미지의 280pt 캔버스에서 문 안쪽만 움직인다. 몸통·서랍·다리는 닫힌 이미지에 고정한다.
const DOOR_TOP = 62
const DOOR_BOTTOM = 192
const DOOR_HEIGHT = DOOR_BOTTOM - DOOR_TOP
const LEFT_DOOR_X = 64
const DOOR_WIDTH = 76
const RIGHT_DOOR_X = LEFT_DOOR_X + DOOR_WIDTH
const INTERIOR_RIGHT = RIGHT_DOOR_X + DOOR_WIDTH
const DOOR_PERSPECTIVE = 600

interface ImageRegion {
  left: number
  top: number
  width: number
  height: number
}

const INTERIOR_REGION: ImageRegion = {
  left: LEFT_DOOR_X,
  top: DOOR_TOP,
  width: DOOR_WIDTH * 2,
  height: DOOR_HEIGHT,
}

const FRAME_REGIONS: ImageRegion[] = [
  { left: 0, top: 0, width: WARDROBE_HERO_SIZE, height: DOOR_TOP },
  { left: 0, top: DOOR_TOP, width: LEFT_DOOR_X, height: DOOR_HEIGHT },
  { left: INTERIOR_RIGHT, top: DOOR_TOP, width: WARDROBE_HERO_SIZE - INTERIOR_RIGHT, height: DOOR_HEIGHT },
  { left: 0, top: DOOR_BOTTOM, width: WARDROBE_HERO_SIZE, height: WARDROBE_HERO_SIZE - DOOR_BOTTOM },
]

// 열린 이미지에서 바깥쪽으로 펼쳐진 문만 자른다. 중앙 몸통과 아래 서랍은 포함하지 않는다.
const LEFT_WING_REGION: ImageRegion = { left: 0, top: 16, width: LEFT_DOOR_X, height: 208 }
const RIGHT_WING_REGION: ImageRegion = {
  left: INTERIOR_RIGHT,
  top: 16,
  width: WARDROBE_HERO_SIZE - INTERIOR_RIGHT,
  height: 208,
}

interface WardrobeProgressHeroProps {
  /** 호출자가 전달한 0~1 진행 값. 0은 닫힌 스플래시, 1은 열린 옷장이다. */
  progress: Animated.Value
  /** 옷장 이미지 전체 캔버스의 가로·세로 크기(pt). */
  size?: number
  /** 첫 닫힌 이미지의 로드가 끝나면 호출한다. 정적 스플래시를 닫는 시점에 사용한다. */
  onClosedImageLoad?: () => void
}

/**
 * 앱 시작 화면에서 같은 옷장의 문이 열리는 모습을 보여준다.
 * 닫힌 이미지의 몸통·서랍·다리를 계속 표시하고, 문 안쪽에는 열린 이미지의 옷걸이와 봉을 드러낸다.
 * 문짝을 바깥 경첩을 축으로 회전시키고 옆면이 보이는 구간에서 열린 이미지의 문 날개로 넘긴다.
 * 진행 값은 호출자가 관리한다.
 */
export function WardrobeProgressHero({
  progress,
  size = WARDROBE_HERO_SIZE,
  onClosedImageLoad,
}: WardrobeProgressHeroProps) {
  // 스플래시와 같은 원본 이미지를 첫 프레임에 그대로 보여주고, 문이 움직이기 전에 조각 이미지로 넘긴다.
  const fullClosedImageOpacity = progress.interpolate({
    inputRange: [0, 0.08],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  })
  const leftDoorRotation = progress.interpolate({
    inputRange: [0.08, 0.52],
    outputRange: ['0deg', '-86deg'],
    extrapolate: 'clamp',
  })
  const rightDoorRotation = progress.interpolate({
    inputRange: [0.08, 0.52],
    outputRange: ['0deg', '86deg'],
    extrapolate: 'clamp',
  })
  const leftWingRotation = progress.interpolate({
    inputRange: [0.52, 0.9],
    outputRange: ['85deg', '0deg'],
    extrapolate: 'clamp',
  })
  const rightWingRotation = progress.interpolate({
    inputRange: [0.52, 0.9],
    outputRange: ['-85deg', '0deg'],
    extrapolate: 'clamp',
  })
  const closedDoorOpacity = progress.interpolate({
    inputRange: [0.48, 0.52],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  })
  const interiorOpacity = progress.interpolate({
    inputRange: [0, 0.08],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  })
  const wingOpacity = progress.interpolate({
    inputRange: [0.52, 0.56],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  })

  return (
    <View
      accessible
      accessibilityLabel="크림색 문이 열리면 테라코타색 옷걸이가 나타나는 우드 톤 옷장"
      style={[styles.viewport, { width: size, height: size }]}
    >
      <View
        style={[
          styles.canvas,
          {
            top: (size - WARDROBE_HERO_SIZE) / 2,
            left: (size - WARDROBE_HERO_SIZE) / 2,
            transform: [{ scale: size / WARDROBE_HERO_SIZE }],
          },
        ]}
      >
        <Animated.View style={[styles.interior, INTERIOR_REGION, { opacity: interiorOpacity }]}>
          <WardrobeArtworkSource
            source={OPEN_WARDROBE_IMAGE}
            left={INTERIOR_REGION.left}
            top={INTERIOR_REGION.top}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.imageClip,
            styles.leftWing,
            LEFT_WING_REGION,
            {
              opacity: wingOpacity,
              transform: [{ perspective: DOOR_PERSPECTIVE }, { rotateY: leftWingRotation }],
            },
          ]}
        >
          <WardrobeArtworkSource
            source={OPEN_WARDROBE_IMAGE}
            left={LEFT_WING_REGION.left}
            top={LEFT_WING_REGION.top}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.imageClip,
            styles.rightWing,
            RIGHT_WING_REGION,
            {
              opacity: wingOpacity,
              transform: [{ perspective: DOOR_PERSPECTIVE }, { rotateY: rightWingRotation }],
            },
          ]}
        >
          <WardrobeArtworkSource
            source={OPEN_WARDROBE_IMAGE}
            left={RIGHT_WING_REGION.left}
            top={RIGHT_WING_REGION.top}
          />
        </Animated.View>

        {FRAME_REGIONS.map((region) => (
          <View key={region.left + '-' + region.top} style={[styles.imageClip, region]}>
            <WardrobeArtworkSource
              source={CLOSED_WARDROBE_IMAGE}
              left={region.left}
              top={region.top}
            />
          </View>
        ))}

        <Animated.View
          style={[
            styles.imageClip,
            styles.door,
            styles.leftDoor,
            {
              left: LEFT_DOOR_X,
              opacity: closedDoorOpacity,
              transform: [{ perspective: DOOR_PERSPECTIVE }, { rotateY: leftDoorRotation }],
            },
          ]}
        >
          <WardrobeArtworkSource source={CLOSED_WARDROBE_IMAGE} left={LEFT_DOOR_X} top={DOOR_TOP} />
        </Animated.View>
        <Animated.View
          style={[
            styles.imageClip,
            styles.door,
            styles.rightDoor,
            {
              left: RIGHT_DOOR_X,
              opacity: closedDoorOpacity,
              transform: [{ perspective: DOOR_PERSPECTIVE }, { rotateY: rightDoorRotation }],
            },
          ]}
        >
          <WardrobeArtworkSource source={CLOSED_WARDROBE_IMAGE} left={RIGHT_DOOR_X} top={DOOR_TOP} />
        </Animated.View>

        <Animated.Image
          onLoad={onClosedImageLoad}
          resizeMode="contain"
          source={CLOSED_WARDROBE_IMAGE}
          style={[styles.sourceImage, { left: 0, top: 0, opacity: fullClosedImageOpacity }]}
        />
      </View>
    </View>
  )
}

/** 원본 PNG를 클리핑 영역의 위치만큼 옮겨 프레임·문·옷장 내부의 해당 부분을 표시한다. */
function WardrobeArtworkSource({
  source,
  left,
  top,
}: {
  source: ImageSourcePropType
  left: number
  top: number
}) {
  return (
    <Image
      resizeMode="contain"
      source={source}
      style={[styles.sourceImage, { left: -left, top: -top }]}
    />
  )
}

const styles = StyleSheet.create({
  viewport: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    position: 'absolute',
    width: WARDROBE_HERO_SIZE,
    height: WARDROBE_HERO_SIZE,
  },
  imageClip: {
    position: 'absolute',
    overflow: 'hidden',
  },
  sourceImage: {
    position: 'absolute',
    width: WARDROBE_HERO_SIZE,
    height: WARDROBE_HERO_SIZE,
  },
  door: {
    top: DOOR_TOP,
    width: DOOR_WIDTH,
    height: DOOR_HEIGHT,
    backfaceVisibility: 'hidden',
  },
  leftDoor: {
    transformOrigin: '0% 50%',
  },
  rightDoor: {
    transformOrigin: '100% 50%',
  },
  interior: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: wearroomColors.canvas,
  },
  leftWing: {
    transformOrigin: '100% 50%',
  },
  rightWing: {
    transformOrigin: '0% 50%',
  },
})
