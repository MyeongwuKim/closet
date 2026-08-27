const apiBaseUrl = (
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000'
).replace(/\/+$/, '')

export function fetchNativeGraphql(
  query: string,
  variables?: object,
  accessToken?: string,
  signal?: AbortSignal,
) {
  return fetch(`${apiBaseUrl}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
    signal,
  })
}
