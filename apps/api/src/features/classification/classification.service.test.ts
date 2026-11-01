import assert from 'node:assert/strict'
import test from 'node:test'
import { classificationService } from './classification.service.js'

test('형식이 잘못되거나 MIME과 실제 이미지가 다른 입력은 AI를 호출하기 전에 거절한다', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('호출하면 안 됨') })
  for (const imageBase64 of ['@@@=', Buffer.from('이미지가 아님').toString('base64')]) {
    await assert.rejects(classificationService.classify({ imageBase64, mimeType: 'image/png' }), { code: 'INVALID_IMAGE_DATA' })
    await assert.rejects(classificationService.analyzeSizeChart({ imageBase64, mimeType: 'image/png', category: 'top' }), { code: 'INVALID_IMAGE_DATA' })
  }
  assert.equal(fetch.mock.callCount(), 0)
})
