import { useCallback, useEffect, useState } from 'react'
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

export function useNativeAuth() {
  const [status, setStatus] = useState<NativeAuthStatus>('checking')
  const [session, setSession] = useState<NativeAuthSession | null>(null)

  useEffect(() => {
    let active = true

    void (async () => {
      try {
        const storedSession = await readNativeAuthSession()
        if (!active) return

        if (!storedSession) {
          setStatus('signed-out')
          return
        }

        const validation = await validateNativeAuthSession(storedSession)
        if (!active) return

        if (validation === 'invalid') {
          await clearNativeAuthSession()
          if (active) setStatus('signed-out')
          return
        }

        setSession(storedSession)
        setStatus('signed-in')
      } catch {
        if (active) setStatus('signed-out')
      }
    })()

    return () => {
      active = false
    }
  }, [])

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
    loginWithTestAccount,
    updateSession,
  }
}
