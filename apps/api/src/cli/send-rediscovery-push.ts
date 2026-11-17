import { readFileSync } from 'node:fs'
import { parseArgs, parseEnv } from 'node:util'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ServiceError } from '../graphql/errors.js'

interface RediscoveryPushTestOptions {
  loginId: string
  environment: 'local' | 'development'
  execute: boolean
}

interface RediscoveryPushTestDependencies {
  findAccount: (loginId: string) => Promise<{ loginId: string; userId: string } | null>
  countDevices: (userId: string) => Promise<number>
  send: (userId: string) => Promise<boolean>
}

const usage = `사용법: pnpm api:push:rediscovery --login-id <테스트 ID> [--env local|development] [--execute]

기본 실행은 대상 계정과 활성 기기 수만 확인합니다. --execute를 붙이면 실제 푸시를 보냅니다.
기본 환경은 local이며 apps/api/.env와 .env.local을 읽습니다. --env development는 .env.development를 선택합니다.
수신 설정·주기·시간대·후보 유무를 건너뛰며 옷·착용 기록·발송 예약은 변경하지 않습니다.
알림을 누르면 실제 재발견 목록을 엽니다. 후보가 없으면 빈 상태가 표시됩니다.`

/** 테스트 로그인 ID 한 개와 명시한 환경·발송 여부만 받는다. 누락·중복·알 수 없는 옵션은 DB 조회 전에 거절한다. */
export function parseRediscoveryPushTestArgs(args: string[]): { help: true } | ({ help: false } & RediscoveryPushTestOptions) {
  let parsed: ReturnType<typeof parseArgs>
  try {
    parsed = parseArgs({ args, strict: true, allowPositionals: false, tokens: true, options: {
      'login-id': { type: 'string' }, env: { type: 'string' }, execute: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
    } })
  } catch {
    throw new ServiceError(usage, 'INVALID_PUSH_TEST_ARGS')
  }
  const seen = new Set<string>()
  for (const token of parsed.tokens ?? []) {
    if (token.kind !== 'option') continue
    if (seen.has(token.name)) throw new ServiceError(`중복 옵션을 확인해주세요: --${token.name}`, 'INVALID_PUSH_TEST_ARGS')
    seen.add(token.name)
  }
  if (parsed.values.help) return { help: true }
  const loginId = typeof parsed.values['login-id'] === 'string' ? parsed.values['login-id'].trim().toLowerCase() : ''
  if (!/^[a-z0-9._-]{3,30}$/.test(loginId)) throw new ServiceError(`올바른 --login-id가 필요해요.\n${usage}`, 'INVALID_PUSH_TEST_ARGS')
  const environment = parsed.values.env ?? 'local'
  if (environment !== 'local' && environment !== 'development') throw new ServiceError('--env는 local 또는 development여야 해요.', 'INVALID_PUSH_TEST_ARGS')
  return { help: false, loginId, environment, execute: parsed.values.execute === true }
}

/**
 * Prisma를 읽기 전에 공통 파일과 선택한 환경 파일 하나를 적용한다. 셸의 기존 값 > 환경별 파일 > 공통 파일 순이다.
 * 파일 누락 시 다른 환경으로 대체하지 않으며 도움말은 이 함수를 호출하지 않는다.
 */
export function loadRediscoveryPushTestEnvironment(
  environment: RediscoveryPushTestOptions['environment'],
  target: NodeJS.ProcessEnv = process.env,
  read: (path: string) => string = (path) => readFileSync(path, 'utf8'),
) {
  const names = ['.env', `.env.${environment}`]
  const sources = names.map((name) => {
    try { return parseEnv(read(fileURLToPath(new URL(`../../${name}`, import.meta.url)))) }
    catch { throw new ServiceError(`apps/api/${name} 환경 파일을 읽을 수 없어요.`, 'PUSH_TEST_ENV_UNAVAILABLE') }
  })
  const inherited = new Set(Object.keys(target).filter((key) => target[key] !== undefined))
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) if (!inherited.has(key)) target[key] = value
  }
  if (!target.DATABASE_URL?.trim()) throw new ServiceError('선택한 환경에 DATABASE_URL이 필요해요.', 'PUSH_TEST_ENV_UNAVAILABLE')
}

/** 지정한 기존 테스트 계정의 활성 기기를 확인한다. execute일 때만 기존 재발견 푸시를 한 번 요청하며 앱 데이터·예약·노출 이력은 건드리지 않는다. */
export async function runRediscoveryPushTest(options: RediscoveryPushTestOptions, dependencies: RediscoveryPushTestDependencies) {
  const account = await dependencies.findAccount(options.loginId)
  if (!account) throw new ServiceError('등록된 테스트 ID를 찾지 못했어요. 같은 환경의 앱에서 먼저 로그인해주세요.', 'PUSH_TEST_ACCOUNT_NOT_FOUND')
  const activeDeviceCount = await dependencies.countDevices(account.userId)
  if (options.execute) {
    if (!activeDeviceCount || !await dependencies.send(account.userId)) {
      throw new ServiceError('활성 로그인 기기가 없어요. 앱에서 해당 ID로 로그인하고 알림 권한을 허용한 뒤 앱을 다시 열어주세요.', 'PUSH_DEVICE_NOT_REGISTERED')
    }
  }
  return { loginId: account.loginId, activeDeviceCount, status: options.execute ? 'accepted' as const : 'preview' as const }
}

/** 환경 선택을 끝낸 뒤에만 DB·푸시 모듈을 읽는다. 조회 모드에서는 외부 전송을 하지 않고 모든 경로에서 DB 연결을 닫는다. */
async function main() {
  const options = parseRediscoveryPushTestArgs(process.argv.slice(2))
  if (options.help) { console.log(usage); return }
  loadRediscoveryPushTestEnvironment(options.environment)
  const [{ prisma }, { pushDeviceRepository }, { pushService }] = await Promise.all([
    import('../lib/prisma.js'), import('../features/push/push.repository.js'), import('../features/push/push.service.js'),
  ])
  try {
    const result = await runRediscoveryPushTest(options, {
      findAccount: (loginId) => pushDeviceRepository.findTestAccountTarget(loginId),
      countDevices: async (userId) => (await pushDeviceRepository.findActiveTokensForUser(userId)).length,
      send: (userId) => pushService.sendRediscovery(userId),
    })
    console.log(`환경: ${options.environment} | 테스트 ID: ${result.loginId} | 발송 전 활성 기기: ${result.activeDeviceCount}대`)
    console.log(result.status === 'accepted'
      ? 'Expo가 재발견 푸시 발송 요청을 접수했어요. 기기에서 수신한 알림을 눌러 목록 진입을 확인해주세요.'
      : `조회만 했어요. 실제 발송에는 --execute를 붙여주세요.${result.activeDeviceCount ? '' : ' 먼저 앱 로그인·알림 권한과 기기 등록을 확인해주세요.'}`)
  } finally { await prisma.$disconnect() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await main() }
  catch (error) {
    // DB 연결 문자열이나 푸시 토큰을 오류 로그에 남기지 않는다.
    console.error(error instanceof ServiceError ? error.message : '명령 실행에 실패했어요. 선택한 환경의 DB 연결과 Prisma Client 생성을 확인해주세요.')
    process.exitCode = 1
  }
}
