import { useSetRediscoveryPushEnabledMutation } from '../api/profileQueries'
import { PushPreferenceSetting, type PushPermissionProps } from './PushPreferenceSetting'

/** 기본 OFF인 주간 재발견 알림의 수신 선택을 표시한다. 세부 발송 조건은 알림 화면의 공통 안내에서 제공한다. */
export function RediscoveryPushSetting(props: PushPermissionProps) {
  const update = useSetRediscoveryPushEnabledMutation()
  return (
    <PushPreferenceSetting {...props} preference="rediscoveryPushEnabled" title="잊고 있던 옷 알림"
      description="착용 기록 없는 옷 · 주 1회" update={update} />
  )
}
