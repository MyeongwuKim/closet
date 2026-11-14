import assert from 'node:assert/strict'
import test from 'node:test'
import { prisma } from '../../lib/prisma.js'
import { wardrobeService } from './wardrobe.service.js'

test('응답 유실 후 같은 등록 요청을 재시도하면 기존 옷을 반환한다', async (t) => {
  let saved: Record<string, unknown> | null = null
  let nextId = 0
  const originalTransaction = prisma.$transaction
  prisma.$transaction = (async (run: (tx: typeof prisma) => unknown) => run(prisma)) as unknown as typeof originalTransaction
  t.after(() => { prisma.$transaction = originalTransaction })
  const originals = { aiLease: prisma.aiLease, imageAsset: prisma.imageAsset, wardrobeItem: prisma.wardrobeItem }
  Object.assign(prisma, {
    aiLease: { upsert: async () => ({}) },
    imageAsset: {
      findMany: async () => [{ id: 'image', kind: 'wardrobeCutout', mimeType: 'image/png', uploadStatus: 'ready' }],
      findFirst: async () => ({ id: 'image', retention: 'permanent' }),
    },
    wardrobeItem: {
      findFirst: async () => saved,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        saved = { ...data, id: `item-${++nextId}` }
        return saved
      },
    },
  })
  t.after(() => Object.assign(prisma, originals))
  const input = { name: '셔츠', displayImageAssetId: 'image', registrationRequestId: '95c8a39f-6611-41c3-9717-6fa1fdecbf8a', category: 'top' as const, seasons: ['autumn' as const] }
  const first = await wardrobeService.create('viewer', input)
  const retried = await wardrobeService.create('viewer', input)
  assert.equal(retried.id, first.id)
})
