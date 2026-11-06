import assert from 'node:assert/strict'
import test from 'node:test'
import type { Prisma, PrismaClient } from '@prisma/client'
import { buildSchema, graphql, isObjectType } from 'graphql'
import type { GraphQLContext } from '../../graphql/context.js'
import { typeDefs } from '../../graphql/schema.js'
import type { ViewerRecord } from './user.repository.js'

/** 실제 DB 대신 저장 상태만 보관해 GraphQL → 검증 → upsert → 조회 계약을 검사한다. */
function createViewer(thighCircumferenceCm: number | null): ViewerRecord {
  const at = new Date('2026-11-05T00:00:00Z')
  return {
    id: 'viewer', displayName: '테스트 사용자', email: null, isTemporary: true,
    lastLoginAt: null, wearWeatherLatitude: null, wearWeatherLongitude: null,
    createdAt: at, updatedAt: at,
    preferredStyles: [], settings: null,
    styleProfile: {
      id: 'profile', userId: 'viewer', gender: 'male', bodyBuild: 'average',
      heightCm: 176, weightKg: 90, chestCircumferenceCm: null,
      waistCircumferenceCm: null, hipCircumferenceCm: null, thighCircumferenceCm,
      shoulderWidthCm: null, inseamCm: null, preferredFit: 'regular',
      createdAt: at, updatedAt: at,
    },
  } as ViewerRecord
}

test('허벅지둘레 70cm를 입력·저장·조회하고 누락은 유지하며 null은 지운다', async (t) => {
  let stored = createViewer(null)
  const upsert = t.mock.fn(async (args: Prisma.StyleProfileUpsertArgs) => {
    assert.equal(args.where.userId, 'viewer')
    assert.equal(args.create.userId, 'viewer')
    assert.equal(args.create.thighCircumferenceCm, args.update.thighCircumferenceCm)
    const value = args.update.thighCircumferenceCm
    assert.ok(value === undefined || value === null || typeof value === 'number')
    if (value !== undefined) stored = createViewer(value)
    return stored.styleProfile!
  })
  const findUnique = t.mock.fn(async (args: Prisma.UserFindUniqueArgs) => {
    assert.deepEqual(args.where, { id: 'viewer' })
    assert.ok(args.include?.styleProfile)
    return stored
  })
  // 전용 테스트 프로세스에서 lib/prisma의 기존 전역 주입점을 사용해 DB 접근을 막는다.
  const scope = globalThis as typeof globalThis & { prisma?: PrismaClient }
  const previousPrisma = scope.prisma
  scope.prisma = {
    styleProfile: { upsert },
    userStylePreference: { deleteMany: t.mock.fn(async () => ({ count: 0 })) },
    user: { findUnique },
  } as unknown as PrismaClient
  t.after(() => {
    if (previousPrisma === undefined) delete scope.prisma
    else scope.prisma = previousPrisma
  })
  const { userResolvers } = await import('./user.resolvers.js')
  const schema = buildSchema(typeDefs)
  const mutationType = schema.getMutationType()
  const queryType = schema.getQueryType()
  assert.ok(isObjectType(mutationType))
  assert.ok(isObjectType(queryType))
  mutationType.getFields().updateMyStyleProfile!.resolve = userResolvers.Mutation.updateMyStyleProfile
  queryType.getFields().me!.resolve = userResolvers.Query.me
  const contextValue: GraphQLContext = { getViewer: async () => stored }
  const mutate = async (input: Record<string, unknown>) => graphql({
    schema,
    source: `mutation Profile($input: UpdateMyStyleProfileInput!) {
      updateMyStyleProfile(input: $input) { styleProfile { thighCircumferenceCm } }
    }`,
    variableValues: { input: { gender: 'male', bodyBuild: 'average', preferredFit: 'regular', preferredStyles: [], ...input } },
    contextValue,
  })
  const created = await mutate({ thighCircumferenceCm: 70 })
  assert.equal(created.errors, undefined)
  assert.equal((created.data?.updateMyStyleProfile as { styleProfile: { thighCircumferenceCm: number } }).styleProfile.thighCircumferenceCm, 70)
  const queried = await graphql({ schema, source: '{ me { styleProfile { thighCircumferenceCm } } }', contextValue })
  assert.equal(queried.errors, undefined)
  assert.equal((queried.data?.me as { styleProfile: { thighCircumferenceCm: number } }).styleProfile.thighCircumferenceCm, 70)
  const omitted = await mutate({})
  assert.equal(omitted.errors, undefined)
  assert.equal(stored.styleProfile?.thighCircumferenceCm, 70)
  const cleared = await mutate({ thighCircumferenceCm: null })
  assert.equal(cleared.errors, undefined)
  assert.equal(stored.styleProfile?.thighCircumferenceCm, null)
  assert.equal(upsert.mock.callCount(), 3)
})
