import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { presentRewardedAd, type RewardedAdResult } from './presentRewardedAd'

let presenting = false
let initialized = false

/** 빌드 환경과 실제 앱 ID 설정을 기준으로 iOS 광고 지원을 판정한다. 운영 빌드에서는 테스트 보상을 지원하지 않는다. */
export function supportsRewardedAds(mode?: string) {
  if (Platform.OS !== 'ios') return false
  const extra = Constants.expoConfig?.extra
  if (mode === 'production') return extra?.liveAdRewardsEnabled === true
  if (mode === 'test') return extra?.allowTestAdRewards === true
  return extra?.allowTestAdRewards === true || extra?.liveAdRewardsEnabled === true
}

/**
 * 사용자가 요청했을 때만 동의를 확인하고 네이티브 보상형 광고를 띄운다. 동시에 두 광고는 열지 않는다.
 * 광고에는 계정 정보 대신 서버 발급 번호만 전달하며, 이 함수는 생성권을 직접 지급하지 않는다.
 */
export async function showPreviewRewardedAd(session: { id: string; mode: string; adUnitId: string }): Promise<RewardedAdResult> {
  if (!supportsRewardedAds(session.mode)) return { status: 'unavailable', message: '이 앱에서는 광고 보상을 아직 사용할 수 없어요.' }
  if (presenting) return { status: 'unavailable', message: '이미 광고를 확인하고 있어요.' }
  presenting = true
  try {
    // SDK가 없는 이전 설치 앱에서도 앱 시작 자체가 실패하지 않도록 광고 요청 시 불러온다.
    const { default: mobileAds, AdsConsent, RewardedAd, RewardedAdEventType, AdEventType, TestIds } = await import('react-native-google-mobile-ads')
    try {
      const consent = await AdsConsent.gatherConsent()
      if (!consent.canRequestAds) return { status: 'unavailable', message: '광고 개인정보 설정을 확인한 뒤 다시 시도해 주세요.' }
    } catch {
      // Google의 공개 테스트 앱에는 운영 동의 양식이 없다. 실제 광고에서는 동의 조회 실패를 우회하지 않는다.
      if (session.mode !== 'test') return { status: 'unavailable', message: '광고 개인정보 설정을 불러오지 못했어요.' }
    }
    if (!initialized) { await mobileAds().initialize(); initialized = true }
    const ad = RewardedAd.createForAdRequest(session.mode === 'test' ? TestIds.REWARDED : session.adUnitId, {
      requestNonPersonalizedAdsOnly: true,
      serverSideVerificationOptions: { userId: session.id, customData: session.id },
    })
    return await presentRewardedAd({
      onLoaded: (callback) => ad.addAdEventListener(RewardedAdEventType.LOADED, callback),
      onEarned: (callback) => ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, callback),
      onClosed: (callback) => ad.addAdEventListener(AdEventType.CLOSED, callback),
      onError: (callback) => ad.addAdEventListener(AdEventType.ERROR, callback),
      load: () => ad.load(), show: () => ad.show(),
    })
  } catch {
    return { status: 'unavailable', message: '광고 기능을 실행하지 못했어요. 앱을 최신 빌드로 다시 설치한 뒤 확인해 주세요.' }
  } finally { presenting = false }
}

/** 필요한 지역에서는 Google 개인정보 선택 양식을 다시 연다. 사용자 추적 권한을 강제로 요청하지 않는다. */
export async function showAdPrivacyOptions() {
  const { AdsConsent, AdsConsentPrivacyOptionsRequirementStatus } = await import('react-native-google-mobile-ads')
  const info = await AdsConsent.requestInfoUpdate()
  if (info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED) await AdsConsent.showPrivacyOptionsForm()
}
