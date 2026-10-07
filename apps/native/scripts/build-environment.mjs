import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parseEnv } from 'node:util'
import { fileURLToPath } from 'node:url'
import { getAppVariant } from '../config/appVariant.cjs'

const nativeRoot = fileURLToPath(new URL('..', import.meta.url))
const envFiles = {
  local: '.env',
  development: '.env.development',
  production: '.env.production',
}

/**
 * 선택한 앱 환경의 파일 하나만 읽어 자식 빌드에 전달할 환경 변수를 만든다.
 * 파일 값이 상위 프로세스 값보다 우선하며, 다른 환경의 EXPO_PUBLIC_* 값은 가져오지 않는다.
 * API 주소가 없거나 잘못되면 빌드를 중단한다. Expo의 자동 파일 병합도 비활성화한다.
 */
export function loadBuildEnvironment(environment = 'local', { root = nativeRoot, inherited = process.env } = {}) {
  const variant = getAppVariant(environment)
  const envFile = envFiles[variant.environment]
  const envPath = path.join(root, envFile)
  let values
  try {
    values = parseEnv(readFileSync(envPath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`${envFile} 파일이 없습니다. apps/native/.env.example을 참고해 생성해주세요.`)
    throw error
  }

  const apiUrl = values.EXPO_PUBLIC_API_URL?.trim()
  if (!apiUrl) throw new Error(`${envFile}에 EXPO_PUBLIC_API_URL을 입력해주세요.`)
  let parsedUrl
  try {
    parsedUrl = new URL(apiUrl)
  } catch {
    throw new Error(`${envFile}의 EXPO_PUBLIC_API_URL이 올바른 URL이 아닙니다.`)
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error(`${envFile}의 EXPO_PUBLIC_API_URL은 http 또는 https 주소여야 합니다.`)
  }

  const base = Object.fromEntries(Object.entries(inherited).filter(([key]) => !key.startsWith('EXPO_PUBLIC_')))
  return {
    variant,
    envFile,
    env: {
      ...base,
      ...values,
      EXPO_PUBLIC_API_URL: apiUrl.replace(/\/+$/, ''),
      VITE_API_URL: apiUrl.replace(/\/+$/, ''),
      WEAROOM_APP_ENV: variant.environment,
      EXPO_NO_DOTENV: '1',
    },
  }
}
