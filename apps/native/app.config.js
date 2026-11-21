const appVersions = require('./app-versions.json')
const runtimes = require('../../config/web-bundle-runtime.json')
const { getAppVariant } = require('./config/appVariant.cjs')

/** Expo의 기본 설정에 환경별 앱 이름과 고유 식별자를 반영한다. EAS 프로젝트 연결은 기본 설정을 유지한다. */
module.exports = ({ config }) => {
  const variant = getAppVariant(process.env.WEAROOM_APP_ENV)
  const channel = variant.environment === 'production' ? 'prod' : 'dev'
  const versions = appVersions[channel]
  const platform = (process.env.CLOSET_BUILD_PLATFORM || process.env.EAS_BUILD_PLATFORM) === 'android' ? 'android' : 'ios'
  if (!/^\d+\.\d+\.\d+$/.test(versions[platform])) throw new Error('앱 버전은 x.y.z 형식이어야 합니다.')
  const runtime = runtimes[channel]
  const baseUrl = process.env.EXPO_PUBLIC_WEB_BUNDLE_BASE_URL?.trim().replace(/\/+$/, '') || ''
  if (baseUrl && new URL(baseUrl).protocol !== 'https:') throw new Error('웹 번들 공개 주소는 HTTPS여야 합니다.')
  if (variant.environment !== 'local' && !baseUrl) throw new Error('선택한 앱 환경에 EXPO_PUBLIC_WEB_BUNDLE_BASE_URL을 설정해주세요.')
  const manifestPath = [runtime.prefix, 'latest/manifest.json'].filter(Boolean).join('/')
  const liveAdsAppId = process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID?.trim()
  if (liveAdsAppId && (!/^ca-app-pub-\d{16}~\d{10}$/.test(liveAdsAppId) || liveAdsAppId.startsWith('ca-app-pub-3940256099942544~'))) {
    throw new Error('EXPO_PUBLIC_ADMOB_IOS_APP_ID에는 실제 iOS AdMob 앱 ID를 입력해주세요. 테스트 ID는 설정 없이 자동 적용됩니다.')
  }
  return {
    ...config,
    name: variant.name,
    version: versions[platform],
    scheme: variant.scheme,
    ios: { ...config.ios, bundleIdentifier: variant.identifier },
    android: { ...config.android, package: variant.identifier },
    plugins: [...(config.plugins ?? []), ['./plugins/with-ios-build-identity.cjs', { schemeName: variant.xcodeScheme, productName: variant.xcodeProduct, version: versions.ios }], ['react-native-google-mobile-ads', {
      iosAppId: liveAdsAppId || 'ca-app-pub-3940256099942544~1458002511',
      androidAppId: 'ca-app-pub-3940256099942544~3347511713',
      delayAppMeasurementInit: true,
    }]],
    extra: { ...config.extra, appEnvironment: variant.environment,
      webBundleUpdatesEnabled: variant.environment !== 'local',
      webBundleBaseUrl: baseUrl,
      webBundleManifestUrl: baseUrl ? `${baseUrl}/${manifestPath}` : null,
      webBundleRuntimePrefix: runtime.prefix,
      nativeUpdatePolicyUrl: baseUrl ? `${baseUrl}/native/latest.json` : null,
      allowTestAdRewards: variant.environment !== 'production',
      liveAdRewardsEnabled: Boolean(liveAdsAppId),
    },
  }
}
