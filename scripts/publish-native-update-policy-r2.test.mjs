import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, delimiter } from 'node:path'
import test from 'node:test'

function fixture(t, alter = () => {}) {
  const root = mkdtempSync(join(tmpdir(), 'closet-native-policy-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const policy = JSON.parse(readFileSync('apps/native/minimum-app-versions.json', 'utf8'))
  alter(policy)
  const configPath = join(root, 'policy.json')
  writeFileSync(configPath, JSON.stringify(policy))
  mkdirSync(join(root, 'bin'))
  const log = join(root, 'calls.jsonl')
  const aws = join(root, 'bin/aws')
  writeFileSync(aws, `#!/usr/bin/env node
const fs = require('node:fs'); const args = process.argv.slice(2);
fs.appendFileSync(process.env.TEST_LOG, JSON.stringify({args, manifest: JSON.parse(fs.readFileSync(args[2], 'utf8'))})+'\\n');
if(process.env.FAIL_RELEASE === '1' && args[3].includes('/releases/')) process.exit(1);
`)
  chmodSync(aws, 0o755)
  const env = { ...process.env, PATH: join(root, 'bin') + delimiter + process.env.PATH, TEST_LOG: log, CLOSET_MINIMUM_APP_VERSIONS_PATH: configPath, CLOSET_NATIVE_UPDATE_CHANNEL: 'dev', R2_ENDPOINT: 'https://test.r2.cloudflarestorage.com', R2_BUCKET_NAME: 'test-dev', R2_ACCESS_KEY_ID: 'test-id', R2_SECRET_ACCESS_KEY: 'test-key', FAIL_RELEASE: '0' }
  return {
    run: (args = [], extra = {}) => spawnSync(process.execPath, [resolve('scripts/publish-native-update-policy-r2.mjs'), ...args], { encoding: 'utf8', env: { ...env, ...extra } }),
    calls: () => readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse),
  }
}

test('disabled policies with unknown store URLs validate without uploading', t => {
  const f = fixture(t)
  assert.equal(f.run(['--validate-only']).status, 0)
})

test('enabled policies require the proper store URL before publishing', t => {
  for (const storeUrl of [null, 'https://example.test/app']) {
    const f = fixture(t, config => { config.dev.ios.enabled = true; config.dev.ios.storeUrl = storeUrl })
    const result = f.run()
    assert.equal(result.status, 1)
    assert.match(result.stderr, /storeUrl/)
  }
})

test('publishes channel policy history before latest; a failed history upload never switches latest', t => {
  const f = fixture(t)
  assert.equal(f.run().status, 0)
  const calls = f.calls()
  assert.equal(calls.length, 2)
  assert.match(calls[0].args[3], /native\/releases\//)
  assert.match(calls[1].args[3], /native\/latest.json$/)
  assert.equal(calls[1].manifest.channel, 'dev')
  const failed = fixture(t)
  assert.equal(failed.run([], { FAIL_RELEASE: '1' }).status, 1)
  assert.equal(failed.calls().length, 1)
})

test('policy publisher normalizes an endpoint containing the bucket name', t => {
  const f = fixture(t);
  const result = f.run([], { R2_ENDPOINT: 'https://test.r2.cloudflarestorage.com/test-dev/' });
  assert.equal(result.status, 0, result.stderr);
  for (const { args } of f.calls()) assert.equal(args[args.indexOf('--endpoint-url') + 1], 'https://test.r2.cloudflarestorage.com');
});
