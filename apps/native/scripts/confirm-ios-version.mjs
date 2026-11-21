import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'

function numericVersion(value, label) {
  if (typeof value !== 'string' || !/^\d+\.\d+\.\d+$/.test(value)) throw new Error(`${label}은 x.y.z 형식이어야 합니다.`)
  return value.split('.').map(Number)
}

function meetsMinimum(version, minimum) {
  const current = numericVersion(version, '빌드할 앱 버전')
  const required = numericVersion(minimum, '최소 버전')
  for (let index = 0; index < 3; index++) {
    if (current[index] !== required[index]) return current[index] > required[index]
  }
  return true
}

/** Show only the selected channel's local JSON values; no R2/DB requests are made. */
export function formatIosVersionConfirmation(build, { policy, runtime, color = false }) {
  const channel = build.environment === 'production' ? 'prod' : 'dev'
  const compatible = meetsMinimum(build.version, runtime.minimumNativeVersion)
  const policyCompatible = meetsMinimum(build.version, policy.minimumVersion)
  const paint = (text, code = 36) => color ? `\u001b[${code}m${text}\u001b[0m` : text
  const row = (label, value) => {
    const width = [...label].reduce((sum, character) => sum + (character.charCodeAt(0) > 255 ? 2 : 1), 0)
    return `  ${label}${' '.repeat(Math.max(2, 26 - width))}${value}`
  }
  const line = paint('─'.repeat(52))
  const text = [
    '', line, paint(`  iOS 빌드 버전 확인 · ${channel}`), line,
    row('앱 이름', paint(build.name)),
    row('빌드할 앱 버전', paint(build.version)),
    row('앱 식별자', build.identifier), '',
    '  앱 업데이트 정책',
    row('최소 앱 버전', paint(policy.minimumVersion)),
    row('강제 업데이트', paint(policy.enabled ? '사용' : '미사용', 33)),
    row('스토어 URL', policy.storeUrl || '미설정'), '',
    '  웹 번들 호환 설정',
    row('최소 네이티브 버전', paint(runtime.minimumNativeVersion)),
    row('이 빌드의 호환 기준', paint(compatible ? '충족' : '미충족', compatible ? 32 : 31)), '',
    '  로컬 설정 파일 기준', line, '',
  ].join('\n')
  return { text, compatible, policyCompatible }
}

/** Release builds require an explicit answer before generation, provisioning or build work starts. */
export async function confirmIosVersion(build, { ask, input = process.stdin, output = process.stdout, policy, runtime } = {}) {
  if (build.environment === 'local') return true
  const channel = build.environment === 'production' ? 'prod' : 'dev'
  policy ??= JSON.parse(readFileSync(new URL('../minimum-app-versions.json', import.meta.url), 'utf8'))[channel].ios
  runtime ??= JSON.parse(readFileSync(new URL('../../../config/web-bundle-runtime.json', import.meta.url), 'utf8'))[channel]
  const summary = formatIosVersionConfirmation(build, { policy, runtime, color: Boolean(output.isTTY) && !process.env.NO_COLOR })
  output.write(summary.text)
  if (!summary.compatible) throw new Error('빌드할 앱 버전이 웹 번들 최소 네이티브 버전보다 낮습니다. 로컬 JSON 설정을 확인해주세요.')
  if (policy.enabled && !summary.policyCompatible) throw new Error('빌드할 앱 버전이 강제 업데이트 최소 앱 버전보다 낮습니다. 로컬 JSON 설정을 확인해주세요.')
  return confirmIosPrompt('이 설정으로 빌드를 진행할까요? (y/N) ', { ask, input, output })
}

/** 비대화형 터미널에서는 입력을 기다리지 않고 중단한다. */
export async function confirmIosPrompt(prompt, { ask, input = process.stdin, output = process.stdout } = {}) {
  if (ask) return /^(y|yes)$/i.test((await ask(prompt)).trim())
  if (!input.isTTY || !output.isTTY) throw new Error('dev/prod iOS 빌드는 터미널에서 버전을 확인해야 합니다. 대화형 터미널에서 다시 실행해주세요.')
  const readline = createInterface({ input, output })
  try { return /^(y|yes)$/i.test((await readline.question(prompt)).trim()) }
  finally { readline.close() }
}
