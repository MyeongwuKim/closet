import { useState } from 'react'
import { BellRing, ChevronDown, ExternalLink, LockKeyhole } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { SettingsDetailLayout } from '../components/SettingsDetailLayout'
import { PermissionSettingRow } from '../components/SettingRow'
import { RediscoveryPushSetting } from '../components/RediscoveryPushSetting'
import { CompletionPushSetting } from '../components/CompletionPushSetting'
import { useSettingsPermission } from '../hooks/useSettingsPermission'
import { useSendTestPushNotificationMutation } from '../api/pushQueries'
import { useMeQuery } from '../api/profileQueries'
import { isPermissionGranted, permissionActionLabel, permissionStatusLabels } from '../utils/settingsPermissions'

/** 설정 → 알림 또는 잊고 있던 옷에서 진입한다. 수신 동의·기기 알림 권한·테스트 수신을 관리하며 옷장에서 진입하면 보던 옷으로 돌아간다. */
export function NotificationsPage() {
  const [params] = useSearchParams()
  const fromRediscovery = params.get('from') === 'rediscovery'
  const itemId = params.get('item')
  const entryParams = new URLSearchParams({ from: 'rediscovery' })
  if (itemId) entryParams.set('item', itemId)
  const entryTo = fromRediscovery ? `/settings/notifications?${entryParams}` : '/settings/notifications'
  const backTo = fromRediscovery
    ? `/closet/rediscovery${itemId ? `?item=${encodeURIComponent(itemId)}` : ''}`
    : '/settings'
  const permission = useSettingsPermission('notifications')
  const { isNative, status, isLoading, isRequesting, error, setError } = permission
  const granted = isPermissionGranted(status)
  const me = useMeQuery()
  const preferencesDisabled = !isNative || !granted || isLoading || isRequesting || me.isPending || me.isError
  const permissionNotice = !isNative
    ? '모바일 앱에서 설정할 수 있어요.'
    : !granted && !isLoading && !isRequesting
      ? '알림 권한을 허용해야 받을 수 있어요.'
      : null
  const sendTestPush = useSendTestPushNotificationMutation()
  const [testMessage, setTestMessage] = useState<string | null>(null)

  /** 전송 접수 결과와 실제 수신 확인을 구분해서 표시한다. 실제 요청은 기존 인증된 테스트 푸시 mutation에 맡긴다. */
  const sendTestNotification = async () => {
    setError(null)
    setTestMessage(null)
    try {
      await sendTestPush.mutateAsync()
      setTestMessage('테스트 알림을 전송했어요. 기기에서 수신 여부를 확인해주세요.')
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : '테스트 알림을 보내지 못했어요.')
    }
  }

  return (
    <SettingsDetailLayout title="알림" description=""
      entryTo={entryTo} backTo={backTo} backLabel={fromRediscovery ? '잊고 있던 옷으로 돌아가기' : undefined}
      refreshing={isLoading} onRefresh={() => void permission.refresh()}>
      <section aria-label="기기 알림">
        <div className="settings-detail-group">
          <PermissionSettingRow title="알림 권한" description=""
            status={!isNative ? '모바일 앱 전용' : isLoading ? '확인 중…' : permissionStatusLabels[status]}
            actionLabel={isNative ? permissionActionLabel('notifications', status, isRequesting) : undefined}
            disabled={isRequesting || isLoading} onActivate={isNative ? () => void permission.changeNativePermission() : undefined} />
        </div>
      </section>
      <section aria-labelledby="notification-preferences-heading">
        <h2 id="notification-preferences-heading" className="settings-detail-section-heading">받을 알림</h2>
        {permissionNotice && <p id="notification-permission-notice" role="status" className="settings-detail-permission-notice">
          <LockKeyhole size={14} aria-hidden="true" />{permissionNotice}
        </p>}
        <fieldset className="settings-detail-group settings-detail-push-options" disabled={preferencesDisabled}
          aria-labelledby="notification-preferences-heading" aria-describedby={permissionNotice ? 'notification-permission-notice' : undefined}>
          <CompletionPushSetting isNative={isNative} permissionGranted={granted}
            requestingPermission={isRequesting || isLoading} />
          <RediscoveryPushSetting isNative={isNative} permissionGranted={granted}
            requestingPermission={isRequesting || isLoading} />
        </fieldset>
        {me.isError && <div className="settings-detail-retry">
          <span role="alert">알림 설정을 불러오지 못했어요.</span>
          <button type="button" onClick={() => void me.refetch()} disabled={me.isFetching}>다시 시도</button>
        </div>}
      </section>
      {error && <p role="alert" className="settings-detail-message settings-detail-error settings-detail-feedback">{error}</p>}
      <details className="settings-detail-help">
        <summary>알림 안내<ChevronDown size={16} aria-hidden="true" /></summary>
        <div className="settings-detail-help-content">
          <dl className="settings-detail-notification-info">
            <dt>작업 완료 알림</dt>
            <dd>AI 옷 분석·코디 추천·코디 이미지 생성의 완료와 실패를 알려드려요.</dd>
            <dt>잊고 있던 옷 알림</dt>
            <dd>30일 이상 착용 기록이 없는 이번 계절의 옷을 주 1회 알려드려요. 한국 시간 다음 날 오전 9시부터 확인하며, 대상 옷이 있을 때만 보내요.</dd>
          </dl>
          {isNative && <div className="settings-detail-help-actions">
            <button type="button" onClick={() => void sendTestNotification()} disabled={!granted || isLoading || sendTestPush.isPending} className="settings-detail-test-button">
              <BellRing size={15} aria-hidden="true" />{sendTestPush.isPending ? '테스트 알림 전송 중…' : '테스트 알림 보내기'}
            </button>
            <button type="button" onClick={() => void permission.openSettings()} className="settings-detail-settings-link">
              기기 설정 열기<ExternalLink size={13} aria-hidden="true" />
            </button>
          </div>}
          {testMessage && <p role="status" className="settings-detail-message">{testMessage}</p>}
        </div>
      </details>
    </SettingsDetailLayout>
  )
}
