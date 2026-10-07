const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const config = getDefaultConfig(__dirname)
const defaultResolveRequest = config.resolver.resolveRequest

/**
 * Expo 54의 개발용 환경 모듈은 EXPO_NO_DOTENV 설정과 무관하게 환경 파일을 병합한다.
 * 이미 실행 스크립트에서 선택한 환경만 유지하도록 해당 모듈을 프로세스 공개 값에 연결한다.
 * 나머지 모듈은 기존 Expo·Metro 해석 경로를 그대로 사용한다.
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'expo/virtual/env') {
    return {
      type: 'sourceFile',
      filePath: path.join(__dirname, 'config/publicEnvironment.cjs'),
    }
  }

  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform)
}

module.exports = config
