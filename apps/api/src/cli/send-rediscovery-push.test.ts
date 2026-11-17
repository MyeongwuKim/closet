import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import type { Prisma, PrismaClient } from '@prisma/client'
import { loadRediscoveryPushTestEnvironment, parseRediscoveryPushTestArgs, runRediscoveryPushTest } from './send-rediscovery-push.js'

const options = { loginId: 'closet_test', environment: 'local' as const, execute: false }

function setup(t: TestContext) {
  const findAccount = t.mock.fn(async (loginId: string) => { assert.equal(loginId, options.loginId); return { loginId, userId: 'selected-owner' } })
  const countDevices = t.mock.fn(async (userId: string) => { assert.equal(userId, 'selected-owner'); return 2 })
  const send = t.mock.fn(async (userId: string) => { assert.equal(userId, 'selected-owner'); return true })
  return { findAccount, countDevices, send }
}

test('테스트 ID를 로그인과 같은 규칙으로 정규화하고 기본은 local·조회 모드다', () => {
  assert.deepEqual(parseRediscoveryPushTestArgs(['--login-id', ' Closet_Test ']), { help: false, ...options })
  assert.deepEqual(parseRediscoveryPushTestArgs(['--login-id=closet_test', '--env=development', '--execute']), { help: false, ...options, environment: 'development', execute: true })
  assert.deepEqual(parseRediscoveryPushTestArgs(['--help']), { help: true })
})

test('계정 누락·중복·불명확한 옵션은 발송이나 DB 조회 전에 거절한다', () => {
  for (const args of [[], ['--execute'], ['--login-id', '*'], ['--login-id', 'ab'],
    ['--login-id', 'a'.repeat(31)], ['--login-id', '테스트'],
    ['--login-id=first_user', '--login-id=other_user'], ['--login-id=closet_test', '--execute', '--execute'],
    ['--login-id=closet_test', '--all'], ['--login-id=closet_test', '--env=production'],
    ['--login-id=closet_test', 'other_user'], ['--login-id=closet_test', '--execute=false']]) {
    assert.throws(() => parseRediscoveryPushTestArgs(args), { code: 'INVALID_PUSH_TEST_ARGS' }, JSON.stringify(args))
  }
})

test('환경 파일은 공통과 선택한 파일만 읽고 셸 값이 있으면 우선한다', () => {
  const paths: string[] = []
  const environment: NodeJS.ProcessEnv = { INHERITED: 'from-shell' }
  loadRediscoveryPushTestEnvironment('development', environment, (path) => {
    paths.push(path)
    return path.endsWith('/.env')
      ? 'DATABASE_URL=mongodb://127.0.0.1/common_fixture\nINHERITED=from-common\nCOMMON_ONLY=yes\n'
      : 'DATABASE_URL=mongodb://127.0.0.1/development_fixture\nINHERITED=from-file\n'
  })
  assert.deepEqual(paths.map((path) => path.split('/').at(-1)), ['.env', '.env.development'])
  assert.equal(environment.DATABASE_URL, 'mongodb://127.0.0.1/development_fixture')
  assert.equal(environment.INHERITED, 'from-shell')
  assert.equal(environment.COMMON_ONLY, 'yes')
  const inherited = { DATABASE_URL: 'mongodb://127.0.0.1/shell_fixture' }
  loadRediscoveryPushTestEnvironment('local', inherited, () => 'DATABASE_URL=mongodb://127.0.0.1/file_fixture')
  assert.equal(inherited.DATABASE_URL, 'mongodb://127.0.0.1/shell_fixture')
})

test('선택한 환경 파일이 없으면 다른 환경으로 우회하거나 일부 값만 적용하지 않는다', () => {
  const paths: string[] = []
  const environment: NodeJS.ProcessEnv = {}
  assert.throws(() => loadRediscoveryPushTestEnvironment('local', environment, (path) => {
    paths.push(path)
    if (path.endsWith('/.env.local')) throw new Error('missing')
    return 'DATABASE_URL=mongodb://127.0.0.1/common_fixture'
  }), { code: 'PUSH_TEST_ENV_UNAVAILABLE' })
  assert.deepEqual(paths.map((path) => path.split('/').at(-1)), ['.env', '.env.local'])
  assert.deepEqual(environment, {})
  assert.throws(() => loadRediscoveryPushTestEnvironment('local', {}, () => ''), { code: 'PUSH_TEST_ENV_UNAVAILABLE' })
})

test('조회 모드는 지정한 계정·활성 기기 수만 확인하고 푸시를 보내지 않는다', async (t) => {
  const dependencies = setup(t)
  assert.deepEqual(await runRediscoveryPushTest(options, dependencies), { loginId: options.loginId, activeDeviceCount: 2, status: 'preview' })
  assert.equal(dependencies.findAccount.mock.callCount(), 1)
  assert.equal(dependencies.countDevices.mock.callCount(), 1)
  assert.equal(dependencies.send.mock.callCount(), 0)
})

test('명시적 발송은 지정한 기존 테스트 계정의 기기에 한 번만 요청한다', async (t) => {
  const dependencies = setup(t)
  const result = await runRediscoveryPushTest({ ...options, execute: true }, dependencies)
  assert.equal(result.status, 'accepted')
  assert.equal(dependencies.send.mock.callCount(), 1)
  assert.deepEqual(dependencies.send.mock.calls[0].arguments, ['selected-owner'])
})

test('존재하지 않는 테스트 ID는 계정을 생성하거나 다른 사용자에게 발송하지 않는다', async (t) => {
  const dependencies = setup(t)
  await assert.rejects(runRediscoveryPushTest({ ...options, execute: true }, { ...dependencies, findAccount: async () => null }), { code: 'PUSH_TEST_ACCOUNT_NOT_FOUND' })
  assert.equal(dependencies.countDevices.mock.callCount(), 0)
  assert.equal(dependencies.send.mock.callCount(), 0)
})

test('등록 기기가 없으면 조회 결과는 0대이고 명시적 발송은 거절한다', async (t) => {
  const dependencies = setup(t)
  const withoutDevices = { ...dependencies, countDevices: async () => 0 }
  assert.equal((await runRediscoveryPushTest(options, withoutDevices)).activeDeviceCount, 0)
  await assert.rejects(runRediscoveryPushTest({ ...options, execute: true }, withoutDevices), { code: 'PUSH_DEVICE_NOT_REGISTERED' })
  assert.equal(dependencies.send.mock.callCount(), 0)
})

test('발송 직전 로그아웃되거나 전송 오류가 나면 성공으로 표시하지 않는다', async (t) => {
  const dependencies = setup(t)
  await assert.rejects(runRediscoveryPushTest({ ...options, execute: true }, { ...dependencies, send: async () => false }), { code: 'PUSH_DEVICE_NOT_REGISTERED' })
  await assert.rejects(runRediscoveryPushTest({ ...options, execute: true }, { ...dependencies, send: async () => { throw new Error('mock delivery failure') } }), /mock delivery failure/)
})

test('테스트 계정 조회는 명시한 ID 한 개와 발송용 사용자 ID만 읽는다', async (t) => {
  const find = t.mock.fn(async (_args: Prisma.TestAccountFindUniqueArgs) => ({ loginId: options.loginId, userId: 'selected-owner' }))
  const scope = globalThis as typeof globalThis & { prisma?: PrismaClient }
  const previous = scope.prisma
  scope.prisma = { testAccount: { findUnique: find } } as unknown as PrismaClient
  t.after(() => { if (previous === undefined) delete scope.prisma; else scope.prisma = previous })
  const { pushDeviceRepository } = await import('../features/push/push.repository.js')
  assert.deepEqual(await pushDeviceRepository.findTestAccountTarget(options.loginId), { loginId: options.loginId, userId: 'selected-owner' })
  assert.deepEqual(find.mock.calls[0].arguments[0], { where: { loginId: options.loginId }, select: { loginId: true, userId: true } })
})
