import assert from 'node:assert/strict'
import test from 'node:test'
import type { OutfitPreviewJob, StoredOutfitPreview } from '@closet/types'
import { matchesExistingPreview, resumeExistingPreview } from '../src/features/lookbook/utils/resumeExistingPreview'

const input = { selectedItemIds: ['top', 'bottom'], style: 'casual' }
const asset: StoredOutfitPreview = { assetId: 'asset-one', imageUrl: 'https://example.test/result.png', mimeType: 'image/png', model: 'fixture' }
const job = (overrides: Partial<OutfitPreviewJob> = {}): OutfitPreviewJob => ({
  id: 'known-job', status: 'processing', selectedItemIds: ['bottom', 'top'], style: 'casual',
  imageAssetId: null, model: null, errorCode: null, errorMessage: null,
  createdAt: '2026-11-03T00:00:00.000Z', path: '/lookbook/new?previewJobId=known-job', ...overrides,
})

test('알려진 진행 작업을 끝까지 관찰해 완료 이미지만 읽는다', async () => {
  const reads: string[] = []
  let jobReads = 0
  const result = await resumeExistingPreview(input, {
    jobId: 'known-job', assertActive: () => undefined,
    readJobs: async () => { throw new Error('알고 있는 작업은 목록을 다시 찾지 않아야 해요.') },
    readJob: async (id) => {
      reads.push(`job:${id}`)
      jobReads += 1
      return job(jobReads === 1 ? {} : { status: 'completed', imageAssetId: asset.assetId })
    },
    readAsset: async (id) => { reads.push(`asset:${id}`); return asset },
    waitOptions: { wait: async () => undefined },
  })
  assert.deepEqual(reads, ['job:known-job', 'job:known-job', 'asset:asset-one'])
  assert.deepEqual(result, { ...asset, imageBase64: '' })
})

test('복원 버튼을 누르기 직전에 완료됐어도 기존 작업의 이미지를 반환한다', async () => {
  let imageReads = 0
  const result = await resumeExistingPreview(input, {
    jobId: 'known-job', assertActive: () => undefined,
    readJobs: async () => { throw new Error('다른 작업을 찾으면 안 돼요.') },
    readJob: async () => job({ status: 'completed', imageAssetId: asset.assetId }),
    readAsset: async () => { imageReads += 1; return asset },
  })
  assert.equal(result.assetId, asset.assetId)
  assert.equal(imageReads, 1)
})

test('복원 직전에 실패한 작업은 실패를 반환하고 다른 작업이나 이미지를 찾지 않는다', async () => {
  let imageReads = 0
  await assert.rejects(resumeExistingPreview(input, {
    jobId: 'known-job', assertActive: () => undefined,
    readJobs: async () => { throw new Error('실패했다고 다른 작업으로 넘어가면 안 돼요.') },
    readJob: async () => job({ status: 'failed', errorCode: 'AI_FAILED', errorMessage: '생성 실패' }),
    readAsset: async () => { imageReads += 1; return asset },
  }), { code: 'AI_FAILED', message: '생성 실패' })
  assert.equal(imageReads, 0)
})

test('로컬 작업 번호가 없어도 서버 목록에서 같은 조합을 찾고 최신 상태로 이어받는다', async () => {
  const reads: string[] = []
  const result = await resumeExistingPreview(input, {
    assertActive: () => undefined,
    readJobs: async () => { reads.push('list'); return [job({ selectedItemIds: ['other'] }), job()] },
    readJob: async (id) => { reads.push(`job:${id}`); return job({ status: 'completed', imageAssetId: asset.assetId }) },
    readAsset: async (id) => { reads.push(`asset:${id}`); return asset },
  })
  assert.deepEqual(reads, ['list', 'job:known-job', 'asset:asset-one'])
  assert.equal(result.assetId, asset.assetId)
})

test('목록의 진행 상태가 이미 완료·실패로 바뀌었어도 최근 같은 조합의 작업만 조회한다', async () => {
  let readId = ''
  await assert.rejects(resumeExistingPreview(input, {
    assertActive: () => undefined,
    readJobs: async () => [job({ id: 'old-completed', status: 'completed', imageAssetId: 'old-asset', createdAt: '2026-11-02T00:00:00.000Z' }), job({ status: 'failed' })],
    readJob: async (id) => { readId = id; return job({ status: 'failed', errorCode: 'AI_FAILED' }) },
    readAsset: async () => asset,
  }), { code: 'AI_FAILED' })
  assert.equal(readId, 'known-job')
})

test('다른 옷·스타일의 작업뿐이면 복원을 거절하고 새 작업으로 넘어가지 않는다', async () => {
  let jobReads = 0
  await assert.rejects(resumeExistingPreview(input, {
    assertActive: () => undefined,
    readJobs: async () => [job({ selectedItemIds: ['other'] }), job({ style: 'formal' })],
    readJob: async () => { jobReads += 1; return job() },
    readAsset: async () => asset,
  }), { code: 'AI_JOB_NOT_FOUND' })
  assert.equal(jobReads, 0)
  assert.equal(matchesExistingPreview(job({ selectedItemIds: ['top', 'bottom', 'top'], style: ' casual ' }), input), true)
})

test('복원 도중 계정이 바뀌면 이후 작업 조회와 이미지 반환을 멈춘다', async () => {
  let activeChecks = 0
  let jobReads = 0
  await assert.rejects(resumeExistingPreview(input, {
    assertActive: () => { activeChecks += 1; if (activeChecks > 1) throw new Error('계정 변경') },
    readJobs: async () => [job()],
    readJob: async () => { jobReads += 1; return job() },
    readAsset: async () => asset,
  }), { message: '계정 변경' })
  assert.equal(jobReads, 0)
})

test('고정한 작업 번호에 다른 조합이 반환되거나 완료 이미지 번호가 다르면 거절한다', async () => {
  const source = {
    jobId: 'known-job', assertActive: () => undefined,
    readJobs: async () => [], readJob: async () => job({ selectedItemIds: ['other'] }), readAsset: async () => asset,
  }
  await assert.rejects(resumeExistingPreview(input, source), { code: 'AI_JOB_NOT_FOUND' })
  await assert.rejects(resumeExistingPreview(input, {
    ...source, readJob: async () => job({ status: 'completed', imageAssetId: 'other-asset' }),
  }), { code: 'OUTFIT_PREVIEW_NOT_FOUND' })
})
