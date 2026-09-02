/**
 * 사용 위치: 네이티브 앱 첫 진입 → 권한 안내
 *
 * 용도:
 * 시스템 권한 창을 열기 전에 알림 또는 위치 권한이 필요한 이유를 안내한다.
 *
 * 구조:
 * 진행 단계, 권한 설명, 나중에·허용하기 버튼을 담은 중앙 팝업으로 구성되어 있다.
 */
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import type { InitialPermission } from '../../permissions/initialPermissionSequence'

interface PermissionPromptCopy {
  badge: string
  title: string
  description: string
}

const permissionPromptCopy: Record<InitialPermission, PermissionPromptCopy> = {
  notifications: {
    badge: '알림',
    title: '필요한 알림을 받아보세요',
    description:
      'AI 작업이 끝났을 때 앱을 계속 보고 있지 않아도 알려드릴게요.',
  },
  location: {
    badge: '위치',
    title: '현재 위치의 날씨를 사용할까요?',
    description:
      '현재 위치의 날씨를 플래너와 코디 추천에 사용해요. 앱을 사용하지 않을 때는 위치를 확인하지 않아요.',
  },
}

interface NativePermissionPromptProps {
  permission: InitialPermission | null
  step: number
  totalSteps: number
  isRequesting: boolean
  error: string | null
  onAllow: () => void
  onSkip: () => void
}

export function NativePermissionPrompt({
  permission,
  step,
  totalSteps,
  isRequesting,
  error,
  onAllow,
  onSkip,
}: NativePermissionPromptProps) {
  const copy = permission ? permissionPromptCopy[permission] : null

  return (
    <Modal
      animationType="fade"
      navigationBarTranslucent
      onRequestClose={onSkip}
      statusBarTranslucent
      transparent
      visible={copy !== null}
    >
      <View style={styles.backdrop}>
        {copy ? (
          <View accessibilityViewIsModal style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{copy.badge}</Text>
              </View>
              <Text style={styles.progress}>
                {step} / {totalSteps}
              </Text>
            </View>

            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.description}>{copy.description}</Text>

            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                disabled={isRequesting}
                onPress={onSkip}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.buttonPressed,
                  isRequesting && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.secondaryButtonText}>나중에</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isRequesting}
                onPress={onAllow}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                  isRequesting && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {isRequesting ? '권한 확인 중...' : '허용하기'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(23, 23, 20, 0.46)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    padding: 24,
    backgroundColor: '#fffdf9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 54,
    height: 40,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: '#fff0ec',
  },
  badgeText: {
    color: '#f05a3c',
    fontSize: 14,
    fontWeight: '900',
  },
  progress: {
    color: '#918e86',
    fontSize: 12,
    fontWeight: '800',
  },
  title: {
    marginTop: 22,
    color: '#171714',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 32,
  },
  description: {
    marginTop: 10,
    color: '#6f6c65',
    fontSize: 15,
    lineHeight: 23,
  },
  error: {
    marginTop: 12,
    color: '#c9462d',
    fontSize: 13,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 26,
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 92,
    height: 50,
    borderWidth: 1,
    borderColor: '#ded9cf',
    borderRadius: 15,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
  },
  secondaryButtonText: {
    color: '#6f6c65',
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 15,
    paddingHorizontal: 18,
    backgroundColor: '#171714',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  buttonPressed: {
    opacity: 0.78,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
})
