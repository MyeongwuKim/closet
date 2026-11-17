import { useSetCompletionPushEnabledMutation } from '../api/profileQueries'
import { PushPreferenceSetting, type PushPermissionProps } from './PushPreferenceSetting'

/** 기본 ON인 작업 완료·실패 기기 알림을 사용자가 선택한다. 앱 안의 작업 결과와 완료 팝업에는 영향을 주지 않는다. */
export function CompletionPushSetting(props: PushPermissionProps) {
  const update = useSetCompletionPushEnabledMutation()
  return (
    <PushPreferenceSetting {...props} preference="completionPushEnabled" title="작업 완료 알림"
      description="AI 작업 완료·실패" update={update} />
  )
}
