/**
 * 용도:
 * WebView가 웹 번들 준비 신호를 보내지 못했을 때 재요청과 재로딩 순서를 관리한다.
 *
 * 동작 방식:
 * 앱이 활성 상태일 때만 준비 신호를 재요청하고, 제한 시간 안에 응답이 없으면
 * 한 번 자동 재로딩한다. 이후에도 응답이 없으면 화면에서 처리할 실패 상태를 알린다.
 */

export type WebViewReadyReloadReason =
  | "manual"
  | "process-terminated"
  | "ready-timeout";

type RecoveryEvent = {
  attempt: number;
  bundleKey: string;
  reason: WebViewReadyReloadReason;
};

type RecoveryFailure = {
  attempts: number;
  bundleKey: string;
};

type TimerHandle = ReturnType<typeof setTimeout>;

type RecoveryScheduler = {
  clearTimeout: (timer: TimerHandle) => void;
  setTimeout: (callback: () => void, delayMs: number) => TimerHandle;
};

type WebViewReadyRecoveryOptions = {
  initialAppActive: boolean;
  maxAutomaticReloads?: number;
  onRecoveryFailed: (failure: RecoveryFailure) => void;
  readyTimeoutMs?: number;
  reloadWebView: (event: RecoveryEvent) => void;
  requestReadySignal: (bundleKey: string) => void;
  retryDelaysMs?: readonly number[];
  scheduler?: RecoveryScheduler;
};

export type WebViewReadyRecoveryController = {
  dispose: () => void;
  handleProcessTerminated: (bundleKey: string) => void;
  markReady: (bundleKey: string) => void;
  prepareBundle: (bundleKey: string | null) => void;
  retryManually: (bundleKey: string) => void;
  setAppActive: (active: boolean) => void;
  stopWaiting: (bundleKey: string) => void;
  waitForReady: (bundleKey: string) => void;
};

const DEFAULT_READY_TIMEOUT_MS = 20_000;
const DEFAULT_RETRY_DELAYS_MS = [1_000, 3_000, 8_000, 15_000] as const;
const DEFAULT_MAX_AUTOMATIC_RELOADS = 1;

const DEFAULT_SCHEDULER: RecoveryScheduler = {
  clearTimeout: (timer) => clearTimeout(timer),
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs)
};

export function createWebViewReadyRecoveryController({
  initialAppActive,
  maxAutomaticReloads = DEFAULT_MAX_AUTOMATIC_RELOADS,
  onRecoveryFailed,
  readyTimeoutMs = DEFAULT_READY_TIMEOUT_MS,
  reloadWebView,
  requestReadySignal,
  retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
  scheduler = DEFAULT_SCHEDULER
}: WebViewReadyRecoveryOptions): WebViewReadyRecoveryController {
  let appActive = initialAppActive;
  let automaticReloads = 0;
  let currentBundleKey: string | null = null;
  let disposed = false;
  let failedBundleKey: string | null = null;
  let pendingProcessReload = false;
  let retryTimers: TimerHandle[] = [];
  let timeoutTimer: TimerHandle | null = null;
  let waitingBundleKey: string | null = null;

  const clearScheduledRequests = () => {
    retryTimers.forEach((timer) => scheduler.clearTimeout(timer));
    retryTimers = [];

    if (timeoutTimer !== null) {
      scheduler.clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
  };

  const isCurrentWaitingBundle = (bundleKey: string) =>
    !disposed &&
    currentBundleKey === bundleKey &&
    waitingBundleKey === bundleKey &&
    failedBundleKey !== bundleKey;

  const failRecovery = (bundleKey: string) => {
    if (!isCurrentWaitingBundle(bundleKey)) {
      return;
    }

    clearScheduledRequests();
    waitingBundleKey = null;
    failedBundleKey = bundleKey;
    pendingProcessReload = false;
    onRecoveryFailed({
      attempts: automaticReloads,
      bundleKey
    });
  };

  const scheduleReadyChecks = (bundleKey: string) => {
    clearScheduledRequests();

    if (!isCurrentWaitingBundle(bundleKey) || !appActive) {
      return;
    }

    requestReadySignal(bundleKey);
    retryTimers = retryDelaysMs.map((delayMs) =>
      scheduler.setTimeout(() => {
        if (isCurrentWaitingBundle(bundleKey) && appActive) {
          requestReadySignal(bundleKey);
        }
      }, delayMs)
    );
    timeoutTimer = scheduler.setTimeout(() => {
      timeoutTimer = null;

      if (!isCurrentWaitingBundle(bundleKey) || !appActive) {
        return;
      }

      clearScheduledRequests();

      if (automaticReloads >= maxAutomaticReloads) {
        failRecovery(bundleKey);
        return;
      }

      automaticReloads += 1;
      reloadWebView({
        attempt: automaticReloads,
        bundleKey,
        reason: "ready-timeout"
      });
      scheduleReadyChecks(bundleKey);
    }, readyTimeoutMs);
  };

  const prepareBundle = (bundleKey: string | null) => {
    if (currentBundleKey === bundleKey) {
      return;
    }

    clearScheduledRequests();
    automaticReloads = 0;
    currentBundleKey = bundleKey;
    failedBundleKey = null;
    pendingProcessReload = false;
    waitingBundleKey = null;
  };

  const requestAutomaticReload = (
    bundleKey: string,
    reason: Exclude<WebViewReadyReloadReason, "manual">
  ) => {
    if (!isCurrentWaitingBundle(bundleKey)) {
      return;
    }

    if (automaticReloads >= maxAutomaticReloads) {
      failRecovery(bundleKey);
      return;
    }

    automaticReloads += 1;
    pendingProcessReload = false;
    reloadWebView({
      attempt: automaticReloads,
      bundleKey,
      reason
    });
    scheduleReadyChecks(bundleKey);
  };

  return {
    dispose() {
      disposed = true;
      clearScheduledRequests();
    },
    handleProcessTerminated(bundleKey) {
      prepareBundle(bundleKey);
      clearScheduledRequests();
      failedBundleKey = null;
      waitingBundleKey = bundleKey;
      pendingProcessReload = true;

      if (appActive) {
        requestAutomaticReload(bundleKey, "process-terminated");
      }
    },
    markReady(bundleKey) {
      if (currentBundleKey !== bundleKey) {
        return;
      }

      clearScheduledRequests();
      automaticReloads = 0;
      failedBundleKey = null;
      pendingProcessReload = false;
      waitingBundleKey = null;
    },
    prepareBundle,
    retryManually(bundleKey) {
      prepareBundle(bundleKey);
      clearScheduledRequests();
      automaticReloads = 0;
      failedBundleKey = null;
      pendingProcessReload = false;
      waitingBundleKey = bundleKey;
      reloadWebView({
        attempt: 0,
        bundleKey,
        reason: "manual"
      });
      scheduleReadyChecks(bundleKey);
    },
    setAppActive(active) {
      if (disposed || appActive === active) {
        return;
      }

      appActive = active;

      if (!appActive) {
        clearScheduledRequests();
        return;
      }

      if (!waitingBundleKey) {
        return;
      }

      if (pendingProcessReload) {
        requestAutomaticReload(waitingBundleKey, "process-terminated");
        return;
      }

      scheduleReadyChecks(waitingBundleKey);
    },
    stopWaiting(bundleKey) {
      if (currentBundleKey !== bundleKey) {
        return;
      }

      clearScheduledRequests();
      pendingProcessReload = false;
      waitingBundleKey = null;
    },
    waitForReady(bundleKey) {
      prepareBundle(bundleKey);

      if (failedBundleKey === bundleKey) {
        return;
      }

      if (waitingBundleKey === bundleKey && timeoutTimer !== null) {
        requestReadySignal(bundleKey);
        return;
      }

      waitingBundleKey = bundleKey;
      scheduleReadyChecks(bundleKey);
    }
  };
}
