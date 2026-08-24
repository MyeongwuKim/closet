export interface NativeAuthSession {
  accessToken: string
}

export interface NativeTestLoginInput {
  loginId: string
  password: string
  displayName?: string
}

export type NativeAuthProvider = 'apple' | 'google'

export type NativeAuthStatus = 'checking' | 'signed-out' | 'signed-in'
