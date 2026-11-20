import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeR2Endpoint } from './r2-config.mjs'

test('strips an accidentally copied bucket suffix instead of creating a nested bucket folder', () => {
  for (const path of ['', '/', '/wearroom-web-dev', '/wearroom-web-dev/']) {
    assert.equal(normalizeR2Endpoint(`https://account.r2.cloudflarestorage.com${path}`, 'wearroom-web-dev'), 'https://account.r2.cloudflarestorage.com')
  }
  assert.equal(normalizeR2Endpoint('https://account.eu.r2.cloudflarestorage.com/wearroom-web-prod', 'wearroom-web-prod'), 'https://account.eu.r2.cloudflarestorage.com')
})

test('rejects unrelated paths and bucket values containing a prefix before any upload', () => {
  assert.throws(() => normalizeR2Endpoint('https://account.r2.cloudflarestorage.com/other-bucket', 'wearroom-web-dev'), /경로를 제거/)
  for (const bucket of ['wearroom-web-dev/releases', '/wearroom-web-dev', 'Wearroom', 'a']) {
    assert.throws(() => normalizeR2Endpoint('https://account.r2.cloudflarestorage.com', bucket), /버킷 이름/)
  }
})

test('rejects public download URLs, credentials, and insecure S3 endpoints', () => {
  for (const endpoint of ['https://pub-example.r2.dev', 'http://account.r2.cloudflarestorage.com', 'https://user:secret@account.r2.cloudflarestorage.com', 'https://account.r2.cloudflarestorage.com?key=value']) {
    assert.throws(() => normalizeR2Endpoint(endpoint, 'wearroom-web-dev'))
  }
})
