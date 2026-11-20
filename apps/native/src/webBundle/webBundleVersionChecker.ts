import type { WebBundleChannel, WebBundleManifest } from "./webBundleTypes";
import { compareVersions } from "../version/compareVersions";

export function compareWebBundleVersions(leftValue: string, rightValue: string) {
  return compareVersions(leftValue, rightValue);
}

/** 새 운영 경로에서는 최소 버전이 없는 기존 번들도 호환 후보에서 제외한다. */
export function isWebBundleCompatible(
  minimumNativeVersion: string | null,
  nativeVersion: string,
  requiresMinimumNativeVersion: boolean
) {
  if (minimumNativeVersion === null) {
    return !requiresMinimumNativeVersion;
  }

  return compareVersions(nativeVersion, minimumNativeVersion) >= 0;
}

export function shouldInstallWebBundle(options: {
  manifest: WebBundleManifest;
  currentWebVersion: string | null;
  expectedChannel: WebBundleChannel;
  failedVersions: readonly string[];
}) {
  const {
    manifest,
    currentWebVersion,
    expectedChannel,
    failedVersions
  } = options;
  const manifestChannel = manifest.channel ?? manifest.appVariant;

  if (manifestChannel !== expectedChannel) {
    return false;
  }

  if (failedVersions.includes(manifest.version)) {
    return false;
  }

  return (
    !currentWebVersion ||
    compareWebBundleVersions(manifest.version, currentWebVersion) > 0
  );
}
