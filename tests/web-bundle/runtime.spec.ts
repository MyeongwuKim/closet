import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Exercise the exact self-contained document published inside the ZIP.
// No API, CDN, R2, or real login requests are permitted.
test('verified ZIP document renders offline, repeats ready, and sends GraphQL through the native bridge', async ({ page }) => {
  const html = readFileSync('.web-bundle/dist/index.html', 'utf8')
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    if (route.request().isNavigationRequest() && route.request().url() === 'https://closet.native/') {
      return route.fulfill({ contentType: 'text/html', body: html })
    }
    errors.push(`Unexpected network request: ${route.request().url()}`)
    return route.abort()
  })
  await page.addInitScript(() => {
    const state = window as unknown as {
      __closetBundleLoadKey: string
      messages: string[]
      graphqlCalls: string[]
      ClosetNative: { requestGraphql: (query: string) => Promise<unknown> }
      ReactNativeWebView: { postMessage: (message: string) => void }
    }
    state.__closetBundleLoadKey = 'installed-test:0'
    state.messages = []
    state.graphqlCalls = []
    state.ReactNativeWebView = { postMessage: message => state.messages.push(message) }
    state.ClosetNative = {
      requestGraphql: async query => {
        state.graphqlCalls.push(query)
        return { ok: false, payload: { errors: [{ message: '테스트 로그인 응답' }] } }
      },
    }
  })
  await page.goto('https://closet.native/')
  await expect(page.getByRole('heading', { name: '테스트 계정으로 시작하기' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as unknown as { messages: string[] }).messages.length)).toBe(1)
  await page.evaluate(() => window.dispatchEvent(new Event('closet:request-web-app-ready')))
  const messages = await page.evaluate(() => (window as unknown as { messages: string[] }).messages.map(value => JSON.parse(value)))
  expect(messages).toEqual([
    { type: 'closet:web-app-ready', loadKey: 'installed-test:0' },
    { type: 'closet:web-app-ready', loadKey: 'installed-test:0' },
  ])
  await page.getByLabel('테스트 ID').fill('bundle_test')
  await page.getByLabel('비밀번호').fill('test1234')
  await page.getByRole('button', { name: '테스트 로그인', exact: true }).click()
  await expect(page.getByText('테스트 로그인 응답', { exact: true })).toBeVisible()
  const calls = await page.evaluate(() => (window as unknown as { graphqlCalls: string[] }).graphqlCalls)
  expect(calls).toHaveLength(1)
  expect(calls[0]).toContain('mutation')
  expect(errors).toEqual([])
})
