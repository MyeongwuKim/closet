import { useEffect, useState } from 'react'
import { Bug, ChevronLeft, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageTitle } from '../../../components/PageTitle'
import {
  getNativeAppInfo,
  isNativeWebViewRuntime,
  openNativeExternalUrl,
  type NativeAppInfo,
} from '../../../native-bridge'

function getPlatformLabel(platform: string | undefined, isNative: boolean) {
  if (platform === 'ios') return 'iOS 앱'
  if (platform === 'android') return 'Android 앱'
  if (platform) return `${platform} 앱`
  return isNative ? '확인 불가' : 'Web'
}

function getOsLabel(appInfo: NativeAppInfo | null, isNative: boolean) {
  if (!appInfo) return isNative ? '확인 불가' : '브라우저 환경'
  const platform = appInfo.platform === 'ios' ? 'iOS' : 'Android'
  return `${platform} ${appInfo.osVersion}`
}

async function readNativeAppInfo() {
  const appInfo = await getNativeAppInfo()
  if (!appInfo) throw new Error('앱 정보를 확인할 수 없어요.')
  return appInfo
}

function getAppInfoErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : '앱 정보를 확인할 수 없어요.'
}

export function AppInfoPage() {
  const isNative = isNativeWebViewRuntime()
  const [appInfo, setAppInfo] = useState<NativeAppInfo | null>(null)
  const [isLoading, setIsLoading] = useState(isNative)
  const [error, setError] = useState<string | null>(null)
  const webBundleVersion =
    window.ClosetRuntimeConfig?.webBundleVersion ??
    (import.meta.env.DEV ? '개발 서버' : '웹 배포')

  useEffect(() => {
    if (!isNative) return

    let isActive = true
    void readNativeAppInfo()
      .then((nextAppInfo) => {
        if (isActive) setAppInfo(nextAppInfo)
      })
      .catch((loadError: unknown) => {
        if (isActive) setError(getAppInfoErrorMessage(loadError))
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [isNative])

  const reportIssue = async () => {
    setError(null)
    try {
      const issueBody = [
        '## 오류 내용',
        '',
        '<!-- 발생한 문제와 재현 방법을 적어주세요. -->',
        '',
        '## 실행 정보',
        '',
        ...runtimeRows.map(([label, value]) => `- ${label}: ${value}`),
      ].join('\n')
      const searchParams = new URLSearchParams({
        title: '[오류 신고] ',
        body: issueBody,
      })
      await openNativeExternalUrl(
        `https://github.com/MyeongwuKim/closet/issues/new?${searchParams}`,
      )
    } catch (reportError) {
      setError(
        reportError instanceof Error
          ? reportError.message
          : '오류 신고 화면을 열지 못했어요.',
      )
    }
  }

  const runtimeRows = [
    ['실행 환경', getPlatformLabel(appInfo?.platform, isNative)],
    ['앱 버전', appInfo?.appVersion ?? (isNative ? '확인 불가' : '해당 없음')],
    ['빌드 번호', appInfo?.buildVersion ?? (isNative ? '확인 불가' : '해당 없음')],
    ['OS 버전', getOsLabel(appInfo, isNative)],
    ['웹 번들 버전', webBundleVersion],
  ]

  return (
    <section
      className="classification-page-enter fixed inset-0 z-[80] flex h-dvh flex-col overflow-hidden bg-canvas"
      role="dialog"
      aria-modal="true"
      aria-label="앱 정보"
    >
      <header className="shrink-0 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-2xl items-center gap-2 px-3 py-2 sm:min-h-18 sm:px-5">
          <Link
            to="/settings"
            className="flex size-10 shrink-0 items-center justify-center rounded-full transition hover:bg-surface"
            aria-label="앱 정보 닫기"
            autoFocus
          >
            <ChevronLeft size={24} strokeWidth={2.2} />
          </Link>
          <PageTitle
            title="앱 정보"
            description="앱 실행 환경과 버전을 확인해보세요."
            compact
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-2xl space-y-5 px-5 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-8 sm:pb-[calc(2rem+env(safe-area-inset-bottom))]">
          <section>
            <h2 className="px-1 text-sm font-black">실행 정보</h2>
            <dl className="mt-3 overflow-hidden rounded-3xl border border-line bg-surface">
              {runtimeRows.map(([label, value], index) => (
                <div
                  className={`flex items-center justify-between gap-5 px-5 py-4 ${
                    index > 0 ? 'border-t border-line' : ''
                  }`}
                  key={label}
                >
                  <dt className="text-sm font-bold text-muted">{label}</dt>
                  <dd className="min-w-0 truncate text-right text-sm font-black">
                    {isLoading && label !== '웹 번들 버전'
                      ? '확인 중...'
                      : value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h2 className="px-1 text-sm font-black">도움말</h2>
            <button
              type="button"
              onClick={() => void reportIssue()}
              disabled={isLoading}
              className="mt-3 flex w-full items-center gap-3 rounded-3xl border border-line bg-surface px-4 py-4 text-left transition hover:border-ink disabled:opacity-50 sm:px-5"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-canvas text-muted">
                <Bug size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm font-black">
                  오류 신고하기
                </strong>
                <span className="mt-1 block text-xs leading-5 text-muted">
                  실행 정보를 첨부해 오류 상황을 알려주세요.
                </span>
              </span>
              <ExternalLink className="shrink-0 text-muted" size={17} />
            </button>
            {error && <p className="mt-2 px-1 text-xs text-accent">{error}</p>}
          </section>
        </div>
      </div>
    </section>
  )
}
