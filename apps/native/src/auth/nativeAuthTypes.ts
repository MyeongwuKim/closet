export interface NativeAuthSession {
  accessToken: string
}

export interface NativeTestLoginInput {
  loginId: string
  password: string
  displayName?: string
}

export type NativeAuthProvider = 'apple' | 'google'

/**
 * checking은 저장 세션 확인 중, connection-error는 세션을 지우지 않은 연결 실패 상태다.
 * signed-out과 signed-in은 각각 로그인 화면과 로그인 완료 WebView를 표시한다.
 */
export type NativeAuthStatus =
  | 'checking'
  | 'connection-error'
  | 'signed-out'
  | 'signed-in'
