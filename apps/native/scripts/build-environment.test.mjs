import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { loadBuildEnvironment } from './build-environment.mjs'

function createFixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'wearoom-env-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  writeFileSync(path.join(root, '.env'), 'EXPO_PUBLIC_API_URL=http://localhost:4000\nEXPO_PUBLIC_LOCAL_ONLY=local\n')
  writeFileSync(path.join(root, '.env.development'), 'EXPO_PUBLIC_API_URL="https://dev.example.com/" # 개발 서버\nEXPO_PUBLIC_FEATURE=dev\n')
  writeFileSync(path.join(root, '.env.production'), 'EXPO_PUBLIC_API_URL=https://api.example.com\nEXPO_PUBLIC_FEATURE=prod\n')
  return root
}

test('선택한 환경 파일만 네이티브와 웹 빌드에 전달하고 다른 환경의 공개 값을 제거한다', (t) => {
  const root = createFixture(t)
  const inherited = { PATH: process.env.PATH, EXPO_PUBLIC_API_URL: 'https://old.example.com', EXPO_PUBLIC_OLD_ONLY: 'stale', VITE_API_URL: 'https://wrong.example.com' }
  const cases = [
    ['local', '.env', 'http://localhost:4000', '웨어룸(L)'],
    ['development', '.env.development', 'https://dev.example.com', '웨어룸(T)'],
    ['production', '.env.production', 'https://api.example.com', '웨어룸'],
  ]
  for (const [environment, file, apiUrl, name] of cases) {
    const { env, envFile, variant } = loadBuildEnvironment(environment, { root, inherited })
    assert.equal(envFile, file)
    assert.equal(variant.name, name)
    assert.equal(env.EXPO_PUBLIC_API_URL, apiUrl)
    assert.equal(env.VITE_API_URL, apiUrl)
    assert.equal(env.WEAROOM_APP_ENV, environment)
    assert.equal(env.EXPO_NO_DOTENV, '1')
    assert.equal(env.EXPO_PUBLIC_OLD_ONLY, undefined)
    if (environment !== 'local') assert.equal(env.EXPO_PUBLIC_LOCAL_ONLY, undefined)
    assert.equal(inherited.EXPO_PUBLIC_API_URL, 'https://old.example.com')
  }
})

test('운영 파일이 없거나 API 값이 비어 있으면 로컬 파일·상위 프로세스로 대체하지 않는다', (t) => {
  const root = createFixture(t)
  const options = { root, inherited: { EXPO_PUBLIC_API_URL: 'https://old.example.com' } }
  rmSync(path.join(root, '.env.production'))
  assert.throws(() => loadBuildEnvironment('production', options), /\.env\.production 파일이 없습니다/)
  writeFileSync(path.join(root, '.env.production'), 'EXPO_PUBLIC_API_URL=\n')
  assert.throws(() => loadBuildEnvironment('production', options), /\.env\.production에 EXPO_PUBLIC_API_URL/)
})

test('잘못된 API 주소나 앱 환경은 빌드 전에 거절한다', (t) => {
  const root = createFixture(t)
  for (const value of ['not-a-url', 'file:///tmp/api']) {
    writeFileSync(path.join(root, '.env.production'), `EXPO_PUBLIC_API_URL=${value}\n`)
    assert.throws(() => loadBuildEnvironment('production', { root }), /EXPO_PUBLIC_API_URL/)
  }
  assert.throws(() => loadBuildEnvironment('prodcution', { root }), /알 수 없는/)
})

test('Release 번들을 만드는 자식 프로세스에도 개발 파일의 값과 자동 병합 차단 옵션을 전달한다', (t) => {
  const root = createFixture(t)
  const { env } = loadBuildEnvironment('development', { root })
  const result = spawnSync(process.execPath, ['-e', 'console.log(JSON.stringify({ api: process.env.EXPO_PUBLIC_API_URL, webApi: process.env.VITE_API_URL, variant: process.env.WEAROOM_APP_ENV, autoLoad: process.env.EXPO_NO_DOTENV }))'], { env: { ...env, NODE_ENV: 'production' }, encoding: 'utf8' })
  assert.equal(result.status, 0)
  assert.deepEqual(JSON.parse(result.stdout), { api: 'https://dev.example.com', webApi: 'https://dev.example.com', variant: 'development', autoLoad: '1' })
})
