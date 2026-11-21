import { File } from 'expo-file-system'
import { Platform } from 'react-native'
import { WEB_BUNDLE_UPDATE_CONFIG as config } from '../config/webBundleUpdateConfig'
import { WEB_BUNDLE_BASE_URL, WEB_BUNDLE_HTML } from '../generated/webBundle'
import { fetchWebBundleManifest } from './webBundleManifest'
import { confirmWebBundleReady, installWebBundle, prepareWebBundleStorage, rollbackWebBundle } from './webBundleStorage'
import { isWebBundleCompatible, shouldInstallWebBundle } from './webBundleVersionChecker'
import type { InstalledWebBundle, ResolvedWebBundle, WebBundleProgress, WebBundleProgressReporter } from './webBundleTypes'

function embedded(): ResolvedWebBundle {
  return { key: 'embedded', kind: 'embedded', version: null, source: { html: WEB_BUNDLE_HTML, baseUrl: WEB_BUNDLE_BASE_URL }, pending: false, readySignalRequired: true }
}

function compatible(bundle: { minimumNativeVersion: string | null; version: string }) {
  return isWebBundleCompatible(bundle.minimumNativeVersion, config.nativeVersion, true) &&
    bundle.version.split('.').slice(0, 2).join('.') === config.nativeVersion.split('.').slice(0, 2).join('.')
}

async function installed(bundle: InstalledWebBundle): Promise<ResolvedWebBundle> {
  // The generator inlines modules, styles and assets. Execute the verified local
  // document with the existing origin so authentication and hash routing stay intact.
  const html = await new File(bundle.entryUri).text()
  return { key: `installed-${bundle.version}`, kind: 'installed', version: bundle.version, source: { html, baseUrl: WEB_BUNDLE_BASE_URL }, pending: bundle.pending, readySignalRequired: true }
}

async function resolveOnce(report?: WebBundleProgressReporter): Promise<ResolvedWebBundle> {
  let fallback = embedded()
  if (!config.updatesEnabled || !['ios', 'android'].includes(Platform.OS)) return fallback
  try {
    const snapshot = await prepareWebBundleStorage()
    const active = snapshot.active && compatible(snapshot.active) ? snapshot.active : null
    if (active) fallback = await installed(active)
    if (!config.manifestUrl) return fallback
    report?.({ stage: 'checking', progress: 0.16, message: '최신 버전을 확인하고 있어요.' })
    const manifest = await fetchWebBundleManifest(config.manifestUrl)
    if (!compatible(manifest) || !shouldInstallWebBundle({ manifest, currentWebVersion: active?.version ?? null, expectedChannel: config.channel, failedVersions: snapshot.failedVersions })) return fallback
    // Never bypass SHA verification by loading a remote HTML entry after failure.
    if (!config.publicOrigin || new URL(manifest.bundleUrl).origin !== config.publicOrigin) throw new Error('웹 번들 다운로드 주소가 설정과 다릅니다.')
    return await installed(await installWebBundle(manifest, report))
  } catch (error) {
    console.warn('[web-bundle] update failed; using previous bundle', error)
    return fallback
  }
}

export async function markResolvedWebBundleReady(bundle: ResolvedWebBundle) {
  if (bundle.kind === 'installed' && bundle.version && bundle.pending) await confirmWebBundleReady(bundle.version)
}

export async function rollbackResolvedWebBundle(bundle: ResolvedWebBundle) {
  if (bundle.kind !== 'installed' || !bundle.version) return embedded()
  const previous = await rollbackWebBundle(bundle.version)
  return previous && compatible(previous) ? installed(previous) : embedded()
}

export type { ResolvedWebBundle } from './webBundleTypes'

let inFlight: Promise<ResolvedWebBundle> | null = null
const reporters = new Set<WebBundleProgressReporter>()
let latestProgress: WebBundleProgress | null = null
export function resolveWebBundle(report?: WebBundleProgressReporter) {
  if (!inFlight) {
    latestProgress = null
    inFlight = Promise.resolve().then(() => resolveOnce(progress => {
      latestProgress = progress
      for (const listener of reporters) listener(progress)
    })).finally(() => { inFlight = null; latestProgress = null })
  }
  if (!report) return inFlight
  reporters.add(report)
  if (latestProgress) report(latestProgress)
  return inFlight.finally(() => { reporters.delete(report) })
}
