import { requireOptionalNativeModule } from 'expo'
import { Platform } from 'react-native'

interface PreviewSubmissionModule {
  begin(): Promise<number | null>
  end(id: number): Promise<void>
}

const nativeModule = Platform.OS === 'ios'
  ? requireOptionalNativeModule<PreviewSubmissionModule>('ClosetPreviewSubmission')
  : null

export const supportsPreviewSubmissionInBackground = nativeModule !== null

/** iOS가 실행 시간 연장을 승인하면 접수 브리지가 완료·취소 시 호출할 정리 함수를 돌려준다. */
export async function beginPreviewSubmissionBackgroundTask() {
  if (!nativeModule) return
  const taskId = await nativeModule.begin().catch(() => null)
  if (taskId === null) return
  return async () => { await nativeModule.end(taskId).catch(() => {}) }
}
