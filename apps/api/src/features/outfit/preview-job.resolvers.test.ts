import assert from 'node:assert/strict'
import test from 'node:test'
import { buildApp } from '../../app.js'
import { previewJobService } from './preview-job.service.js'

test('생성 작업의 접수·상태·목록·확인은 모두 로그인해야 실행된다', async (t) => {
  const start = t.mock.method(previewJobService, 'start', async () => { throw new Error('호출하면 안 됨') })
  const get = t.mock.method(previewJobService, 'get', async () => { throw new Error('호출하면 안 됨') })
  const list = t.mock.method(previewJobService, 'list', async () => [])
  const ack = t.mock.method(previewJobService, 'acknowledge', async () => true)
  const latest = t.mock.method(previewJobService, 'latestForItems', async () => null)
  const app = await buildApp()
  t.after(() => app.close())
  for (const query of [
    'mutation { startOutfitPreview(input: { selectedItemIds: ["top", "bottom"], requestId: "request-test" }) { id } }',
    'query { outfitPreviewJob(id: "job-test") { id } }',
    'query { outfitPreviewJobs { id } }',
    'query { outfitPreviewForItems(selectedItemIds: ["top", "bottom"], style: "casual") { assetId imageUrl mimeType model jobId createdAt } }',
    'mutation { acknowledgeOutfitPreviewJob(id: "job-test") }',
  ]) {
    const response = await app.inject({ method: 'POST', url: '/graphql', payload: { query } })
    assert.equal(response.json().errors?.[0]?.extensions?.code, 'UNAUTHENTICATED')
  }
  for (const fn of [start, get, list, ack, latest]) assert.equal(fn.mock.callCount(), 0)
})
