const variants = {
  development: { name: 'wearroom(T)', identifier: 'com.myeongwu.wearoom.dev', scheme: 'wearoom-dev' },
  local: { name: 'wearroom(L)', identifier: 'com.myeongwu.wearoom.local', scheme: 'wearoom-local' },
  production: { name: 'wearroom', identifier: 'com.myeongwu.wearoom', scheme: 'wearoom' },
}

/** 빌드 환경별 표시 이름·iOS/Android 식별자·딥 링크 스킴을 반환한다. 잘못된 환경은 다른 앱으로 빌드하지 않고 거절한다. */
function getAppVariant(environment = 'local') {
  if (!Object.hasOwn(variants, environment)) throw new Error(`알 수 없는 wearroom 앱 환경: ${environment}`)
  return { environment, ...variants[environment] }
}

module.exports = { getAppVariant }
