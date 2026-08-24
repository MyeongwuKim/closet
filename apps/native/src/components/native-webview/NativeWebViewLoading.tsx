import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

interface NativeWebViewLoadingProps {
  error?: string | null
  onRetry?: () => void
}

export function NativeWebViewLoading({
  error,
  onRetry,
}: NativeWebViewLoadingProps) {
  return (
    <View style={styles.container}>
      {error ? null : <ActivityIndicator color="#f05a3c" size="large" />}
      <Text style={styles.title}>
        {error ? '화면을 불러오지 못했어요' : '옷장을 준비하고 있어요'}
      </Text>
      {error ? <Text style={styles.description}>{error}</Text> : null}
      {error && onRetry ? (
        <Text accessibilityRole="button" onPress={onRetry} style={styles.retry}>
          다시 시도
        </Text>
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
    backgroundColor: '#f3f0e9',
  },
  title: {
    color: '#171714',
    fontSize: 18,
    fontWeight: '700',
  },
  description: {
    color: '#6f6c65',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  retry: {
    marginTop: 8,
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    color: '#ffffff',
    backgroundColor: '#171714',
    fontSize: 14,
    fontWeight: '700',
  },
})
