import { CryptoDigestAlgorithm, digest } from "expo-crypto";
import { fetch as nativeFetch } from "expo/fetch";
import { Directory, File, Paths } from "expo-file-system";
import { unzipSync } from "fflate";
import { WEB_BUNDLE_UPDATE_CONFIG } from "../config/webBundleUpdateConfig";
import type {
  InstalledWebBundle,
  WebBundleManifest,
  WebBundleProgressReporter
} from "./webBundleTypes";
import {
  FatalWebBundleInstallError,
  type WebBundleFatalInstallReason
} from "./webBundleErrors";
import { emitWebBundleProgress } from "./webBundleProgress";

type StoredBundleRecord = {
  version: string;
  minimumNativeVersion: string | null;
  entryPath: string;
  entryUrl: string | null;
  sha256: string;
  readySignalRequired: boolean;
};

type WebBundleState = {
  schemaVersion: 1;
  active: StoredBundleRecord | null;
  previous: StoredBundleRecord | null;
  pendingVersion: string | null;
  pendingAttempts: number;
  failedVersions: string[];
};

export type WebBundleStorageSnapshot = {
  active: InstalledWebBundle | null;
  failedVersions: string[];
};

// 앱을 구버전으로 되돌려도 이전 앱이 새 운영 번들을 캐시에서 열지 않도록 분리한다.
const STORAGE_DIRECTORY_NAME = `closet-web-bundles-${WEB_BUNDLE_UPDATE_CONFIG.channel}-${WEB_BUNDLE_UPDATE_CONFIG.runtimePrefix.replaceAll("/", "-") || "default"}`;
const STATE_FILE_NAME = "state.json";
const MAX_DOWNLOAD_BYTES = 30 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 150 * 1024 * 1024;
const MAX_EXTRACTED_FILES = 5_000;
const DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_FAILED_VERSIONS = 10;
const WEB_BUNDLE_INSTALL_ATTEMPTS = 3;
let stateMutationQueue: Promise<unknown> = Promise.resolve();

class WebBundleInstallAttemptError extends Error {
  readonly reason: WebBundleFatalInstallReason;
  readonly cause: unknown;

  constructor(reason: WebBundleFatalInstallReason, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "WebBundleInstallAttemptError";
    this.reason = reason;
    this.cause = cause;
  }
}

function runStateMutation<T>(mutation: () => Promise<T>) {
  const result = stateMutationQueue.then(mutation, mutation);
  stateMutationQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function createEmptyState(): WebBundleState {
  return {
    schemaVersion: 1,
    active: null,
    previous: null,
    pendingVersion: null,
    pendingAttempts: 0,
    failedVersions: []
  };
}

function getStorageDirectory() {
  return new Directory(Paths.document, STORAGE_DIRECTORY_NAME);
}

function getReleasesDirectory() {
  return new Directory(getStorageDirectory(), "releases");
}

function getDownloadDirectory() {
  return new Directory(Paths.cache, STORAGE_DIRECTORY_NAME);
}

function ensureStorageDirectories() {
  getStorageDirectory().create({ idempotent: true, intermediates: true });
  getReleasesDirectory().create({ idempotent: true, intermediates: true });
  getDownloadDirectory().create({ idempotent: true, intermediates: true });
}

function readStoredBundleRecord(value: unknown): StoredBundleRecord | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Partial<StoredBundleRecord>;

  if (
    typeof record.version !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(record.version) ||
    typeof record.entryPath !== "string" ||
    !record.entryPath ||
    record.entryPath.startsWith("/") ||
    record.entryPath.split("/").includes("..") ||
    typeof record.sha256 !== "string" ||
    !/^[0-9a-f]{64}$/i.test(record.sha256)
  ) {
    return null;
  }

  return {
    version: record.version,
    minimumNativeVersion: typeof record.minimumNativeVersion === "string" &&
      /^\d+\.\d+\.\d+$/.test(record.minimumNativeVersion)
      ? record.minimumNativeVersion
      : null,
    entryPath: record.entryPath,
    entryUrl: readStoredEntryUrl(record.entryUrl),
    sha256: record.sha256,
    readySignalRequired: record.readySignalRequired === true
  };
}

function readStoredEntryUrl(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value);
    const isLocalDevelopmentUrl =
      __DEV__ &&
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");

    if (url.protocol !== "https:" && !isLocalDevelopmentUrl) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

async function readState(): Promise<WebBundleState> {
  ensureStorageDirectories();
  let stateFile = new File(getStorageDirectory(), STATE_FILE_NAME);
  // SDK 54 move has no overwrite option. A completed temporary write recovers
  // a process exit between deleting the old state file and moving the new one.
  if (!stateFile.exists) stateFile = new File(getStorageDirectory(), STATE_FILE_NAME + '.tmp');
  if (!stateFile.exists) return createEmptyState();

  try {
    const value = JSON.parse(await stateFile.text()) as Partial<WebBundleState>;

    if (value.schemaVersion !== 1) {
      return createEmptyState();
    }

    const active = readStoredBundleRecord(value.active);
    const previous = readStoredBundleRecord(value.previous);

    return {
      schemaVersion: 1,
      active,
      previous,
      pendingVersion:
        typeof value.pendingVersion === "string" ? value.pendingVersion : null,
      pendingAttempts:
        typeof value.pendingAttempts === "number" && value.pendingAttempts >= 0
          ? Math.floor(value.pendingAttempts)
          : 0,
      failedVersions: Array.isArray(value.failedVersions)
        ? value.failedVersions.filter(
            (version): version is string =>
              typeof version === "string" &&
              /^\d+\.\d+\.\d+$/.test(version)
          )
        : []
    };
  } catch (error) {
    console.warn("[web-bundle] failed to read update state", error);
    return createEmptyState();
  }
}

async function writeState(state: WebBundleState) {
  ensureStorageDirectories();
  const storageDirectory = getStorageDirectory();
  const stateFile = new File(storageDirectory, STATE_FILE_NAME);
  const temporaryFile = new File(storageDirectory, `${STATE_FILE_NAME}.tmp`);

  temporaryFile.create({ intermediates: true, overwrite: true });
  temporaryFile.write(JSON.stringify(state));
  if (stateFile.exists) stateFile.delete();
  temporaryFile.move(stateFile);
}

function getReleaseDirectory(version: string) {
  return new Directory(getReleasesDirectory(), version);
}

function resolveInstalledBundle(
  record: StoredBundleRecord | null,
  pendingVersion: string | null
): InstalledWebBundle | null {
  if (!record) {
    return null;
  }

  const directory = getReleaseDirectory(record.version);
  const entryFile = new File(directory, ...record.entryPath.split("/"));

  if (!directory.exists || !entryFile.exists) {
    return null;
  }

  return {
    ...record,
    entryUri: entryFile.uri,
    directoryUri: directory.uri,
    pending: pendingVersion === record.version
  };
}

function appendFailedVersion(state: WebBundleState, version: string) {
  state.failedVersions = [
    version,
    ...state.failedVersions.filter((failedVersion) => failedVersion !== version)
  ].slice(0, MAX_FAILED_VERSIONS);
}

async function repairMissingActiveBundle(state: WebBundleState) {
  if (!state.active || resolveInstalledBundle(state.active, null)) {
    return state;
  }

  appendFailedVersion(state, state.active.version);
  state.active = resolveInstalledBundle(state.previous, null)
    ? state.previous
    : null;
  state.previous = null;
  state.pendingVersion = null;
  state.pendingAttempts = 0;
  await writeState(state);
  return state;
}

export async function prepareWebBundleStorage(): Promise<WebBundleStorageSnapshot> {
  let state = await repairMissingActiveBundle(await readState());

  if (
    state.active &&
    state.pendingVersion === state.active.version &&
    state.pendingAttempts >= 1
  ) {
    const failedVersion = state.active.version;
    appendFailedVersion(state, failedVersion);
    state.active = resolveInstalledBundle(state.previous, null)
      ? state.previous
      : null;
    state.previous = null;
    state.pendingVersion = null;
    state.pendingAttempts = 0;
    await writeState(state);

    const failedDirectory = getReleaseDirectory(failedVersion);

    if (failedDirectory.exists) {
      failedDirectory.delete();
    }
  } else if (
    state.active &&
    state.pendingVersion === state.active.version
  ) {
    state.pendingAttempts += 1;
    await writeState(state);
  }

  state = await repairMissingActiveBundle(state);

  return {
    active: resolveInstalledBundle(state.active, state.pendingVersion),
    failedVersions: [...state.failedVersions]
  };
}

function bytesToHex(value: ArrayBuffer) {
  return Array.from(new Uint8Array(value), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function copyBytesToUint8Array(value: Uint8Array) {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy;
}

function readSafeZipPath(value: string) {
  const normalized = value.replace(/\\/g, "/").replace(/^\.\//, "");

  if (
    !normalized ||
    normalized.length > 512 ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalized)
  ) {
    throw new Error(`Unsafe web bundle ZIP path: ${value}`);
  }

  const segments = normalized.split("/").filter(Boolean);

  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Unsafe web bundle ZIP path: ${value}`);
  }

  return segments;
}

function extractBundle(bundleBytes: Uint8Array, stagingDirectory: Directory) {
  let fileCount = 0;
  let declaredBytes = 0;
  const entries = Object.entries(unzipSync(bundleBytes, {
    filter(file) {
      readSafeZipPath(file.name);
      fileCount += 1;
      declaredBytes += file.originalSize;
      if (fileCount > MAX_EXTRACTED_FILES || declaredBytes > MAX_EXTRACTED_BYTES) {
        throw new Error('Web bundle ZIP exceeds extraction limits.');
      }
      return true;
    }
  }));

  if (entries.length > MAX_EXTRACTED_FILES) {
    throw new Error("Web bundle ZIP contains too many files.");
  }

  let extractedBytes = 0;

  for (const [entryName, contents] of entries) {
    if (
      entryName.startsWith("__MACOSX/") ||
      entryName.endsWith("/.DS_Store") ||
      entryName === ".DS_Store"
    ) {
      continue;
    }

    const segments = readSafeZipPath(entryName);

    if (entryName.endsWith("/")) {
      new Directory(stagingDirectory, ...segments).create({
        idempotent: true,
        intermediates: true
      });
      continue;
    }

    extractedBytes += contents.byteLength;

    if (extractedBytes > MAX_EXTRACTED_BYTES) {
      throw new Error("Web bundle ZIP is too large after extraction.");
    }

    const file = new File(stagingDirectory, ...segments);
    file.create({ intermediates: true, overwrite: true });
    file.write(contents);
  }
}

function getInstallAttemptProgressMessage(
  reason: WebBundleFatalInstallReason,
  attempt: number
) {
  const suffix = ` (${attempt}/${WEB_BUNDLE_INSTALL_ATTEMPTS})`;

  if (reason === "download") {
    return `업데이트를 내려받고 있어요.${suffix}`;
  }

  if (reason === "verify") {
    return `업데이트 파일을 확인하고 있어요.${suffix}`;
  }

  return `업데이트 압축을 풀고 있어요.${suffix}`;
}

function getFatalInstallMessage(reason: WebBundleFatalInstallReason) {
  if (reason === "download") {
    return "업데이트 파일을 3번 시도했지만 내려받지 못했어요.";
  }

  if (reason === "verify") {
    return "업데이트 파일을 3번 시도했지만 확인하지 못했어요.";
  }

  return "업데이트 압축을 3번 시도했지만 풀지 못했어요.";
}

function deleteFileIfExists(file: File) {
  if (file.exists) {
    file.delete();
  }
}

function deleteDirectoryIfExists(directory: Directory) {
  if (directory.exists) {
    directory.delete();
  }
}

async function runWebBundleInstallAttempt({
  downloadFile,
  manifest,
  reportProgress,
  stagingDirectory,
  attempt
}: {
  downloadFile: File;
  manifest: WebBundleManifest;
  reportProgress?: WebBundleProgressReporter;
  stagingDirectory: Directory;
  attempt: number;
}) {
  deleteFileIfExists(downloadFile);
  deleteDirectoryIfExists(stagingDirectory);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    emitWebBundleProgress(reportProgress, {
      stage: "downloading",
      progress: 0.26,
      message: getInstallAttemptProgressMessage("download", attempt)
    });

    try {
      const response = await nativeFetch(manifest.bundleUrl, { signal: controller.signal });
      if (!response.ok) throw new Error('Web bundle download failed (' + response.status + ').');
      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength > MAX_DOWNLOAD_BYTES) throw new Error('Web bundle ZIP is too large.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > MAX_DOWNLOAD_BYTES) throw new Error('Web bundle ZIP is too large.');
      downloadFile.create({ intermediates: true, overwrite: true });
      downloadFile.write(bytes);

      if (downloadFile.size <= 0 || downloadFile.size > MAX_DOWNLOAD_BYTES) {
        throw new Error("Downloaded web bundle ZIP has an invalid size.");
      }
    } catch (error) {
      throw new WebBundleInstallAttemptError("download", error);
    }

    emitWebBundleProgress(reportProgress, {
      stage: "verifying",
      progress: 0.68,
      message: getInstallAttemptProgressMessage("verify", attempt)
    });

    let bundleBytes: Uint8Array;

    try {
      bundleBytes = await downloadFile.bytes();
      const actualSha256 = bytesToHex(
        await digest(
          CryptoDigestAlgorithm.SHA256,
          copyBytesToUint8Array(bundleBytes)
        )
      );

      if (actualSha256 !== manifest.sha256) {
        throw new Error(
          "Downloaded web bundle SHA-256 does not match manifest."
        );
      }
    } catch (error) {
      throw new WebBundleInstallAttemptError("verify", error);
    }

    emitWebBundleProgress(reportProgress, {
      stage: "extracting",
      progress: 0.76,
      message: getInstallAttemptProgressMessage("extract", attempt)
    });

    try {
      stagingDirectory.create({ intermediates: true });
      extractBundle(bundleBytes, stagingDirectory);

      const stagedEntryFile = new File(
        stagingDirectory,
        ...manifest.entryPath.split("/")
      );

      if (!stagedEntryFile.exists) {
        throw new Error(
          `Web bundle entry file is missing: ${manifest.entryPath}`
        );
      }
    } catch (error) {
      throw new WebBundleInstallAttemptError("extract", error);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

async function stageWebBundleWithRetries({
  downloadFile,
  manifest,
  reportProgress,
  stagingDirectory
}: {
  downloadFile: File;
  manifest: WebBundleManifest;
  reportProgress?: WebBundleProgressReporter;
  stagingDirectory: Directory;
}) {
  let lastFailure: WebBundleInstallAttemptError | null = null;

  for (let attempt = 1; attempt <= WEB_BUNDLE_INSTALL_ATTEMPTS; attempt += 1) {
    try {
      await runWebBundleInstallAttempt({
        downloadFile,
        manifest,
        reportProgress,
        stagingDirectory,
        attempt
      });
      return;
    } catch (error) {
      const failure =
        error instanceof WebBundleInstallAttemptError
          ? error
          : new WebBundleInstallAttemptError("download", error);
      lastFailure = failure;
      console.warn(
        `[web-bundle] install attempt ${attempt}/${WEB_BUNDLE_INSTALL_ATTEMPTS} failed`,
        failure.cause
      );
      deleteFileIfExists(downloadFile);
      deleteDirectoryIfExists(stagingDirectory);
    }
  }

  const reason = lastFailure?.reason ?? "download";

  throw new FatalWebBundleInstallError(
    getFatalInstallMessage(reason),
    reason,
    lastFailure?.cause ?? lastFailure
  );
}

export async function installWebBundle(
  manifest: WebBundleManifest,
  reportProgress?: WebBundleProgressReporter
) {
  ensureStorageDirectories();
  const downloadFile = new File(
    getDownloadDirectory(),
    `${manifest.version}.zip`
  );
  const stagingDirectory = new Directory(
    getReleasesDirectory(),
    `.staging-${manifest.version}`
  );
  const releaseDirectory = getReleaseDirectory(manifest.version);
  let activated = false;
  let promoted = false;

  try {
    await stageWebBundleWithRetries({
      downloadFile,
      manifest,
      reportProgress,
      stagingDirectory
    });

    emitWebBundleProgress(reportProgress, {
      stage: "applying",
      progress: 0.86,
      message: "새 버전을 적용하고 있어요."
    });

    if (releaseDirectory.exists) {
      releaseDirectory.delete();
    }

    stagingDirectory.rename(manifest.version);
    promoted = true;

    const state = await readState();
    state.previous = state.active;
    state.active = {
      version: manifest.version,
      minimumNativeVersion: manifest.minimumNativeVersion,
      entryPath: manifest.entryPath,
      entryUrl: manifest.entryUrl,
      sha256: manifest.sha256,
      readySignalRequired: manifest.readySignalRequired
    };
    state.pendingVersion = manifest.version;
    state.pendingAttempts = 0;
    state.failedVersions = state.failedVersions.filter(
      (version) => version !== manifest.version
    );
    await writeState(state);
    activated = true;

    const installedBundle = resolveInstalledBundle(
      state.active,
      state.pendingVersion
    );

    if (!installedBundle) {
      throw new Error("Installed web bundle could not be activated.");
    }

    emitWebBundleProgress(reportProgress, {
      stage: "applying",
      progress: 0.91,
      message: "새 버전을 적용하고 있어요."
    });

    return installedBundle;
  } finally {
    deleteFileIfExists(downloadFile);

    if (!activated && stagingDirectory.exists) {
      stagingDirectory.delete();
    }

    if (!activated && promoted && releaseDirectory.exists) {
      releaseDirectory.delete();
    }
  }
}

function pruneUnusedReleases(state: WebBundleState) {
  const releasesDirectory = getReleasesDirectory();
  const retainedVersions = new Set(
    [state.active?.version, state.previous?.version].filter(
      (version): version is string => Boolean(version)
    )
  );

  for (const entry of releasesDirectory.list()) {
    if (entry instanceof Directory) {
      const version = entry.uri.replace(/\/$/, "").split("/").pop() ?? "";

      if (!retainedVersions.has(version)) {
        entry.delete();
      }
    }
  }
}

export function confirmWebBundleReady(version: string) {
  return runStateMutation(async () => {
    const state = await readState();

    if (state.active?.version !== version) {
      return;
    }

    state.pendingVersion = null;
    state.pendingAttempts = 0;
    state.failedVersions = state.failedVersions.filter(
      (failedVersion) => failedVersion !== version
    );
    await writeState(state);
    pruneUnusedReleases(state);
  });
}

export function rollbackWebBundle(version: string) {
  return runStateMutation(async () => {
    const state = await readState();

    if (state.active?.version !== version) {
      return resolveInstalledBundle(state.active, state.pendingVersion);
    }

    appendFailedVersion(state, version);
    state.active = resolveInstalledBundle(state.previous, null)
      ? state.previous
      : null;
    state.previous = null;
    state.pendingVersion = null;
    state.pendingAttempts = 0;
    await writeState(state);

    const failedDirectory = getReleaseDirectory(version);

    if (failedDirectory.exists) {
      failedDirectory.delete();
    }

    return resolveInstalledBundle(state.active, null);
  });
}
