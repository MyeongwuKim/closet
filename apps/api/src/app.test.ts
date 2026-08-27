import assert from 'node:assert/strict'
import test from 'node:test'
import { buildApp } from './app.js'

test('설정된 웹 주소와 번들 WebView 주소에만 CORS를 허용한다', async (t) => {
  const previousOrigin = process.env.WEB_ORIGIN
  process.env.WEB_ORIGIN = 'https://web.closet.example, http://localhost:5174'
  t.after(() => {
    if (previousOrigin === undefined) delete process.env.WEB_ORIGIN
    else process.env.WEB_ORIGIN = previousOrigin
  })

  const app = await buildApp()
  t.after(() => app.close())

  for (const origin of [
    'https://closet.native',
    'https://web.closet.example',
    'http://localhost:5174',
  ]) {
    await t.test(`${origin}의 인증 요청과 응답을 허용한다`, async () => {
      const preflight = await app.inject({
        method: 'OPTIONS',
        url: '/graphql',
        headers: {
          origin,
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type,authorization',
        },
      })

      assert.equal(preflight.statusCode, 204)
      assert.equal(preflight.headers['access-control-allow-origin'], origin)
      assert.match(
        String(preflight.headers['access-control-allow-headers']),
        /authorization/,
      )

      const response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { origin },
      })
      assert.equal(response.headers['access-control-allow-origin'], origin)
    })
  }

  for (const origin of [
    'https://untrusted.example',
    'https://closet.native.untrusted.example',
    'null',
  ]) {
    await t.test(`${origin}은 허용하지 않는다`, async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/graphql',
        headers: { origin, 'access-control-request-method': 'POST' },
      })
      assert.equal(response.headers['access-control-allow-origin'], undefined)
    })
  }
})

test('페이지 조회와 통계는 로그인하지 않은 요청에 데이터를 반환하지 않는다', async (t) => {
  const app = await buildApp()
  t.after(() => app.close())
  for (const selection of [
    'wardrobePage { totalCount items { id } }',
    'outfitPage { totalCount items { id } }',
    'wardrobeFilterOptions { totalCount }',
    'outfitFilterOptions { totalCount }',
    'wardrobeStatistics { totalItems unwornOutfitCount mostWornOutfits { id name wearCount imageUrl itemImageUrls } }',
  ]) {
    const response = await app.inject({
      method: 'POST', url: '/graphql', payload: { query: `query { ${selection} }` },
    })
    const result = response.json()
    assert.equal(result.data, null)
    assert.equal(result.errors[0].extensions.code, 'UNAUTHENTICATED')
  }
})
