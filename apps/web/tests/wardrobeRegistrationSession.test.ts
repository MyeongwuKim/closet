import assert from 'node:assert/strict'
import test from 'node:test'
import { saveWardrobeItem } from '../src/features/closet/api/saveWardrobeItem'
import { createWardrobeRegistrationDraft, toWardrobeRegistrationInput } from '../src/features/closet/utils/wardrobeRegistration'
import type { ClassificationCandidate } from '../src/stores/useUiStore'

test('업로드 도중 계정이 바뀌면 새 계정으로 업로드 확인·옷 생성을 이어가지 않는다', async (t) => {
  let token = 'account-a'
  const originalWindow = globalThis.window
  const originalFetch = globalThis.fetch
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: () => token } } })
  t.after(() => { globalThis.fetch = originalFetch; Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow }) })
  const operations: string[] = []
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith('data:')) return new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/png' } })
    if (String(url) === 'https://upload.example.test') { token = 'account-b'; return Response.json({ success: true }) }
    const request = JSON.parse(String(options?.body))
    const operation = request.query.match(/mutation (\w+)/)?.[1]
    operations.push(operation)
    assert.equal((options?.headers as Record<string, string>).authorization, 'Bearer account-a')
    return Response.json({ data: { prepareImageUpload: { uploadUrl: 'https://upload.example.test', uploadFilename: 'shirt.png', asset: { id: 'asset', deliveryUrl: null } } } })
  }
  const candidate: ClassificationCandidate = {
    itemId: 'db85c36d-3205-447f-9d9b-62044d4ff8f8', itemName: '셔츠', imageUrl: 'data:image/png;base64,AQ==', originalImageUrl: 'data:image/png;base64,AQ==',
    category: 'top', subcategory: '셔츠', colorName: '네이비', colorDetailName: '네이비', colorHex: '#24364a', colorRgb: [36, 54, 74],
    colorMode: 'solid', fashionAttributes: null, confidence: 1, model: 'test', candidates: [], analysisFailed: false,
  }
  const draft = { ...createWardrobeRegistrationDraft(candidate), seasons: ['spring' as const] }
  await assert.rejects(saveWardrobeItem(candidate, toWardrobeRegistrationInput(draft)), { code: 'REGISTRATION_SESSION_CHANGED' })
  assert.deepEqual(operations, ['PrepareImageUpload'])
})
