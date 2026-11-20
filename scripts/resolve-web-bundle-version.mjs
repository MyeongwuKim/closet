#!/usr/bin/env node

import { appendFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import webBundleRuntime from "../config/web-bundle-runtime.json" with { type: "json" };

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const appVersionsPath = resolve(
  repositoryRoot,
  "apps/native/app-versions.json"
);

export function parseNumericVersion(value, label = "version") {
  const normalized = typeof value === "string" ? value.trim() : "";
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)$/);

  if (!match) {
    throw new Error(`${label} must use the numeric x.y.z format.`);
  }

  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
    value: normalized
  };
}

function compareVersions(left, right) {
  for (const key of ["major", "minor", "patch"]) {
    if (left[key] !== right[key]) {
      return left[key] > right[key] ? 1 : -1;
    }
  }

  return 0;
}

function compareVersionSeries(left, right) {
  if (left.major !== right.major) {
    return left.major > right.major ? 1 : -1;
  }

  if (left.minor !== right.minor) {
    return left.minor > right.minor ? 1 : -1;
  }

  return 0;
}

/** 발행 경로에 참여하는 앱의 버전 계열을 계산한다. 구형 운영 앱은 기존 R2 경로에 남는다. */
export function resolveNativeVersionSeries(appVersions, channel) {
  const channelVersions = appVersions?.[channel];

  if (!channelVersions || typeof channelVersions !== "object") {
    throw new Error(`Missing native app versions for the ${channel} channel.`);
  }

  const iosVersion = parseNumericVersion(
    channelVersions.ios,
    `${channel}.ios native version`
  );
  const androidVersion = parseNumericVersion(
    channelVersions.android,
    `${channel}.android native version`
  );

  const minVersion = parseNumericVersion(webBundleRuntime.prod.minimumNativeVersion);
  const participants = channel === "prod"
    ? [iosVersion, androidVersion].filter(version => compareVersions(version, minVersion) >= 0)
    : [iosVersion, androidVersion];
  const firstVersion = participants[0];
  if (!firstVersion) {
    throw new Error(`No production native app meets the ${minVersion.value} web bundle minimum.`);
  }
  if (participants.some(version => compareVersionSeries(firstVersion, version) !== 0)) {
    throw new Error(
      `${channel} iOS and Android native versions must share the same major/minor before publishing one shared web bundle. Received ${iosVersion.value} and ${androidVersion.value}.`
    );
  }

  return {
    major: firstVersion.major,
    minor: firstVersion.minor
  };
}

export function resolveWebBundleVersion({
  nativeSeries,
  latestVersion,
  requestedVersion
}) {
  const baseVersion = {
    major: nativeSeries.major,
    minor: nativeSeries.minor,
    patch: 0
  };
  const latest = latestVersion
    ? parseNumericVersion(latestVersion, "latest web bundle version")
    : null;

  if (requestedVersion?.trim()) {
    const requested = parseNumericVersion(
      requestedVersion,
      "requested web bundle version"
    );

    if (compareVersionSeries(requested, baseVersion) !== 0) {
      throw new Error(
        `Requested web bundle version ${requested.value} must match native version series ${nativeSeries.major}.${nativeSeries.minor}.x.`
      );
    }

    if (latest && compareVersions(requested, latest) <= 0) {
      throw new Error(
        `Requested web bundle version ${requested.value} must be newer than ${latest.value}.`
      );
    }

    return requested.value;
  }

  if (!latest) {
    return `${nativeSeries.major}.${nativeSeries.minor}.0`;
  }

  const seriesComparison = compareVersionSeries(latest, baseVersion);

  if (seriesComparison > 0) {
    throw new Error(
      `Native version series ${nativeSeries.major}.${nativeSeries.minor}.x is older than the latest web bundle ${latest.value}.`
    );
  }

  if (seriesComparison < 0) {
    return `${nativeSeries.major}.${nativeSeries.minor}.0`;
  }

  return `${nativeSeries.major}.${nativeSeries.minor}.${latest.patch + 1}`;
}

async function readLatestWebBundleVersion(publicBaseUrl, channel) {
  const manifestPath = [webBundleRuntime[channel].prefix, "latest/manifest.json"]
    .filter(Boolean)
    .join("/");
  const manifestUrl = `${publicBaseUrl.replace(/\/+$/g, "")}/${manifestPath}`;
  const response = await fetch(manifestUrl, { cache: "no-store" });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Failed to read ${channel} web bundle manifest: HTTP ${response.status}.`
    );
  }

  const manifest = await response.json();
  const manifestChannel = manifest.channel ?? manifest.appVariant;

  if (manifestChannel !== channel) {
    throw new Error(
      `Expected ${channel} manifest but received ${String(manifestChannel)}.`
    );
  }

  return parseNumericVersion(
    manifest.version,
    `${channel} latest manifest version`
  ).value;
}

function readAppVersions() {
  return JSON.parse(readFileSync(appVersionsPath, "utf8"));
}

function readChannel(value) {
  const channel = value?.trim().toLowerCase();

  if (channel !== "dev" && channel !== "prod") {
    throw new Error("CLOSET_WEB_BUNDLE_CHANNEL must be dev or prod.");
  }

  return channel;
}

async function main() {
  const channel = readChannel(process.env.CLOSET_WEB_BUNDLE_CHANNEL);
  const publicBaseUrl = (
    process.env.R2_PUBLIC_BASE_URL ||
    process.env.EXPO_PUBLIC_WEB_BUNDLE_BASE_URL ||
    ""
  ).trim();

  if (!publicBaseUrl) {
    throw new Error(
      "R2_PUBLIC_BASE_URL or EXPO_PUBLIC_WEB_BUNDLE_BASE_URL is required."
    );
  }

  const nativeSeries = resolveNativeVersionSeries(readAppVersions(), channel);
  const latestVersion = await readLatestWebBundleVersion(
    publicBaseUrl,
    channel
  );
  const version = resolveWebBundleVersion({
    nativeSeries,
    latestVersion,
    requestedVersion: process.env.REQUESTED_WEB_VERSION
  });

  if (process.env.GITHUB_ENV) {
    appendFileSync(
      process.env.GITHUB_ENV,
      `CLOSET_WEB_BUNDLE_VERSION=${version}\n`
    );
  }

  console.log(
    `[web-bundle-version] channel=${channel} native=${nativeSeries.major}.${nativeSeries.minor}.x latest=${latestVersion ?? "none"} next=${version}`
  );
}

const isDirectExecution =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
