import type { NativeAuthProvider } from './nativeAuthTypes'

const providerLabels: Record<NativeAuthProvider, string> = {
  apple: 'Apple',
  google: 'Google',
}

export async function beginNativeProviderLogin(provider: NativeAuthProvider) {
  throw new Error(
    `${providerLabels[provider]} 로그인은 네이티브 SDK와 서버 토큰 교환을 연결한 뒤 사용할 수 있어요. 지금은 아래 테스트 계정으로 로그인해주세요.`,
  )
}
