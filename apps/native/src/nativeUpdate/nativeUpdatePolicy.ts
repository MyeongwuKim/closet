import * as SecureStore from "expo-secure-store";
const AsyncStorage = { getItem: SecureStore.getItemAsync, setItem: SecureStore.setItemAsync };
import { Platform } from "react-native";
import { NATIVE_UPDATE_CONFIG } from "../config/nativeUpdateConfig";
import { compareVersions } from "../version/compareVersions";

type NativeUpdatePlatform = "ios" | "android";

type NativeUpdatePlatformPolicy = {
  enabled: boolean;
  minimumVersion: string;
  storeUrl: string | null;
};

type NativeUpdatePolicyManifest = {
  schemaVersion: 1;
  channel: "dev" | "prod";
  platforms: Record<NativeUpdatePlatform, NativeUpdatePlatformPolicy>;
};

export type NativeUpdateRequirement = {
  currentVersion: string;
  minimumVersion: string;
  storeUrl: string;
};

const POLICY_FETCH_TIMEOUT_MS = 5_000;
const POLICY_STORAGE_KEY = `closet.native-update-policy.${NATIVE_UPDATE_CONFIG.appVariant}`;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isAllowedStoreUrl(value: string, platform: NativeUpdatePlatform) {
  try {
    const url = new URL(value);

    if (platform === "ios") {
      return (
        (url.protocol === "https:" &&
          (url.hostname === "apps.apple.com" ||
            url.hostname === "testflight.apple.com")) ||
        (url.protocol === "itms-apps:" &&
          (url.hostname === "apps.apple.com" ||
            url.hostname === "itunes.apple.com"))
      );
    }

    return (
      (url.protocol === "https:" && url.hostname === "play.google.com") ||
      url.protocol === "market:"
    );
  } catch {
    return false;
  }
}

function readPlatformPolicy(
  value: unknown,
  platform: NativeUpdatePlatform
): NativeUpdatePlatformPolicy | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const policy = value as Record<string, unknown>;
  const minimumVersion = readString(policy.minimumVersion);
  const storeUrl = readString(policy.storeUrl) || null;

  if (
    typeof policy.enabled !== "boolean" ||
    !VERSION_PATTERN.test(minimumVersion)
  ) {
    return null;
  }

  if (policy.enabled && (!storeUrl || !isAllowedStoreUrl(storeUrl, platform))) {
    return null;
  }

  return {
    enabled: policy.enabled,
    minimumVersion,
    storeUrl
  };
}

function readPolicyManifest(value: unknown): NativeUpdatePolicyManifest | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const manifest = value as Record<string, unknown>;
  const platforms =
    manifest.platforms && typeof manifest.platforms === "object"
      ? (manifest.platforms as Record<string, unknown>)
      : null;
  const channel =
    manifest.channel === "dev" || manifest.channel === "prod"
      ? manifest.channel
      : null;
  const ios = readPlatformPolicy(platforms?.ios, "ios");
  const android = readPlatformPolicy(platforms?.android, "android");

  if (
    manifest.schemaVersion !== 1 ||
    channel !== NATIVE_UPDATE_CONFIG.appVariant ||
    !ios ||
    !android
  ) {
    return null;
  }

  return {
    schemaVersion: 1,
    channel,
    platforms: {
      ios,
      android
    }
  };
}

async function fetchPolicyManifest() {
  if (!NATIVE_UPDATE_CONFIG.policyUrl) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), POLICY_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(NATIVE_UPDATE_CONFIG.policyUrl, {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Native update policy request failed: ${response.status}`);
    }

    const manifest = readPolicyManifest(await response.json());

    if (!manifest) {
      throw new Error("Native update policy is invalid.");
    }

    await AsyncStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(manifest));
    return manifest;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readCachedPolicyManifest() {
  try {
    const storedValue = await AsyncStorage.getItem(POLICY_STORAGE_KEY);
    return storedValue ? readPolicyManifest(JSON.parse(storedValue)) : null;
  } catch {
    return null;
  }
}

function getNativeUpdatePlatform(): NativeUpdatePlatform | null {
  return Platform.OS === "ios" || Platform.OS === "android"
    ? Platform.OS
    : null;
}

export async function resolveNativeUpdateRequirement(): Promise<NativeUpdateRequirement | null> {
  if (!NATIVE_UPDATE_CONFIG.checksEnabled) {
    return null;
  }

  const platform = getNativeUpdatePlatform();

  if (!platform) {
    return null;
  }

  let manifest: NativeUpdatePolicyManifest | null = null;

  try {
    manifest = await fetchPolicyManifest();
  } catch (error) {
    console.warn("[native-update] failed to fetch policy", error);
    manifest = await readCachedPolicyManifest();
  }

  const policy = manifest?.platforms[platform];

  if (
    !policy?.enabled ||
    !policy.storeUrl ||
    compareVersions(
      NATIVE_UPDATE_CONFIG.currentVersion,
      policy.minimumVersion
    ) >= 0
  ) {
    return null;
  }

  return {
    currentVersion: NATIVE_UPDATE_CONFIG.currentVersion,
    minimumVersion: policy.minimumVersion,
    storeUrl: policy.storeUrl
  };
}
