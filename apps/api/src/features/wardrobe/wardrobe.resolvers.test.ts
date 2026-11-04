import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSchema, graphql, GraphQLError, isObjectType } from 'graphql'
import { ServiceError } from '../../graphql/errors.js'
import type { GraphQLContext } from '../../graphql/context.js'
import { typeDefs } from '../../graphql/schema.js'
import { wardrobeResolvers } from './wardrobe.resolvers.js'
import { wardrobeService } from './wardrobe.service.js'

test('플래너의 옷 관계는 삭제 시각과 사진을 전달하고 기존 옷의 누락 시각은 null로 반환한다', async () => {
  const schema = buildSchema(typeDefs)
  const itemType = schema.getType('WardrobeItem')
  assert.ok(isObjectType(itemType))
  itemType.getFields().archivedAt!.resolve = wardrobeResolvers.WardrobeItem.archivedAt
  const archivedAt = new Date('2026-11-05T01:02:03.000Z')
  const result = await graphql({
    schema,
    source: `{
      plannerEntries(from: "2026-11-02", to: "2026-11-08") {
        date outfit {
          items { wardrobeItem { id name archivedAt displayImageAsset { deliveryUrl } } }
        }
      }
    }`,
    rootValue: {
      plannerEntries: [{
        date: '2026-11-02',
        outfit: {
          items: [
            { wardrobeItem: { id: 'archived', name: '삭제한 셔츠', archivedAt, displayImageAsset: { deliveryUrl: 'https://example.test/shirt.png' } } },
            { wardrobeItem: { id: 'active', name: '현재 바지', archivedAt: null } },
            { wardrobeItem: { id: 'legacy', name: '기존 자켓' } },
          ],
        },
      }],
    },
  })
  assert.equal(result.errors, undefined)
  assert.deepEqual(JSON.parse(JSON.stringify(result.data)), {
    plannerEntries: [{
      date: '2026-11-02',
      outfit: {
        items: [
          { wardrobeItem: { id: 'archived', name: '삭제한 셔츠', archivedAt: archivedAt.toISOString(), displayImageAsset: { deliveryUrl: 'https://example.test/shirt.png' } } },
          { wardrobeItem: { id: 'active', name: '현재 바지', archivedAt: null, displayImageAsset: null } },
          { wardrobeItem: { id: 'legacy', name: '기존 자켓', archivedAt: null, displayImageAsset: null } },
        ],
      },
    }],
  })
})

test('브랜드 삭제는 로그인 사용자의 ID로만 실행한다', async (t) => {
  const remove = t.mock.method(wardrobeService, 'deleteBrand', async (_userId: string, _brandName: string) => 3)
  const context: GraphQLContext = { getViewer: async () => ({ id: 'viewer' }) as never }
  const result = await wardrobeResolvers.Mutation.deleteWardrobeBrand(null, { brandName: 'COS' }, context)
  assert.equal(result, 3)
  assert.deepEqual(remove.mock.calls[0]?.arguments, ['viewer', 'COS'])
})

test('인증에 실패하면 브랜드를 삭제하지 않고 인증 오류를 전달한다', async (t) => {
  const remove = t.mock.method(wardrobeService, 'deleteBrand', async () => 0)
  const context: GraphQLContext = { getViewer: async () => { throw new ServiceError('로그인이 필요합니다.', 'UNAUTHENTICATED') } }
  await assert.rejects(
    wardrobeResolvers.Mutation.deleteWardrobeBrand(null, { brandName: 'COS' }, context),
    (error: unknown) => error instanceof GraphQLError && error.extensions.code === 'UNAUTHENTICATED',
  )
  assert.equal(remove.mock.callCount(), 0)
})
