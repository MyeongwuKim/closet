import { LogOut } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLogoutMutation } from '../../auth/api/authQueries'
import { useAccountInfoQuery, useDeleteAccountMutation } from '../api/accountQueries'
import { SettingsDetailLayout } from '../components/SettingsDetailLayout'
import { AccountDeletionDialog } from '../components/AccountDeletionDialog'
import { ViewerSessionChangedError } from '../api/profileQueries'
import { useUiStore } from '../../../stores/useUiStore'
import './AccountSettingsPage.css'

/** 설정 → 계정 관리에서 로그인 정보를 확인한다. 로그아웃과 최종 확인을 거친 서버 회원탈퇴를 제공하며 실패 시 현재 계정을 유지한다. */
export function AccountSettingsPage() {
  const me = useAccountInfoQuery()
  const logout = useLogoutMutation()
  const navigate = useNavigate()
  const deletion = useDeleteAccountMutation()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const closeDeletion = useCallback(() => setDeleteOpen(false), [])
  const pushToast = useUiStore(state => state.pushToast)

  /** 서버 응답 실패 때도 기존 로그아웃 훅이 로컬 인증을 정리하므로 로그인 화면으로 이동한다. */
  const signOut = async () => {
    await logout.mutateAsync().catch(() => undefined)
    navigate('/login', { replace: true })
  }

  /** 확인창에서만 서버 탈퇴를 실행한다. 성공은 로그인으로 이동하고 오류는 같은 화면에서 재시도할 수 있게 알린다. */
  const deleteAccount = async () => {
    if (deletion.isPending) return
    try {
      await deletion.mutateAsync()
      pushToast('회원탈퇴가 완료됐어요.', 'success')
      navigate('/login', { replace: true })
    } catch (error) {
      if (!(error instanceof ViewerSessionChangedError)) pushToast(error instanceof Error ? error.message : '회원탈퇴를 완료하지 못했어요. 다시 시도해주세요.', 'error')
    }
  }

  return (
    <SettingsDetailLayout title="계정 관리" description="" entryTo="/settings/account">
      <section aria-labelledby="account-info-heading">
        <h2 id="account-info-heading" className="settings-detail-section-heading">로그인 정보</h2>
        {me.isPending ? <p role="status" className="settings-account-loading">계정 정보를 불러오는 중…</p> : me.isError ? (
          <div className="settings-detail-retry">
            <span role="alert">계정 정보를 불러오지 못했어요.</span>
            <button type="button" onClick={() => void me.refetch()} disabled={me.isFetching}>다시 시도</button>
          </div>
        ) : (
          <dl className="settings-detail-group settings-account-info">
            <div><dt>이름</dt><dd>{me.data.displayName || '등록된 이름 없음'}</dd></div>
            {me.data.loginId && <div><dt>로그인 ID</dt><dd>{me.data.loginId}</dd></div>}
            {me.data.email && <div><dt>이메일</dt><dd>{me.data.email}</dd></div>}
          </dl>
        )}
      </section>
      <div className="settings-account-actions">
        <button type="button" disabled={logout.isPending || deletion.isPending} className="settings-account-logout"
          onClick={() => void signOut()}>
          <LogOut size={20} strokeWidth={1.6} aria-hidden="true" />
          {logout.isPending ? '로그아웃 중…' : '로그아웃'}
        </button>
        <button type="button" className="settings-account-delete" disabled={me.isPending || me.isError || logout.isPending || deletion.isPending}
          onClick={() => setDeleteOpen(true)}>회원탈퇴</button>
      </div>
      {deleteOpen && <AccountDeletionDialog pending={deletion.isPending} onCancel={closeDeletion} onConfirm={() => void deleteAccount()} />}
    </SettingsDetailLayout>
  )
}
