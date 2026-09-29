/**
 * 사용 위치: 앱 실행 → 저장된 로그인 확인 실패
 *
 * API 서버에 연결하지 못해 로그인 상태를 확인할 수 없을 때 오류 안내와 재시도 버튼을 표시한다.
 * 재시도 시 서버 연결과 저장된 세션 검증은 useNativeAuth에 맡긴다.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'

interface NativeConnectionErrorScreenProps {
  onRetry: () => Promise<void> | void
}

export function NativeConnectionErrorScreen({
  onRetry,
}: NativeConnectionErrorScreenProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.icon}>
        <Text style={styles.iconText}>!</Text>
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        서버에 연결하지 못했어요
      </Text>
      <Text style={styles.description}>
        인터넷 연결과 서버 상태를 확인한 뒤 다시 시도해주세요.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void onRetry()}
        style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
      >
        <Text style={styles.retryButtonText}>다시 시도</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#f3f0e9',
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f05a3c1f',
  },
  iconText: {
    color: '#f05a3c',
    fontSize: 34,
    fontWeight: '900',
  },
  title: {
    marginTop: 22,
    color: '#171714',
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
  },
  description: {
    maxWidth: 280,
    marginTop: 10,
    color: '#6f6c65',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  retryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 132,
    height: 48,
    marginTop: 26,
    borderRadius: 14,
    backgroundColor: '#171714',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.78,
  },
})
