import { useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { wearroomColors } from '../theme/wearroomTheme'
import type { NativeUpdateRequirement } from './nativeUpdatePolicy'

export function NativeUpdateScreen({ requirement, onRetry }: { requirement: NativeUpdateRequirement; onRetry: () => void }) {
  const [error, setError] = useState(false)
  return <View style={styles.container}>
    <Text style={styles.title}>새 버전으로 업데이트해주세요</Text>
    <Text style={styles.description}>웨어룸을 계속 사용하려면 앱 업데이트가 필요해요.</Text>
    <Text style={styles.description}>현재 {requirement.currentVersion} · 최소 {requirement.minimumVersion}</Text>
    <Pressable accessibilityRole="button" style={styles.button} onPress={() => { setError(false); void Linking.openURL(requirement.storeUrl).catch(() => setError(true)) }}>
      <Text style={styles.buttonText}>업데이트하기</Text>
    </Pressable>
    {error ? <Text accessibilityRole="alert" style={styles.description}>스토어를 열지 못했어요. 다시 시도해주세요.</Text> : null}
    <Pressable accessibilityRole="button" style={styles.retry} onPress={onRetry}><Text>업데이트 확인</Text></Pressable>
  </View>
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, gap: 16 },
  title: { fontSize: 21, fontWeight: '600', color: wearroomColors.ink },
  description: { color: wearroomColors.muted, textAlign: 'center' },
  button: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 24, borderRadius: 14, backgroundColor: wearroomColors.accent },
  buttonText: { color: wearroomColors.surface, fontWeight: '600' },
  retry: { padding: 16 },
})
