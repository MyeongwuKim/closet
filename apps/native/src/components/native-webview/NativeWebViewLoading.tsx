import { wearroomColors } from '../../theme/wearroomTheme'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

interface NativeWebViewLoadingProps {
  error?: string | null
  onRetry?: () => void
}

/** WebView 로딩 중에는 준비 안내를, 실패하면 오류와 재시도 버튼을 표시한다. 다시 불러오기는 부모에 맡긴다. */
export function NativeWebViewLoading({
  error,
  onRetry,
}: NativeWebViewLoadingProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>wearroom.</Text>
      {error ? null : <ActivityIndicator color={wearroomColors.accent} size="large" />}
      <Text style={styles.title}>
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
    gap: 12,
    paddingHorizontal: 32,
    backgroundColor: wearroomColors.canvas,
  },
  title: {
    color: wearroomColors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  description: {
    color: wearroomColors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  retry: {
    marginTop: 8,
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
    color: wearroomColors.accent,
    fontSize: 24,
    letterSpacing: -0.8,
    marginBottom: 16,
  },
})
