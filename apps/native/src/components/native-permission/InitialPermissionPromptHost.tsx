/**
 * 사용 위치: 앱 실행 → 로그인 전 권한 안내
 *
 * 용도:
 * 필요한 권한 안내를 순서대로 열고 사용자의 선택에 맞춰 시스템 권한 요청을 연결한다.
 *
 * 동작 방식:
 * 안내 이력과 현재 상태를 확인한 뒤 알림과 위치 팝업을 하나씩 보여주며,
 * 허용하기를 누른 항목만 시스템 권한을 요청하고 모든 안내가 끝나면 완료 상태를 저장한다.
 */
import { useEffect, useRef, useState } from 'react'
import {
  completeInitialPermissionPrompts,
  getInitialPermissionPrompts,
} from '../../permissions/initialPermissionPrompt'
import type { InitialPermission } from '../../permissions/initialPermissionSequence'
import { requestNativePermission } from '../../webview/bridge/permissionBridge'
import { NativePermissionPrompt } from './NativePermissionPrompt'

interface InitialPermissionPromptHostProps {
  onComplete: () => void
}

export function InitialPermissionPromptHost({
  onComplete,
}: InitialPermissionPromptHostProps) {
  const hasPreparedRef = useRef(false)
  const [permissions, setPermissions] = useState<InitialPermission[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isRequesting, setIsRequesting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (hasPreparedRef.current) return

    hasPreparedRef.current = true
    let isActive = true

    void getInitialPermissionPrompts()
      .then((nextPermissions) => {
        if (!isActive) return
        if (nextPermissions.length === 0) {
          void completeInitialPermissionPrompts().then(onComplete, onComplete)
          return
        }
        setPermissions(nextPermissions)
      })
      .catch(() => {
        if (isActive) onComplete()
      })

    return () => {
      isActive = false
    }
  }, [onComplete])

  const currentPermission = permissions[currentIndex] ?? null

  const moveToNextPrompt = () => {
    setError(null)
    if (currentIndex + 1 < permissions.length) {
      setCurrentIndex((index) => index + 1)
      return
    }

    setPermissions([])
    void completeInitialPermissionPrompts().then(onComplete, onComplete)
  }

  const handleAllow = async () => {
    if (!currentPermission || isRequesting) return

    setIsRequesting(true)
    setError(null)
    try {
      await requestNativePermission(currentPermission)
      moveToNextPrompt()
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : '기기 권한을 요청하지 못했어요.',
      )
    } finally {
      setIsRequesting(false)
    }
  }

  const handleSkip = () => {
    if (!currentPermission || isRequesting) return
    moveToNextPrompt()
  }

  return (
    <NativePermissionPrompt
      error={error}
      isRequesting={isRequesting}
      onAllow={() => void handleAllow()}
      onSkip={handleSkip}
      permission={currentPermission}
      step={currentIndex + 1}
      totalSteps={permissions.length}
    />
  )
}
