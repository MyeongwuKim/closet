import assert from 'node:assert/strict'
import test from 'node:test'
import { buildApp } from './app.js'
import { authService } from './features/auth/auth.service.js'
import { imageRepository } from './features/image/image.repository.js'
import { todayOutfitRecommendationService } from './features/outfit/today-outfit-recommendation.service.js'
import { wardrobeRepository, type CreateWardrobeItemData } from './features/wardrobe/wardrobe.repository.js'
import { wardrobeService } from './features/wardrobe/wardrobe.service.js'
import { ServiceError } from './graphql/errors.js'

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

test('옷장·코디 조회와 통계는 로그인하지 않은 요청에 데이터를 반환하지 않는다', async (t) => {
  const app = await buildApp()
  t.after(() => app.close())
  for (const selection of [
    'wardrobePage { totalCount items { id } }',
    'outfitPage { totalCount items { id } }',
    'wardrobeFilterOptions { totalCount }',
    'outfitFilterOptions { totalCount }',
    'wardrobeStatistics { totalItems unwornOutfitCount mostWornOutfits { id name wearCount imageUrl itemImageUrls } }',
    'todayOutfitRecommendation(input: { date: "2026-08-28", season: autumn, baseItemId: "base-item" }) { ready items { id } }',
    'weatherForecast(input: { date: "2026-08-28", latitude: 37.5, longitude: 127.0 }) { temperatureC }',
  ]) {
    const response = await app.inject({
      method: 'POST', url: '/graphql', payload: { query: `query { ${selection} }` },
    })
    const result = response.json()
    assert.equal(result.data, null)
    assert.equal(result.errors[0].extensions.code, 'UNAUTHENTICATED')
  }
})

test('기준 아이템 검증 실패를 GraphQL 오류 코드와 함께 전달한다', async (t) => {
  t.mock.method(authService, 'getViewer', async () => ({ id: 'viewer' }))
  t.mock.method(todayOutfitRecommendationService, 'recommend', async (
    userId: string,
    input: { baseItemId?: string | null },
  ) => {
    assert.equal(userId, 'viewer')
    assert.equal(input.baseItemId, 'invalid-item')
    throw new ServiceError(
      '분류가 완료된 내 옷장 아이템만 추천 기준으로 사용할 수 있습니다.',
      'INVALID_OUTFIT_RECOMMENDATION',
    )
  })
  const app = await buildApp()
  t.after(() => app.close())

  const response = await app.inject({
    method: 'POST',
    url: '/graphql',
    payload: {
      query: `query {
        todayOutfitRecommendation(input: {
          date: "2026-08-28", season: autumn, baseItemId: "invalid-item"
        }) { ready items { id } }
      }`,
    },
  })
  const result = response.json()
  assert.equal(result.data, null)
  assert.equal(result.errors[0].extensions.code, 'INVALID_OUTFIT_RECOMMENDATION')
  assert.match(result.errors[0].message, /내 옷장 아이템만/)
})

const legacyFashionAttributes = {
  layerRole: 'base',
  silhouette: 'relaxed',
  pattern: 'solid',
  material: 'knit',
  texture: 'ribbed',
  warmth: 'medium',
  formality: 0.4,
  confidence: 0.9,
}

test('GraphQL 옷 등록은 시보리 판정을 전달하고 구버전 입력은 unknown으로 저장한다', async (t) => {
  t.mock.method(authService, 'getViewer', async () => ({ id: 'viewer' }))
  t.mock.method(imageRepository, 'findOwnedByIds', async () => [
    { id: 'display-image', uploadStatus: 'ready' },
  ])
  t.mock.method(wardrobeRepository, 'create', async (data: CreateWardrobeItemData) => ({
    id: 'saved-item',
    ...data,
  }))
  const app = await buildApp()
  t.after(() => app.close())
  const unknownTrims = { ribbedCuffs: 'unknown', ribbedHem: 'unknown', ribbedNeckline: 'unknown' }
  const observedTrims = { ribbedCuffs: 'present', ribbedHem: 'absent', ribbedNeckline: 'unknown' }
  const cases = [
    { fields: observedTrims, expected: observedTrims },
    { fields: {}, expected: unknownTrims },
    { fields: { ribbedCuffs: null, ribbedHem: null, ribbedNeckline: null }, expected: unknownTrims },
  ]

  for (const example of cases) {
    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation ($input: CreateWardrobeItemInput!) {
          createWardrobeItem(input: $input) {
            fashionAttributes { ribbedCuffs ribbedHem ribbedNeckline }
          }
        }`,
        variables: {
          input: {
            name: '그레이 니트',
            displayImageAssetId: 'display-image',
            category: 'top',
            seasons: ['autumn'],
            fashionAttributes: { ...legacyFashionAttributes, ...example.fields },
          },
        },
      },
    })
    const result = response.json()
    assert.equal(result.errors, undefined)
    assert.deepEqual(result.data.createWardrobeItem.fashionAttributes, example.expected)
  }
})

test('시보리 정보가 없는 기존 저장 데이터도 GraphQL nullable 필드로 조회한다', async (t) => {
  t.mock.method(authService, 'getViewer', async () => ({ id: 'viewer' }))
  t.mock.method(wardrobeService, 'get', async () => ({
    id: 'legacy-item',
    fashionAttributes: legacyFashionAttributes,
  }))
  const app = await buildApp()
  t.after(() => app.close())

  const response = await app.inject({
    method: 'POST',
    url: '/graphql',
    payload: {
      query: `query {
        wardrobeItem(id: "legacy-item") {
          fashionAttributes { ribbedCuffs ribbedHem ribbedNeckline }
        }
      }`,
    },
  })
  const result = response.json()
  assert.equal(result.errors, undefined)
  assert.deepEqual(result.data.wardrobeItem.fashionAttributes, {
    ribbedCuffs: null,
    ribbedHem: null,
    ribbedNeckline: null,
  })
})
