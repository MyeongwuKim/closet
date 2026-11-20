const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const sourcePath = path.join(
  __dirname,
  "../src/webBundle/webViewReadyRecovery.ts"
);
const compiledSource = ts.transpileModule(readFileSync(sourcePath, "utf8"), {
  reportDiagnostics: true,
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
});

assert.equal(
  compiledSource.diagnostics.length,
  0,
  compiledSource.diagnostics
    .map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
    )
    .join("\n")
);

const recoveryModule = {};
vm.runInNewContext(compiledSource.outputText, {
  exports: recoveryModule,
});

function createScheduler() {
  let nextTimerId = 1;
  const timers = new Map();

  return {
    clearTimeout(timerId) {
      timers.delete(timerId);
    },
    runByDelay(delayMs) {
      const entry = [...timers.entries()].find(
        ([, timer]) => timer.delayMs === delayMs
      );

      assert.ok(entry, `${delayMs}ms 타이머가 필요합니다.`);
      const [timerId, timer] = entry;
      timers.delete(timerId);
      timer.callback();
    },
    setTimeout(callback, delayMs) {
      const timerId = nextTimerId++;
      timers.set(timerId, { callback, delayMs });
      return timerId;
    },
    timers,
  };
}

function createHarness({
  initialAppActive = true,
  useDefaultTimings = false,
} = {}) {
  const events = [];
  const scheduler = createScheduler();
  const controller =
    recoveryModule.createWebViewReadyRecoveryController({
      initialAppActive,
      maxAutomaticReloads: 1,
      ...(useDefaultTimings
        ? {}
        : {
            readyTimeoutMs: 8_000,
            retryDelaysMs: [1_000, 3_000],
          }),
      scheduler,
      requestReadySignal: (bundleKey) => {
        events.push({ type: "request", bundleKey });
      },
      reloadWebView: (event) => {
        events.push({ type: "reload", ...event });
      },
      onRecoveryFailed: (event) => {
        events.push({ type: "failure", ...event });
      },
    });

  controller.prepareBundle("embedded");
  return { controller, events, scheduler };
}

test("준비 신호가 없으면 재요청 후 WebView를 한 번 자동 재로딩한다", () => {
  const harness = createHarness();

  harness.controller.waitForReady("embedded");
  assert.deepEqual(harness.events, [
    { type: "request", bundleKey: "embedded" },
  ]);

  harness.scheduler.runByDelay(1_000);
  harness.scheduler.runByDelay(3_000);
  harness.scheduler.runByDelay(8_000);

  assert.equal(
    harness.events.filter(({ type }) => type === "request").length,
    4
  );
  assert.deepEqual(
    harness.events.find(({ type }) => type === "reload"),
    {
      type: "reload",
      attempt: 1,
      bundleKey: "embedded",
      reason: "ready-timeout",
    }
  );
});

test("느린 내장 번들은 충분히 기다리며 준비 신호를 계속 요청한다", () => {
  const harness = createHarness({ useDefaultTimings: true });

  harness.controller.waitForReady("embedded");

  assert.deepEqual(
    [...harness.scheduler.timers.values()]
      .map(({ delayMs }) => delayMs)
      .sort((left, right) => left - right),
    [1_000, 3_000, 8_000, 15_000, 20_000]
  );

  harness.scheduler.runByDelay(15_000);
  assert.equal(
    harness.events.some(({ type }) => type === "reload"),
    false
  );
});

test("자동 재로딩 후에도 준비 신호가 없으면 실패 상태를 알린다", () => {
  const harness = createHarness();

  harness.controller.waitForReady("embedded");
  harness.scheduler.runByDelay(8_000);
  harness.scheduler.runByDelay(8_000);

  assert.deepEqual(
    harness.events.find(({ type }) => type === "failure"),
    {
      type: "failure",
      attempts: 1,
      bundleKey: "embedded",
    }
  );
  assert.equal(harness.scheduler.timers.size, 0);
});

test("백그라운드에서 종료된 WebView는 앱 활성화 후 재로딩한다", () => {
  const harness = createHarness({ initialAppActive: false });

  harness.controller.handleProcessTerminated("embedded");
  assert.equal(
    harness.events.some(({ type }) => type === "reload"),
    false
  );

  harness.controller.setAppActive(true);

  assert.deepEqual(
    harness.events.find(({ type }) => type === "reload"),
    {
      type: "reload",
      attempt: 1,
      bundleKey: "embedded",
      reason: "process-terminated",
    }
  );
  assert.equal(
    harness.events.some(({ type }) => type === "request"),
    true
  );
});

test("백그라운드 중인 준비 확인은 앱 활성화 전까지 보류한다", () => {
  const harness = createHarness({ initialAppActive: false });

  harness.controller.waitForReady("embedded");
  assert.deepEqual(harness.events, []);
  assert.equal(harness.scheduler.timers.size, 0);

  harness.controller.setAppActive(true);

  assert.deepEqual(harness.events, [
    { type: "request", bundleKey: "embedded" },
  ]);
  assert.equal(harness.scheduler.timers.size, 3);
});

test("준비 완료 신호가 오면 예약된 복구 작업을 모두 취소한다", () => {
  const harness = createHarness();

  harness.controller.waitForReady("embedded");
  harness.controller.markReady("embedded");

  assert.equal(harness.scheduler.timers.size, 0);
  assert.equal(
    harness.events.some(({ type }) => type === "reload"),
    false
  );
});

