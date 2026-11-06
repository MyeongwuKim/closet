import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { queryKeys } from '../src/lib/queryKeys'
import {
  useUpdateStyleProfileMutation,
  useUpdateWearReminderPreferencesMutation,
  ViewerSessionChangedError,
  type ViewerProfile,
} from '../src/features/settings/api/profileQueries'
import { useStyleProfileStore } from '../src/features/settings/stores/useStyleProfileStore'

function createViewer(id: string, heightCm = 170): ViewerProfile {
  return {
    id, displayName: id, email: null, isTemporary: true,
    styleProfile: {
      gender: 'male', bodyBuild: 'average', heightCm, weightKg: 65,
      chestCircumferenceCm: null, waistCircumferenceCm: null, hipCircumferenceCm: null, thighCircumferenceCm: null,
      shoulderWidthCm: null, inseamCm: null, preferredFit: 'regular', preferredStyles: [],
    },
    wearReminderPreferences: { enabled: false, intervalDays: 7, combinationReminderEnabled: true, itemReminderEnabled: true },
  }
}

function captureHook<T>(client: QueryClient, useValue: () => T): T {
  let value!: T
  function Capture() { value = useValue(); return null }
  renderToString(createElement(QueryClientProvider, { client }, createElement(Capture)))
  return value
}

for (const kind of ['profile', 'reminder'] as const) {
  for (const transition of ['same-session', 'different-viewer', 'same-viewer-new-session', 'logout', 'before-cache-write'] as const) {
    test(`${kind}: ${transition}에서는 저장을 시작한 인증 세션의 결과만 반영한다`, async (t) => {
      const originalWindow = globalThis.window
      let accessToken: string | null = 'session-A'
      const client: QueryClient = new QueryClient({
        defaultOptions: { mutations: { gcTime: Infinity } },
        mutationCache: new MutationCache({ onSuccess: () => {
          // 요청은 A 세션에서 끝났지만, hook의 캐시 쓰기 콜백 직전에 B 로그인이 끝난 경우다.
          if (transition !== 'before-cache-write') return
          accessToken = 'session-B'
          client.clear()
          client.setQueryData(queryKeys.me, createViewer('viewer-B'))
        } }),
      })
      const localProfileBefore = useStyleProfileStore.getState().profile
      let release!: () => void
      const gate = new Promise<void>((resolve) => { release = resolve })
      let markRequested!: () => void
      const requested = new Promise<void>((resolve) => { markRequested = resolve })
      const before = createViewer('viewer-A')
      const saved = {
        ...createViewer('viewer-A', 185),
        styleProfile: { ...createViewer('viewer-A', 185).styleProfile, thighCircumferenceCm: 70 },
        wearReminderPreferences: { ...before.wearReminderPreferences, enabled: true },
      }
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: {
          localStorage: { getItem: () => accessToken },
          ClosetNative: { requestGraphql: async () => {
            markRequested()
            await gate
            return { ok: true, payload: { data: kind === 'profile'
              ? { updateMyStyleProfile: saved }
              : { updateWearReminderPreferences: saved } } }
          } },
        },
      })
      t.after(() => {
        release()
        client.clear()
        useStyleProfileStore.setState({ profile: localProfileBefore })
        Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
      })
      client.setQueryData(queryKeys.me, before)
      const pending = kind === 'profile'
        ? captureHook(client, useUpdateStyleProfileMutation).mutateAsync({ ...saved.styleProfile, gender: 'male', bodyBuild: 'average' })
        : captureHook(client, useUpdateWearReminderPreferencesMutation).mutateAsync(saved.wearReminderPreferences)
      await requested
      if (transition !== 'same-session' && transition !== 'before-cache-write') {
        client.clear()
        accessToken = transition === 'logout' ? null : 'session-B'
        if (transition !== 'logout') client.setQueryData(queryKeys.me, transition === 'different-viewer' ? createViewer('viewer-B') : before)
      }
      const expected = client.getQueryData(queryKeys.me)
      release()
      if (transition === 'same-session') {
        assert.deepEqual(await pending, saved)
        assert.deepEqual(client.getQueryData(queryKeys.me), saved)
        if (kind === 'profile') {
          assert.equal(useStyleProfileStore.getState().profile.heightCm, '185')
          assert.equal(useStyleProfileStore.getState().profile.thighCircumferenceCm, '70')
        }
      } else {
        await assert.rejects(pending, ViewerSessionChangedError)
        assert.deepEqual(client.getQueryData(queryKeys.me), transition === 'before-cache-write' ? createViewer('viewer-B') : expected)
        assert.deepEqual(useStyleProfileStore.getState().profile, localProfileBefore)
      }
    })
  }
}
