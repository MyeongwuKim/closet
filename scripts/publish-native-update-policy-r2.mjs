#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const env = process.env;
const validateOnly = process.argv.includes("--validate-only");
const configPath = resolve(
  env.CLOSET_MINIMUM_APP_VERSIONS_PATH ||
    "apps/native/minimum-app-versions.json"
);
const config = readPolicyConfig(configPath);
const requestedChannel = readRequestedChannel();
const channels = requestedChannel ? [requestedChannel] : ["dev", "prod"];
const manifests = channels.map((channel) => createManifest(config, channel));

if (validateOnly) {
  for (const manifest of manifests) {
    console.log(`Validated native update policy for ${manifest.channel}.`);
  }
  process.exit(0);
}

if (!requestedChannel) {
  fail("CLOSET_NATIVE_UPDATE_CHANNEL is required when publishing.");
}

const endpoint = required("R2_ENDPOINT");
const bucketName = required("R2_BUCKET_NAME");
const accessKeyId = env.R2_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID;
const secretAccessKey = env.R2_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY;

if (!accessKeyId || !secretAccessKey) {
  fail("R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required.");
}

const manifest = manifests[0];
const tmpRoot = mkdtempSync(join(tmpdir(), "closet-native-update-policy-"));
const manifestPath = join(tmpRoot, "latest.json");
const revision = sanitizeKeyPart(env.GITHUB_SHA || `local-${Date.now()}`);
const runAttempt = sanitizeKeyPart(env.GITHUB_RUN_ATTEMPT || "1");
const releaseKey = `native/releases/${revision}-${runAttempt}.json`;
const latestKey = "native/latest.json";

try {
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  uploadFile(
    manifestPath,
    releaseKey,
    "public, max-age=31536000, immutable"
  );
  uploadFile(manifestPath, latestKey, "no-store");

  console.log(`Published ${releaseKey}`);
  console.log(`Updated ${latestKey}`);
} finally {
  rmSync(tmpRoot, { force: true, recursive: true });
}

function readPolicyConfig(filePath) {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));

    for (const channel of ["dev", "prod"]) {
      for (const platform of ["ios", "android"]) {
        validatePlatformPolicy(parsed?.[channel]?.[platform], channel, platform);
      }
    }

    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      fail(`Native update policy JSON is invalid: ${filePath}`);
    }

    throw error;
  }
}

function validatePlatformPolicy(policy, channel, platform) {
  const label = `${channel}.${platform}`;

  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    fail(`Native update policy is missing: ${label}`);
  }

  if (typeof policy.enabled !== "boolean") {
    fail(`${label}.enabled must be a boolean.`);
  }

  if (
    typeof policy.minimumVersion !== "string" ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(
      policy.minimumVersion.trim()
    )
  ) {
    fail(`${label}.minimumVersion must be a semantic version.`);
  }

  if (policy.storeUrl !== null && typeof policy.storeUrl !== "string") {
    fail(`${label}.storeUrl must be a string or null.`);
  }

  const storeUrl = policy.storeUrl?.trim() || "";

  if (policy.enabled && !storeUrl) {
    fail(`${label}.storeUrl is required when updates are enabled.`);
  }

  if (storeUrl) {
    validateStoreUrl(storeUrl, platform, label);
  }
}

function validateStoreUrl(value, platform, label) {
  let url;

  try {
    url = new URL(value);
  } catch {
    fail(`${label}.storeUrl is invalid.`);
  }

  const allowedProtocols =
    platform === "ios" ? ["https:", "itms-apps:"] : ["https:", "market:"];

  if (!allowedProtocols.includes(url.protocol)) {
    fail(
      `${label}.storeUrl protocol must be one of ${allowedProtocols.join(", ")}.`
    );
  }

  if (
    platform === "ios" &&
    !["apps.apple.com", "itunes.apple.com", "testflight.apple.com"].includes(
      url.hostname
    )
  ) {
    fail(`${label}.storeUrl must use an Apple App Store or TestFlight host.`);
  }

  if (
    platform === "android" &&
    url.protocol === "https:" &&
    url.hostname !== "play.google.com"
  ) {
    fail(`${label}.storeUrl must use the Google Play host.`);
  }
}

function createManifest(configValue, channel) {
  return {
    schemaVersion: 1,
    channel,
    publishedAt: new Date().toISOString(),
    revision: env.GITHUB_SHA || null,
    platforms: {
      ios: normalizePlatformPolicy(configValue[channel].ios),
      android: normalizePlatformPolicy(configValue[channel].android)
    }
  };
}

function normalizePlatformPolicy(policy) {
  return {
    enabled: policy.enabled,
    minimumVersion: policy.minimumVersion.trim(),
    storeUrl: policy.storeUrl?.trim() || null
  };
}

function readRequestedChannel() {
  const value = (
    env.CLOSET_NATIVE_UPDATE_CHANNEL ||
    env.EXPO_PUBLIC_APP_VARIANT ||
    env.APP_VARIANT ||
    ""
  )
    .trim()
    .toLowerCase();

  if (!value) {
    return null;
  }

  if (value === "dev" || value === "prod") {
    return value;
  }

  fail("CLOSET_NATIVE_UPDATE_CHANNEL must be dev or prod.");
}

function uploadFile(sourcePath, key, cacheControl) {
  runAws([
    "s3",
    "cp",
    sourcePath,
    `s3://${bucketName}/${key}`,
    "--content-type",
    "application/json; charset=utf-8",
    "--cache-control",
    cacheControl
  ]);
}

function runAws(args) {
  const result = spawnSync(
    "aws",
    [...args, "--endpoint-url", endpoint, "--region", "auto"],
    {
      encoding: "utf8",
      env: {
        ...env,
        AWS_ACCESS_KEY_ID: accessKeyId,
        AWS_SECRET_ACCESS_KEY: secretAccessKey,
        AWS_EC2_METADATA_DISABLED: "true"
      },
      stdio: "inherit"
    }
  );

  if (result.error) {
    fail(result.error.message);
  }

  if (result.status !== 0) {
    fail(`aws ${args.join(" ")} failed.`);
  }
}

function required(name, transform = (value) => value) {
  const value = env[name]?.trim();

  if (!value) {
    fail(`${name} is required.`);
  }

  return transform(value);
}

function sanitizeKeyPart(value) {
  const normalized = value.replace(/[^a-zA-Z0-9._-]/g, "-");

  if (!normalized) {
    fail("Native update policy release key is invalid.");
  }

  return normalized;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
