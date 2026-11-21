import type { WebBundleProgressStage } from './webBundleTypes'

const messages: Record<WebBundleProgressStage, string> = {
  preparing: '옷장 문을 열고 있어요',
  checking: '옷장 문을 열고 있어요',
  downloading: '새 소식을 옷장에 담고 있어요',
  verifying: '새 소식을 옷장에 담고 있어요',
  extracting: '새 소식을 옷장에 담고 있어요',
  applying: '새 소식을 옷장에 담고 있어요',
  loading: '옷장 문을 열고 있어요',
  rollback: '이전 버전으로 다시 열고 있어요',
  ready: '옷장이 준비됐어요',
}

export const WEB_BUNDLE_LOADING_STEPS = ['내려받기', '확인', '준비', '열기'] as const

export function getWebBundleLoadingPresentation(stage: WebBundleProgressStage) {
  const step = stage === 'downloading' ? 0
    : stage === 'verifying' ? 1
      : stage === 'extracting' || stage === 'applying' ? 2
        : stage === 'loading' || stage === 'ready' ? 3 : null
  return { message: messages[stage], step }
}
