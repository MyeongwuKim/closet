import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { queryKeys } from '../src/lib/queryKeys'
import { useDeleteAccountMutation } from '../src/features/settings/api/accountQueries'
import { ViewerSessionChangedError } from '../src/features/settings/api/profileQueries'
import { usePlanStore } from '../src/features/plan/stores/usePlanStore'
import { useStyleProfileStore } from '../src/features/settings/stores/useStyleProfileStore'

for (const scenario of ['success', 'failure', 'new-session'] as const) {
  test(`회원탈퇴 ${scenario}: 성공한 본인 세션만 인증·캐시·개인 편집 상태를 비운다`, async t => {
    const originalWindow = globalThis.window
    const previousPlan = usePlanStore.getState().entries
    const previousProfile = useStyleProfileStore.getState().profile
    let token: string | null = 'session-A'
    const synced: Array<string | null> = []
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    let markRequested!: () => void
    const requested = new Promise<void>(resolve => { markRequested = resolve })
    const client = new QueryClient({ defaultOptions: { mutations: { gcTime: Infinity } } })
    client.setQueryData(queryKeys.me, { id: 'viewer-A' })
    usePlanStore.setState({ entries: previousPlan.map(entry => ({ ...entry, title: '개인 코디' })) })
    useStyleProfileStore.getState().updateProfile({ ...previousProfile, heightCm: '179' })
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {
      localStorage: { getItem: () => token, removeItem: () => { token = null } },
      ClosetNative: {
        setAuthSession: async (next: string | null) => { synced.push(next) },
        requestGraphql: async () => {
          markRequested()
          await gate
          return { ok: true, payload: scenario === 'failure'
            ? { data: null, errors: [{ message: '삭제 실패', extensions: { code: 'ACCOUNT_DELETION_FAILED' } }] }
            : { data: { deleteMyAccount: true } } }
        },
      },
    } })
    t.after(() => {
      release()
      client.clear()
      usePlanStore.setState({ entries: previousPlan })
      useStyleProfileStore.setState({ profile: previousProfile })
      Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
    })
    let mutation!: ReturnType<typeof useDeleteAccountMutation>
    function Capture() { mutation = useDeleteAccountMutation(); return null }
    renderToString(createElement(QueryClientProvider, { client }, createElement(Capture)))
    const pending = mutation.mutateAsync()
    await requested
    if (scenario === 'new-session') {
      token = 'session-B'
      client.setQueryData(queryKeys.me, { id: 'viewer-B' })
    }
    release()
    if (scenario === 'success') {
      await pending
      assert.equal(token, null)
      assert.equal(client.getQueryData(queryKeys.me), undefined)
      assert.equal(usePlanStore.getState().entries.every(entry => !entry.title), true)
      assert.equal(useStyleProfileStore.getState().profile.heightCm, '')
      assert.deepEqual(synced, [null])
    } else {
      await assert.rejects(pending, scenario === 'new-session' ? ViewerSessionChangedError : /삭제 실패/)
      assert.equal(token, scenario === 'new-session' ? 'session-B' : 'session-A')
      assert.deepEqual(client.getQueryData(queryKeys.me), { id: scenario === 'new-session' ? 'viewer-B' : 'viewer-A' })
      assert.equal(usePlanStore.getState().entries[0].title, '개인 코디')
      assert.equal(useStyleProfileStore.getState().profile.heightCm, '179')
      assert.deepEqual(synced, [])
    }
  })
}
