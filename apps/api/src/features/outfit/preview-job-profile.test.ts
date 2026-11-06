import assert from 'node:assert/strict'
import test from 'node:test'
import type { AiPreviewJob } from '@prisma/client'
import { userRepository } from '../user/user.repository.js'
import { wardrobeRepository } from '../wardrobe/wardrobe.repository.js'
import { previewJobRepository } from './preview-job.repository.js'
import { previewJobService } from './preview-job.service.js'

test('키나 허벅지 둘레 변경 후 새 요청은 같은 옷의 이전 체형 작업과 중복 처리하지 않는다', async (t) => {
  let heightCm = 160
  let thighCircumferenceCm = 60
  t.mock.method(userRepository, 'findViewerById', async () => ({
    styleProfile: { gender: 'male', bodyBuild: 'average', heightCm, thighCircumferenceCm, preferredFit: 'regular' },
    preferredStyles: [],
  }) as unknown as Awaited<ReturnType<typeof userRepository.findViewerById>>)
  t.mock.method(wardrobeRepository, 'findManyOwnedWithImagesByIds', async () => [
    { id: 'top', category: 'top', displayImageAsset: { deliveryUrl: 'https://images.example.test/top' } },
    { id: 'bottom', category: 'bottom', displayImageAsset: { deliveryUrl: 'https://images.example.test/bottom' } },
  ] as unknown as Awaited<ReturnType<typeof wardrobeRepository.findManyOwnedWithImagesByIds>>)
  const enqueue = t.mock.method(previewJobRepository, 'enqueue', async (input: Parameters<typeof previewJobRepository.enqueue>[0]) => ({
    ...input, createdAt: new Date(), status: 'queued', imageAssetId: null,
    model: null, errorCode: null, errorMessage: null,
  }) as unknown as AiPreviewJob)

  await previewJobService.start('viewer', { selectedItemIds: ['top', 'bottom'], style: 'casual', requestId: 'profile-before' })
  heightCm = 185
  await previewJobService.start('viewer', { selectedItemIds: ['top', 'bottom'], style: 'casual', requestId: 'profile-after' })

  const before = enqueue.mock.calls[0]!.arguments[0]
  const after = enqueue.mock.calls[1]!.arguments[0]
  assert.equal(before.inputKey, after.inputKey)
  assert.notEqual(before.fingerprint, after.fingerprint)
  assert.notEqual(before.requestKey, after.requestKey)

  thighCircumferenceCm = 70
  await previewJobService.start('viewer', { selectedItemIds: ['top', 'bottom'], style: 'casual', requestId: 'profile-thigh-after' })
  const changedThigh = enqueue.mock.calls[2]!.arguments[0]
  assert.equal(after.inputKey, changedThigh.inputKey)
  assert.notEqual(after.fingerprint, changedThigh.fingerprint)
  assert.notEqual(after.requestKey, changedThigh.requestKey)
})
