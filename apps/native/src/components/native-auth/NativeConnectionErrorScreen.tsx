/**
 * 사용 위치: 앱 실행 → 저장된 로그인 확인 실패
 *
 * API 서버에 연결하지 못해 로그인 상태를 확인할 수 없을 때 오류 안내와 재시도 버튼을 표시한다.
 * 재시도 시 서버 연결과 저장된 세션 검증은 useNativeAuth에 맡긴다.
 */
import { wearroomColors } from '../../theme/wearroomTheme'
import { Pressable, StyleSheet, Text, View } from 'react-native'

interface NativeConnectionErrorScreenProps {
  onRetry: () => Promise<void> | void
}

export function NativeConnectionErrorScreen({
  onRetry,
}: NativeConnectionErrorScreenProps) {
  return (
    <View style={styles.screen}>
      <Text style={styles.brand}>wearroom.</Text>
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
    backgroundColor: wearroomColors.canvas,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: wearroomColors.sage,
  },
  iconText: {
    color: wearroomColors.accent,
    fontSize: 34,
    fontWeight: '600',
  },
  title: {
    marginTop: 22,
    color: wearroomColors.ink,
    fontSize: 21,
    fontWeight: '600',
    textAlign: 'center',
  },
  description: {
    maxWidth: 280,
    marginTop: 10,
    color: wearroomColors.muted,
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
    backgroundColor: wearroomColors.accent,
  },
  retryButtonText: {
    color: wearroomColors.surface,
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.78,
  },
  brand: {
    color: wearroomColors.accent,
    fontSize: 18,
    letterSpacing: -0.6,
    marginBottom: 28,
  },
})
