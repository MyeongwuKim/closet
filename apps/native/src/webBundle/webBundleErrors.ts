export type WebBundleFatalInstallReason = "download" | "verify" | "extract";

export class FatalWebBundleInstallError extends Error {
  readonly fatal = true;
  readonly reason: WebBundleFatalInstallReason;
  readonly cause: unknown;

  constructor(
    message: string,
    reason: WebBundleFatalInstallReason,
    cause: unknown
  ) {
    super(message);
    this.name = "FatalWebBundleInstallError";
    this.reason = reason;
    this.cause = cause;
  }
}

export function isFatalWebBundleInstallError(
  error: unknown
): error is FatalWebBundleInstallError {
  return (
    error instanceof FatalWebBundleInstallError ||
    (typeof error === "object" &&
      error !== null &&
      (error as { fatal?: unknown; name?: unknown }).fatal === true &&
      (error as { name?: unknown }).name === "FatalWebBundleInstallError")
  );
}
