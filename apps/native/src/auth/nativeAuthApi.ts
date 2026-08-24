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

export class NativeAuthApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'NativeAuthApiError'
  }
}

const apiBaseUrl = (
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000'
).replace(/\/+$/, '')

async function nativeGraphqlRequest<T>(
  query: string,
  variables?: object,
  accessToken?: string,
) {
  const response = await fetch(`${apiBaseUrl}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  })
  const payload = (await response.json().catch(() => ({}))) as GraphqlResponse<T>

  if (!response.ok || !payload.data) {
    const error = payload.errors?.[0]
    throw new NativeAuthApiError(
      error?.message ?? '로그인 서버에 연결하지 못했어요.',
      error?.extensions?.code,
    )
  }

  return payload.data
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
