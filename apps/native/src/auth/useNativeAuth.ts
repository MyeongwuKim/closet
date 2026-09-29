import { useCallback, useEffect, useRef, useState } from 'react'
import {
  loginWithNativeTestAccount,
  validateNativeAuthSession,
} from './nativeAuthApi'
import {
  clearNativeAuthSession,
  readNativeAuthSession,
  saveNativeAuthSession,
} from './nativeAuthStorage'
import type {
  NativeAuthSession,
  NativeAuthStatus,
  NativeTestLoginInput,
} from './nativeAuthTypes'

/**
 * 기기에 저장한 액세스 토큰과 앱 시작 시 세션 검증 상태를 관리한다.
 * 로그인·로그아웃 시 SecureStore를 갱신하며 서버 연결 실패는 재시도 가능한 상태로 노출한다.
 */
export function useNativeAuth() {
  const [status, setStatus] = useState<NativeAuthStatus>('checking')
  const [session, setSession] = useState<NativeAuthSession | null>(null)
  const checkAttemptRef = useRef(0)

  /**
   * 기기에 저장된 세션을 읽고 API에서 유효성을 확인한다.
   * 인증 실패는 저장된 세션을 지우며, 서버 연결을 확인하지 못한 경우에는
   * 세션을 유지한 채 connection-error로 전환해 사용자가 다시 시도할 수 있게 한다.
   */
  const checkStoredSession = useCallback(async () => {
    const attempt = checkAttemptRef.current + 1
    checkAttemptRef.current = attempt
    setStatus('checking')

    try {
      const storedSession = await readNativeAuthSession()
      if (checkAttemptRef.current !== attempt) return

      if (!storedSession) {
        setSession(null)
        setStatus('signed-out')
        return
      }

      const validation = await validateNativeAuthSession(storedSession)
      if (checkAttemptRef.current !== attempt) return

      if (validation === 'invalid') {
        await clearNativeAuthSession()
        if (checkAttemptRef.current !== attempt) return
        setSession(null)
        setStatus('signed-out')
        return
      }

      if (validation === 'unverified') {
        setStatus('connection-error')
        return
      }

      setSession(storedSession)
      setStatus('signed-in')
    } catch {
      if (checkAttemptRef.current !== attempt) return
      setSession(null)
      setStatus('signed-out')
    }
  }, [])

  useEffect(() => {
    void checkStoredSession()

    return () => {
      checkAttemptRef.current += 1
    }
  }, [checkStoredSession])

  const loginWithTestAccount = useCallback(
    async (input: NativeTestLoginInput) => {
      const nextSession = await loginWithNativeTestAccount(input)
      await saveNativeAuthSession(nextSession)
      setSession(nextSession)
      setStatus('signed-in')
    },
    [],
  )

  const updateSession = useCallback(async (accessToken: string | null) => {
    if (!accessToken) {
      await clearNativeAuthSession()
      setSession(null)
      setStatus('signed-out')
      return
    }

    const nextSession = { accessToken }
    await saveNativeAuthSession(nextSession)
    setSession(nextSession)
    setStatus('signed-in')
  }, [])

  return {
    status,
    session,
    retrySessionCheck: checkStoredSession,
    loginWithTestAccount,
    updateSession,
  }
}
