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

test('JPEG 헤더가 있어도 디코딩할 수 없으면 배경 제거 실패 단계를 기록한다', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {})
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('모델을 요청하면 안 됨') })
  const imageBase64 = Buffer.from([0xff, 0xd8, 0xff]).toString('base64')

  await assert.rejects(
    classificationService.createCutout({ imageBase64, mimeType: 'image/jpeg', filename: 'private-photo.jpg' }),
    { code: 'BACKGROUND_REMOVAL_FAILED' },
  )
  assert.equal(fetch.mock.callCount(), 0)
  assert.deepEqual(warn.mock.calls.map((call) => call.arguments), [
    ['[wardrobe-cutout] background removal failed', { stage: 'decode-image', errorType: 'Error' }],
    ['[wardrobe-cutout] background removal failed', { stage: 'decode-image', errorType: 'Error' }],
  ])
})
