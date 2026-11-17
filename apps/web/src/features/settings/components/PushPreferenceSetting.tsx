import { useUiStore } from '../../../stores/useUiStore'
import { useMeQuery, ViewerSessionChangedError, type ViewerProfile } from '../api/profileQueries'
import { ToggleSettingRow } from './SettingRow'

export interface PushPermissionProps {
  isNative: boolean
  permissionGranted: boolean
  requestingPermission: boolean
}

interface Props extends PushPermissionProps {
  preference: 'completionPushEnabled' | 'rediscoveryPushEnabled'
  title: string
  description: string
  update: { isPending: boolean; mutateAsync: (enabled: boolean) => Promise<ViewerProfile> }
}

/** 기기 권한이 있을 때 계정별 수신 선택을 변경한다. 권한이 없으면 저장된 선택을 유지한 채 비활성화하고, 저장·계정 변경 검사는 mutation의 세션 보호 경로를 따른다. */
export function PushPreferenceSetting({
  preference, title, description, update,
  isNative, permissionGranted, requestingPermission,
}: Props) {
  const me = useMeQuery()
  const pushToast = useUiStore((state) => state.pushToast)
  const enabled = me.data?.[preference] ?? false

  const toggle = async (checked: boolean) => {
    if (!isNative || !permissionGranted || requestingPermission || update.isPending || !me.data || me.isError) return
    try {
      await update.mutateAsync(checked)
      pushToast(`${title}을 ${checked ? '켰어요.' : '껐어요.'}`, 'success')
    } catch (error) {
      if (error instanceof ViewerSessionChangedError) return
      pushToast(error instanceof Error ? error.message : '알림 설정을 저장하지 못했어요.', 'error')
    }
  }

  return (
    <ToggleSettingRow title={title} description={description} checked={enabled} compact
      disabled={!isNative || !permissionGranted || !me.data || me.isError || update.isPending || requestingPermission}
      loading={me.isPending} onChange={(checked) => void toggle(checked)} />
  )
}
