import { clearAccessToken, getAccessToken } from './auth'

interface GraphqlErrorPayload {
  message: string
  extensions?: { code?: string }
}

interface GraphqlResponse<TData> {
  data?: TData
  errors?: GraphqlErrorPayload[]
}

export class GraphqlRequestError extends Error {
  readonly code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'GraphqlRequestError'
    this.code = code
  }
}

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

export async function graphqlRequest<
  TData,
  TVariables extends object = object,
>(query: string, variables?: TVariables, signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(getAccessToken()
        ? { authorization: `Bearer ${getAccessToken()}` }
        : {}),
    },
    body: JSON.stringify({ query, variables }),
    signal,
  })
  const payload = (await response.json().catch(() => ({}))) as GraphqlResponse<TData>

  if (!response.ok || !payload.data) {
    const error = payload.errors?.[0]
    if (error?.extensions?.code === 'UNAUTHENTICATED') {
      clearAccessToken()
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }
    throw new GraphqlRequestError(
      error?.message ?? '서버 요청을 완료하지 못했습니다.',
      error?.extensions?.code,
    )
  }

  return payload.data
}
