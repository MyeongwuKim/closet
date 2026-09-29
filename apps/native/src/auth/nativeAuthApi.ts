import { fetchNativeGraphql } from '../api/nativeGraphql'
import type {
  NativeAuthSession,
  NativeTestLoginInput,
} from './nativeAuthTypes'

interface GraphqlErrorPayload {
  message?: string
  extensions?: { code?: string }
}

interface GraphqlResponse<T> {
  data?: T
  errors?: GraphqlErrorPayload[]
}

const NATIVE_AUTH_REQUEST_TIMEOUT_MS = 10_000

export class NativeAuthApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'NativeAuthApiError'
  }
}

/**
 * 네이티브 로그인 GraphQL 요청을 보내고 data를 반환한다.
 * 10초 안에 응답을 받지 못하거나 네트워크 요청이 실패하면 CONNECTION_UNAVAILABLE 오류로 변환한다.
 */
async function nativeGraphqlRequest<T>(
  query: string,
  variables?: object,
  accessToken?: string,
) {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    NATIVE_AUTH_REQUEST_TIMEOUT_MS,
  )

  try {
    const response = await fetchNativeGraphql(
      query,
      variables,
      accessToken,
      controller.signal,
    )
    const payload = (await response
      .json()
      .catch(() => ({}))) as GraphqlResponse<T>

    if (!response.ok || !payload.data) {
      const error = payload.errors?.[0]
      throw new NativeAuthApiError(
        error?.message ?? '로그인 서버에 연결하지 못했어요.',
        error?.extensions?.code,
      )
    }

    return payload.data
  } catch (error) {
    if (error instanceof NativeAuthApiError) throw error

    throw new NativeAuthApiError(
      controller.signal.aborted
        ? '로그인 서버 응답이 지연되고 있어요.'
        : '로그인 서버에 연결하지 못했어요.',
      'CONNECTION_UNAVAILABLE',
    )
  } finally {
    clearTimeout(timeout)
  }
}

export async function loginWithNativeTestAccount(
  input: NativeTestLoginInput,
): Promise<NativeAuthSession> {
  const data = await nativeGraphqlRequest<{
    testLogin: { accessToken: string }
  }>(
    `
      mutation NativeTestLogin($input: TestLoginInput!) {
        testLogin(input: $input) { accessToken }
      }
    `,
    { input },
  )

  return { accessToken: data.testLogin.accessToken }
}

/**
 * 저장된 액세스 토큰으로 현재 사용자를 조회한다.
 * 인증 거부는 invalid, 네트워크·서버 오류는 세션을 삭제하지 않는 unverified로 구분한다.
 */
export async function validateNativeAuthSession(
  session: NativeAuthSession,
) {
  try {
    await nativeGraphqlRequest<{ me: { id: string } }>(
      'query NativeSessionCheck { me { id } }',
      undefined,
      session.accessToken,
    )
    return 'valid' as const
  } catch (error) {
    if (
      error instanceof NativeAuthApiError &&
      error.code === 'UNAUTHENTICATED'
    ) {
      return 'invalid' as const
    }

    return 'unverified' as const
  }
}
