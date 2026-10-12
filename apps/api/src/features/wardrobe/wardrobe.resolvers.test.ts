import assert from 'node:assert/strict'
import test from 'node:test'
import { GraphQLError } from 'graphql'
import { ServiceError } from '../../graphql/errors.js'
import type { GraphQLContext } from '../../graphql/context.js'
import { wardrobeResolvers } from './wardrobe.resolvers.js'
import { wardrobeService } from './wardrobe.service.js'

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
