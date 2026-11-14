import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSchema, graphql, isObjectType } from 'graphql'
import { prisma } from '../../lib/prisma.js'
import { typeDefs } from '../../graphql/schema.js'
import { ServiceError } from '../../graphql/errors.js'
import { wardrobeResolvers } from './wardrobe.resolvers.js'
import type { GraphQLContext } from '../../graphql/context.js'

test('GraphQL에서 보관 위치와 보류 설정을 저장·조회하고 타인·미인증 요청을 거절한다', async (t) => {
  const id = '100000000000000000000001'
  let row: Record<string, unknown> = { id, userId: 'owner', name: '셔츠', category: 'top', additionalCategories: [] }
  const original = { wardrobeItem: prisma.wardrobeItem, plannerEntry: prisma.plannerEntry }
  Object.assign(prisma, {
    wardrobeItem: {
      findFirst: async ({ where }: { where: { id: string; userId: string } }) => where.id === id && where.userId === 'owner' ? { ...row } : null,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        row = { ...row, ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) }
        return { ...row }
      },
    },
    plannerEntry: { findMany: async () => [] },
  })
  t.after(() => Object.assign(prisma, original))
  const schema = buildSchema(typeDefs)
  const item = schema.getType('WardrobeItem')
  assert.ok(isObjectType(item))
  for (const [name, resolve] of Object.entries(wardrobeResolvers.WardrobeItem)) item.getFields()[name].resolve = resolve as never
  const run = (source: string, owner: string | null, input?: Record<string, unknown>) => graphql({
    schema, source, variableValues: { id, input },
    contextValue: { getViewer: async () => { if (!owner) throw new ServiceError('로그인이 필요해요.', 'UNAUTHENTICATED'); return { id: owner } } },
    rootValue: {
      updateWardrobeItem: (args: { id: string; input: never }, context: GraphQLContext) => wardrobeResolvers.Mutation.updateWardrobeItem(null, args, context),
      wardrobeItem: (args: { id: string }, context: GraphQLContext) => wardrobeResolvers.Query.wardrobeItem(null, args, context),
    },
  })
  const fields = 'id storageLocation wearAvoidanceReason recommendationResumeOn'
  const mutation = `mutation($id: ID!, $input: UpdateWardrobeItemInput!) { updateWardrobeItem(id: $id, input: $input) { ${fields} } }`
  const saved = await run(mutation, 'owner', { storageLocation: '  본가   옷장 ', wearAvoidanceReason: 'fit_issue' })
  assert.equal(saved.errors, undefined)
  assert.deepEqual(JSON.parse(JSON.stringify(saved.data)), { updateWardrobeItem: { id, storageLocation: '본가 옷장', wearAvoidanceReason: 'fit_issue', recommendationResumeOn: null } })
  const read = await run(`query($id: ID!) { wardrobeItem(id: $id) { ${fields} } }`, 'owner')
  assert.equal(read.errors, undefined)
  assert.equal((read.data?.wardrobeItem as { wearAvoidanceReason: string }).wearAvoidanceReason, 'fit_issue')
  assert.ok((await run(mutation, 'other', { storageLocation: '타인 수정' })).errors)
  assert.equal((await run(mutation, null, { wearAvoidanceReason: null })).errors?.[0].extensions.code, 'UNAUTHENTICATED')
  assert.equal(row.storageLocation, '본가 옷장')
  const clear = await run(mutation, 'owner', { storageLocation: null, wearAvoidanceReason: null })
  assert.equal(clear.errors, undefined)
  assert.deepEqual(JSON.parse(JSON.stringify(clear.data)), { updateWardrobeItem: { id, storageLocation: null, wearAvoidanceReason: null, recommendationResumeOn: null } })
})
