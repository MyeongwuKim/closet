import type {
  WebBundleProgress,
  WebBundleProgressReporter
} from "./webBundleTypes";

export const INITIAL_WEB_BUNDLE_PROGRESS: WebBundleProgress = {
  stage: "preparing",
  progress: 0.06,
  message: "앱을 준비하고 있어요."
};

export function emitWebBundleProgress(
  reporter: WebBundleProgressReporter | undefined,
  update: WebBundleProgress
) {
  reporter?.({
    ...update,
    progress: Math.max(0, Math.min(1, update.progress))
  });
}
