const { getAppVariant } = require('./config/appVariant.cjs')

/** Expo의 기본 설정에 환경별 앱 이름과 고유 식별자를 반영한다. EAS 프로젝트 연결은 기본 설정을 유지한다. */
module.exports = ({ config }) => {
  const variant = getAppVariant(process.env.WEAROOM_APP_ENV)
  return {
    ...config,
    name: variant.name,
    scheme: variant.scheme,
    ios: { ...config.ios, bundleIdentifier: variant.identifier },
    android: { ...config.android, package: variant.identifier },
    extra: { ...config.extra, appEnvironment: variant.environment },
  }
}
