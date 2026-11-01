const { getAppVariant } = require('./config/appVariant.cjs')

/** Expo의 기본 설정에 환경별 앱 이름과 고유 식별자를 반영한다. EAS 프로젝트 연결은 기본 설정을 유지한다. */
module.exports = ({ config }) => {
  const variant = getAppVariant(process.env.WEAROOM_APP_ENV)
  const liveAdsAppId = process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID?.trim()
  if (liveAdsAppId && (!/^ca-app-pub-\d{16}~\d{10}$/.test(liveAdsAppId) || liveAdsAppId.startsWith('ca-app-pub-3940256099942544~'))) {
    throw new Error('EXPO_PUBLIC_ADMOB_IOS_APP_ID에는 실제 iOS AdMob 앱 ID를 입력해주세요. 테스트 ID는 설정 없이 자동 적용됩니다.')
  }
  return {
    ...config,
    name: variant.name,
    scheme: variant.scheme,
    ios: { ...config.ios, bundleIdentifier: variant.identifier },
    android: { ...config.android, package: variant.identifier },
    plugins: [...(config.plugins ?? []), ['react-native-google-mobile-ads', {
      iosAppId: liveAdsAppId || 'ca-app-pub-3940256099942544~1458002511',
      androidAppId: 'ca-app-pub-3940256099942544~3347511713',
      delayAppMeasurementInit: true,
    }]],
    extra: { ...config.extra, appEnvironment: variant.environment,
      allowTestAdRewards: variant.environment !== 'production',
      liveAdRewardsEnabled: Boolean(liveAdsAppId),
    },
  }
}
