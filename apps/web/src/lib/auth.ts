const ACCESS_TOKEN_KEY = 'closet-test-access-token'

export function getAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setAccessToken(accessToken: string) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
}

export function clearAccessToken() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
}

export function isLoggedIn() {
  return Boolean(getAccessToken())
}
