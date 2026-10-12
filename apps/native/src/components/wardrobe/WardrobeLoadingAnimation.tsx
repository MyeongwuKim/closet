import { useState } from 'react'
import { Animated, Image, StyleSheet, View } from 'react-native'
import { wearroomColors } from '../../theme/wearroomTheme'
import { WARDROBE_HERO_SIZE } from './WardrobeProgressHero'
import { useWardrobeLoadingMotion } from './useWardrobeLoadingMotion'

const OPEN_WARDROBE_IMAGE = require('../../../assets/wardrobe-open-matched.png')

// 열린 PNG의 280pt 캔버스 좌표. 몸통·문·다리는 원본 그대로 두고 내부 요소만 움직인다.
const HANGER_REGION = { left: 86, top: 92, width: 111, height: 80 }
const SPARKLE_REGION = { left: 170, top: 97, width: 35, height: 36 }

interface ImageRegion {
  left: number
  top: number
  width: number
  height: number
}

// 옷걸이 오른쪽 위의 반짝이를 함께 잘라 움직이지 않도록 옷걸이 영역을 두 조각으로 표시한다.
const HANGER_SLICES: ImageRegion[] = [
  { left: 86, top: 92, width: 84, height: 80 },
  { left: 170, top: 133, width: 27, height: 39 },
]
const ALL_SLICES_LOADED = (1 << (HANGER_SLICES.length + 1)) - 1

interface WardrobeLoadingAnimationProps {
  /** 이미지 전체 크기(pt). 화면 중앙 로딩은 기본 200, 작은 영역에서는 호출자가 줄일 수 있다. */
  size?: number
  /** false이면 열린 옷장과 옷걸이를 정지 상태로 표시한다. */
  isAnimating?: boolean
}

/**
 * 로그인 후 로딩 화면에 완성된 열린 옷장 이미지 한 장을 표시한다.
 * 옷걸이·반짝이 조각이 모두 로드된 뒤에만 옷걸이 영역을 덮고 움직여, 몸통과 장식이 따로 나타나지 않게 한다.
 * 기기의 동작 줄이기 설정에서는 움직임을 멈춘다. 안내와 로딩·오류 전환은 사용하는 화면이 담당한다.
 */
export function WardrobeLoadingAnimation({
  size = 200,
  isAnimating = true,
}: WardrobeLoadingAnimationProps) {
  const [isBaseLoaded, setIsBaseLoaded] = useState(false)
  const [loadedSliceMask, setLoadedSliceMask] = useState(0)
  const overlayReady = isBaseLoaded && loadedSliceMask === ALL_SLICES_LOADED
  const { sway, sparkle } = useWardrobeLoadingMotion(isAnimating && overlayReady)

  return (
    <View
      accessible
      accessibilityLabel="열린 우드 톤 옷장과 테라코타색 옷걸이"
      style={[styles.stage, { width: size, height: size + 2 }]}
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
        <Image
          onLoad={() => setIsBaseLoaded(true)}
          source={OPEN_WARDROBE_IMAGE}
          resizeMode="contain"
          style={styles.sourceImage}
        />
        <View pointerEvents="none" style={[styles.overlayCanvas, { opacity: overlayReady ? 1 : 0 }]}>
          {HANGER_SLICES.map((region) => (
            <View key={region.left} style={[styles.interiorCover, region]} />
          ))}

          <Animated.View
            style={[
              styles.hanger,
              HANGER_REGION,
              {
                transform: [{
                  rotate: sway.interpolate({ inputRange: [-1, 1], outputRange: ['-2.5deg', '2.5deg'] }),
                }],
              },
            ]}
          >
            {HANGER_SLICES.map((region, index) => (
              <WardrobeArtworkSlice
                key={region.left}
                region={region}
                originLeft={HANGER_REGION.left}
                originTop={HANGER_REGION.top}
                onLoad={() => setLoadedSliceMask((mask) => mask | (1 << index))}
              />
            ))}
          </Animated.View>

          <Animated.View
            style={[
              styles.sparkle,
              SPARKLE_REGION,
              { opacity: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
            ]}
          >
            <WardrobeArtworkSlice
              region={SPARKLE_REGION}
              originLeft={SPARKLE_REGION.left}
              originTop={SPARKLE_REGION.top}
              onLoad={() => setLoadedSliceMask((mask) => mask | (1 << HANGER_SLICES.length))}
            />
          </Animated.View>
        </View>
      </View>
      <View style={[styles.shadow, { width: size * 0.42 }]} />
    </View>
  )
}

/** 원본의 region 영역을 부모 원점에 맞춰 배치한다. 옷걸이·반짝이의 모양과 질감은 다시 그리지 않는다. */
function WardrobeArtworkSlice({
  region,
  originLeft,
  originTop,
  onLoad,
}: {
  region: ImageRegion
  originLeft: number
  originTop: number
  onLoad: () => void
}) {
  return (
    <View
      style={[
        styles.imageClip,
        {
          left: region.left - originLeft,
          top: region.top - originTop,
          width: region.width,
          height: region.height,
        },
      ]}
    >
      <Image
        onLoad={onLoad}
        source={OPEN_WARDROBE_IMAGE}
        resizeMode="contain"
        style={[styles.sourceImage, { left: -region.left, top: -region.top }]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
  },
  canvas: {
    position: 'absolute',
    width: WARDROBE_HERO_SIZE,
    height: WARDROBE_HERO_SIZE,
  },
  sourceImage: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: WARDROBE_HERO_SIZE,
    height: WARDROBE_HERO_SIZE,
  },
  overlayCanvas: {
    position: 'absolute',
    width: WARDROBE_HERO_SIZE,
    height: WARDROBE_HERO_SIZE,
  },
  interiorCover: {
    position: 'absolute',
    backgroundColor: wearroomColors.canvas,
  },
  hanger: {
    position: 'absolute',
    transformOrigin: '50% 0%',
  },
  sparkle: {
    position: 'absolute',
  },
  imageClip: {
    position: 'absolute',
    overflow: 'hidden',
  },
  shadow: {
    position: 'absolute',
    bottom: 0,
    height: 4,
    borderRadius: 50,
    opacity: 0.18,
    backgroundColor: wearroomColors.wood,
  },
})
