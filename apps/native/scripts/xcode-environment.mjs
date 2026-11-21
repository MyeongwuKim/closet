import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const start = '# BEGIN WEARROOM BUILD ENVIRONMENT'
const end = '# END WEARROOM BUILD ENVIRONMENT'
const shellQuote = value => "'" + value.replaceAll("'", "'\\''") + "'"

/** Xcode가 별도 프로세스에서 빌드할 때 선택된 앱 환경과 공개 설정을 사용하게 한다. */
export function syncXcodeEnvironment(iosRoot, env) {
  const file = path.join(iosRoot, '.xcode.env')
  const current = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const publicEntries = Object.entries(env).filter(([name]) => /^EXPO_PUBLIC_[A-Za-z0-9_]+$/.test(name))
  const selected = [
    ['WEAROOM_APP_ENV', env.WEAROOM_APP_ENV],
    ['CLOSET_BUILD_PLATFORM', 'ios'],
    ['EXPO_NO_DOTENV', '1'],
    ['CLOSET_IOS_ISOLATED_WEB_BUNDLE', env.CLOSET_IOS_ISOLATED_WEB_BUNDLE ?? '0'],
    ...publicEntries,
  ]
  const block = [start, ...selected.map(([name, value]) => `export ${name}=${shellQuote(value)}`), end].join('\n')
  const previousBlock = new RegExp(`^${start}\\n[\\s\\S]*?^${end}\\n?`, 'm')
  const original = current.replace(previousBlock, '').trimEnd()
  writeFileSync(file, [original, block, ''].filter((line, index) => line || index > 0).join('\n'))
}
