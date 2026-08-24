import * as SecureStore from 'expo-secure-store'
import type { NativeAuthSession } from './nativeAuthTypes'

const NATIVE_AUTH_TOKEN_KEY = 'closet.native.access-token'

export async function readNativeAuthSession(): Promise<NativeAuthSession | null> {
  const accessToken = await SecureStore.getItemAsync(NATIVE_AUTH_TOKEN_KEY)
  return accessToken ? { accessToken } : null
}

export async function saveNativeAuthSession(session: NativeAuthSession) {
  await SecureStore.setItemAsync(NATIVE_AUTH_TOKEN_KEY, session.accessToken, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  })
}

export async function clearNativeAuthSession() {
  await SecureStore.deleteItemAsync(NATIVE_AUTH_TOKEN_KEY)
}
