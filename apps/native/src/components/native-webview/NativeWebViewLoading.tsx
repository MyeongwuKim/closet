import { wearroomColors } from '../../theme/wearroomTheme'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { WearroomWordmark } from '../branding/WearroomWordmark'
import { WardrobeLoadingAnimation } from '../wardrobe/WardrobeLoadingAnimation'

interface NativeWebViewLoadingProps {
  error?: string | null
  onRetry?: () => void
}

/**
 * 로그인 후 WebView를 기다리는 동안 고정된 옷장 안의 옷걸이·반짝이 애니메이션과 준비 안내를 표시한다.
 * 오류가 있으면 움직임을 멈추고 설명·재시도 버튼을 표시한다. 로딩 완료와 다시 불러오기는 부모에 맡긴다.
 */
export function NativeWebViewLoading({
  error,
  onRetry,
}: NativeWebViewLoadingProps) {
  return (
    <View style={styles.container}>
      <WardrobeLoadingAnimation isAnimating={!error} />
      <View style={styles.brand}>
        <WearroomWordmark width={220} />
      </View>
      <Text accessibilityRole={error ? 'alert' : 'text'} accessibilityLiveRegion="polite" style={styles.title}>
        {error ? '화면을 불러오지 못했어요' : '옷장을 준비하고 있어요'}
      </Text>
      {error ? <Text style={styles.description}>{error}</Text> : null}
      {error && onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
          <Text style={styles.retryText}>다시 시도</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: wearroomColors.canvas,
  },
  title: {
    marginTop: 12,
    color: wearroomColors.muted,
    fontSize: 14,
    lineHeight: 21,
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
  brand: {
    marginTop: 24,
  },
})
