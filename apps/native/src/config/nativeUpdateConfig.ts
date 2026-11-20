import Constants from 'expo-constants'
import { WEB_BUNDLE_UPDATE_CONFIG as bundle } from './webBundleUpdateConfig'

export const NATIVE_UPDATE_CONFIG = {
  appVariant: bundle.channel,
  checksEnabled: bundle.updatesEnabled,
  currentVersion: bundle.nativeVersion,
  policyUrl: typeof Constants.expoConfig?.extra?.nativeUpdatePolicyUrl === 'string'
    ? Constants.expoConfig.extra.nativeUpdatePolicyUrl : null,
} as const
