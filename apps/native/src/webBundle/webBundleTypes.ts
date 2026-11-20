export type WebBundleChannel = "dev" | "prod";

export type WebBundleManifest = {
  version: string;
  minimumNativeVersion: string | null;
  channel: WebBundleChannel | null;
  appVariant: WebBundleChannel | null;
  bundleUrl: string;
  entryUrl: string | null;
  entryPath: string;
  sha256: string;
  createdAt: string | null;
  readySignalRequired: boolean;
};

export type InstalledWebBundle = {
  version: string;
  minimumNativeVersion: string | null;
  entryPath: string;
  entryUrl: string | null;
  entryUri: string;
  directoryUri: string;
  sha256: string;
  pending: boolean;
  readySignalRequired: boolean;
};

export type ResolvedWebBundleKind = "embedded" | "installed";

export type WebBundleSource =
  | {
      html: string;
      baseUrl: string;
    }
  | {
      uri: string;
    };

export type ResolvedWebBundle = {
  key: string;
  kind: ResolvedWebBundleKind;
  version: string | null;
  source: WebBundleSource;
  allowingReadAccessToUrl?: string;
  pending: boolean;
  readySignalRequired: boolean;
};

export type WebBundleProgressStage =
  | "preparing"
  | "checking"
  | "downloading"
  | "verifying"
  | "extracting"
  | "applying"
  | "loading"
  | "ready"
  | "rollback";

export type WebBundleProgress = {
  stage: WebBundleProgressStage;
  progress: number;
  message: string;
  indeterminate?: boolean;
};

export type WebBundleProgressReporter = (
  update: WebBundleProgress
) => void;
