import assert from 'node:assert/strict'
import test from 'node:test'
import { buildApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { hashSessionToken } from '../auth/sessionToken.js'

/** 빈 전용 MongoDB에서 실제 로그인 GraphQL 저장·조회와 누락/null 호환성을 확인한다. */
test('별도 MongoDB에서 허벅지둘레의 저장·조회·유지·삭제·범위 검증을 확인한다', {
  skip: process.env.STYLE_PROFILE_INTEGRATION_DATABASE !== '1',
}, async (t) => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/closet_style_profile_test_\d+$/)
  assert.ok(Buffer.byteLength(new URL(process.env.DATABASE_URL!).pathname.slice(1)) <= 38)
  let ownsDatabase = false
  let app: Awaited<ReturnType<typeof buildApp>> | undefined
  try {
    const collections = await prisma.$runCommandRaw({ listCollections: 1, nameOnly: true }) as unknown as {
      cursor: { firstBatch: unknown[] }
    }
    assert.equal(collections.cursor.firstBatch.length, 0, '기존 컬렉션이 없는 새 테스트 DB에서만 실행한다')
    ownsDatabase = true
    app = await buildApp()
    const user = await prisma.user.create({ data: { displayName: '허벅지둘레 통합 테스트' } })
    const token = 'style-profile-integration-session'
    await prisma.userSession.create({ data: {
      userId: user.id, tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + 3_600_000),
    } })
    const request = async (query: string, variables?: Record<string, unknown>) => {
      const response = await app!.inject({
        method: 'POST', url: '/graphql',
        headers: { authorization: `Bearer ${token}` },
        payload: { query, variables },
      })
      assert.equal(response.statusCode, 200)
      return response.json()
    }
    const readThigh = async () => {
      const result = await request('{ me { styleProfile { thighCircumferenceCm } } }')
      assert.equal(result.errors, undefined)
      return result.data.me.styleProfile.thighCircumferenceCm as number | null
    }
    const updateThigh = (input: Record<string, unknown>) => request(`
      mutation Profile($input: UpdateMyStyleProfileInput!) {
        updateMyStyleProfile(input: $input) { styleProfile { thighCircumferenceCm } }
      }
    `, { input: {
      gender: 'male', bodyBuild: 'average', heightCm: 176, weightKg: 90,
      preferredFit: 'regular', preferredStyles: [], ...input,
    } })
    const storedThigh = async () => (await prisma.styleProfile.findUnique({
      where: { userId: user.id },
    }))?.thighCircumferenceCm

    await t.test('신체 프로필이 없는 기존 계정은 null로 조회된다', async () => {
      assert.equal(await readThigh(), null)
    })
    await t.test('70cm 입력을 실제 저장하고 인증된 me 조회로 다시 읽는다', async () => {
      const result = await updateThigh({ thighCircumferenceCm: 70 })
      assert.equal(result.errors, undefined)
      assert.equal(result.data.updateMyStyleProfile.styleProfile.thighCircumferenceCm, 70)
      assert.equal(await storedThigh(), 70)
      assert.equal(await readThigh(), 70)
    })
    await t.test('필드 누락은 저장된 값을 유지하고 명시적 null은 삭제한다', async () => {
      const omitted = await updateThigh({})
      assert.equal(omitted.errors, undefined)
      assert.equal(await storedThigh(), 70)
      assert.equal(await readThigh(), 70)
      const cleared = await updateThigh({ thighCircumferenceCm: null })
      assert.equal(cleared.errors, undefined)
      assert.equal(cleared.data.updateMyStyleProfile.styleProfile.thighCircumferenceCm, null)
      assert.equal(await storedThigh(), null)
      assert.equal(await readThigh(), null)
    })
    await t.test('범위 밖의 19cm 입력을 거절하고 기존 70cm 데이터는 유지한다', async () => {
      const restored = await updateThigh({ thighCircumferenceCm: 70 })
      assert.equal(restored.errors, undefined)
      const invalid = await updateThigh({ thighCircumferenceCm: 19 })
      assert.equal(invalid.errors?.[0]?.extensions?.code, 'INVALID_STYLE_PROFILE')
      assert.equal(await storedThigh(), 70)
      assert.equal(await readThigh(), 70)
    })
  } finally {
    // 실행 전 비어 있던 전용 DB만 정리하며, 앱 종료 실패 시에도 DB/연결 정리를 시도한다.
    try {
      await app?.close()
    } finally {
      try {
        if (ownsDatabase) {
          const dropped = await prisma.$runCommandRaw({ dropDatabase: 1 })
          assert.equal(dropped.ok, 1)
          console.log('STYLE_PROFILE_TEST_DATABASE_DROPPED')
        }
      } finally {
        await prisma.$disconnect()
      }
    }
  }
})
