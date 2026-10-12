import { Image, StyleSheet, View } from 'react-native'
import type { AccessibilityRole } from 'react-native'

const WORDMARK_IMAGE = require('../../../assets/wearroom-wordmark.png')

// 생성 이미지의 투명 여백을 화면에서 잘라 글자 높이가 표시 크기에 맞게 유지되도록 한다.
const SOURCE_WIDTH = 2172
const SOURCE_HEIGHT = 724
const CROP_LEFT = 36
const CROP_TOP = 243
const CROP_WIDTH = 2074
const CROP_HEIGHT = 263

interface WearroomWordmarkProps {
  /** 투명 여백을 제외한 워드마크가 차지할 가로 크기(pt). */
  width?: number
  /** 로그인 제목으로 사용할 때는 header로 전달한다. */
  accessibilityRole?: AccessibilityRole
}

/**
 * 두 r 사이의 옷걸이 봉을 포함한 wearroom. 이미지 워드마크를 표시한다.
 * 원본 PNG의 투명 여백만 뷰포트에서 가리고 같은 이미지 비율로 크기를 조절한다.
 */
export function WearroomWordmark({
  width = 220,
  accessibilityRole = 'image',
}: WearroomWordmarkProps) {
  const scale = width / CROP_WIDTH

  return (
    <View
      accessible
      accessibilityLabel="wearroom"
      accessibilityRole={accessibilityRole}
      style={[styles.viewport, { width, height: CROP_HEIGHT * scale }]}
    >
      <Image
        accessible={false}
        resizeMode="stretch"
        source={WORDMARK_IMAGE}
        style={[
          styles.image,
          {
            width: SOURCE_WIDTH * scale,
            height: SOURCE_HEIGHT * scale,
            left: -CROP_LEFT * scale,
            top: -CROP_TOP * scale,
          },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  viewport: {
    alignSelf: 'center',
    overflow: 'hidden',
  },
  image: {
    position: 'absolute',
  },
})
