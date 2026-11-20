import Constants from 'expo-constants'
import { nativeApplicationVersion } from 'expo-application'

const extra = Constants.expoConfig?.extra ?? {}
const environment = extra.appEnvironment ?? 'local'
const channel = environment === 'production' ? 'prod' : 'dev'
const manifestUrl = typeof extra.webBundleManifestUrl === 'string' ? extra.webBundleManifestUrl : null
const publicBaseUrl = typeof extra.webBundleBaseUrl === 'string' ? extra.webBundleBaseUrl : ''

export const WEB_BUNDLE_UPDATE_CONFIG = {
  appVariant: channel,
  channel,
  manifestUrl,
  publicBaseUrl,
  publicOrigin: publicBaseUrl ? new URL(publicBaseUrl).origin : null,
  updatesEnabled: environment !== 'local' && extra.webBundleUpdatesEnabled === true,
  requiresMinimumNativeVersion: true,
  runtimePrefix: String(extra.webBundleRuntimePrefix ?? ''),
  nativeVersion: nativeApplicationVersion ?? Constants.expoConfig?.version ?? '0.0.0',
} as const
