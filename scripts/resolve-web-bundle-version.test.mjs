import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveNativeVersionSeries,
  resolveWebBundleVersion
} from "./resolve-web-bundle-version.mjs";

test("starts a channel without a manifest at the native major/minor baseline", () => {
  assert.equal(
    resolveWebBundleVersion({
      nativeSeries: { major: 1, minor: 0 },
      latestVersion: null
    }),
    "1.0.0"
  );
});

test("increments only the current channel manifest patch", () => {
  assert.equal(
    resolveWebBundleVersion({
      nativeSeries: { major: 1, minor: 0 },
      latestVersion: "1.0.43"
    }),
    "1.0.44"
  );
});

test("resets the web patch when the native major/minor changes", () => {
  assert.equal(
    resolveWebBundleVersion({
      nativeSeries: { major: 1, minor: 1 },
      latestVersion: "1.0.43"
    }),
    "1.1.0"
  );
});

test("rejects a native version series older than the published web series", () => {
  assert.throws(
    () =>
      resolveWebBundleVersion({
        nativeSeries: { major: 1, minor: 0 },
        latestVersion: "1.1.0"
      }),
    /older than/
  );
});

test("prod 발행은 새 운영 경로를 쓰는 플랫폼만 대상으로 한다", () => {
  assert.deepEqual(
    resolveNativeVersionSeries(
      { prod: { ios: "0.1.0", android: "0.0.9" } },
      "prod",
      "0.1.0"
    ),
    { major: 0, minor: 1 }
  );
  assert.throws(
    () => resolveNativeVersionSeries({ prod: { ios: "0.0.1", android: "0.0.0" } }, "prod", "0.1.0"),
    /No production native app meets/
  );
});

test("같은 발행 경로에 있는 iOS와 Android는 버전 계열을 맞춘다", () => {
  assert.throws(
    () =>
      resolveNativeVersionSeries(
        {
          prod: {
            ios: "1.1.0",
            android: "1.2.0"
          }
        },
        "prod",
        "1.0.0"
      ),
    /must share the same major\/minor/
  );
});

test("allows a newer manual version only within the native series", () => {
  assert.equal(
    resolveWebBundleVersion({
      nativeSeries: { major: 1, minor: 1 },
      latestVersion: "1.1.2",
      requestedVersion: "1.1.7"
    }),
    "1.1.7"
  );

  assert.throws(
    () =>
      resolveWebBundleVersion({
        nativeSeries: { major: 1, minor: 1 },
        latestVersion: "1.1.2",
        requestedVersion: "1.0.8"
      }),
    /must match native version series/
  );
});

test('rejects an unchanged or lower manually requested version', () => {
  for (const requestedVersion of ['0.1.3', '0.1.2']) {
    assert.throws(() => resolveWebBundleVersion({ nativeSeries: { major: 0, minor: 1 }, latestVersion: '0.1.3', requestedVersion }), /must be newer/)
  }
})

test('production eligibility follows the supplied runtime minimum rather than a fixed baseline', () => {
  assert.deepEqual(resolveNativeVersionSeries({ prod: { ios: '1.0.0', android: '0.9.9' } }, 'prod', '1.0.0'), { major: 1, minor: 0 })
  assert.throws(() => resolveNativeVersionSeries({ prod: { ios: '0.9.9', android: '0.9.8' } }, 'prod', '1.0.0'), /No production native app meets/)
})
