import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { queryKeys } from '../src/lib/queryKeys'
import { useSetDirectPlannerEntryMutation, useSetPlannerEntryMutation, useSetPlannerEntryWornMutation } from '../src/features/plan/api/plannerQueries'
import { createEmptyWeeklyPlan, type PlanEntry } from '../src/features/plan/data/weeklyPlan'
import { usePlanStore } from '../src/features/plan/stores/usePlanStore'

function captureHook<T>(client: QueryClient, useValue: () => T): T {
  let value!: T
  function Capture() { value = useValue(); return null }
  renderToString(createElement(QueryClientProvider, { client }, createElement(Capture)))
  return value
}

for (const kind of ['saved', 'direct', 'worn'] as const) {
  for (const changeSession of [false, true]) {
    test(`${kind}: 착용 저장 응답은 ${changeSession ? '바뀐 세션의 캐시와 편집을 덮지 않는다' : '현재 세션의 날짜·주간·통계에 반영된다'}`, async t => {
      const originalWindow = globalThis.window
      const originalEntries = usePlanStore.getState().entries
      let accessToken = 'session-A'
      const client = new QueryClient({ defaultOptions: { mutations: { gcTime: Infinity } } })
      const date = '2026-11-16'
      const weekKey = queryKeys.planner.week(date)
      const dayKey = queryKeys.planner.entries(date, date)
      const empty = createEmptyWeeklyPlan(date)
      client.setQueryData(weekKey, empty)
      client.setQueryData(dayKey, [empty[0]])
      client.setQueryData(queryKeys.wardrobe.statistics, { wearCount: 0 })
      usePlanStore.setState({ entries: empty })
      let release!: () => void
      const gate = new Promise<void>(resolve => { release = resolve })
      let markRequested!: () => void
      const requested = new Promise<void>(resolve => { markRequested = resolve })
      const field = kind === 'saved' ? 'setPlannerEntry' : kind === 'direct' ? 'setDirectPlannerEntry' : 'setPlannerEntryWorn'
      const wornAt = '2026-11-16T01:00:00Z'
      Object.defineProperty(globalThis, 'window', { configurable: true, value: {
        localStorage: { getItem: () => accessToken },
        ClosetNative: { requestGraphql: async () => {
          markRequested()
          await gate
          return { ok: true, payload: { data: { [field]: { id: 'week', weekStartsOn: date, entries: [{
            date, title: '실제 입은 코디', occasion: null, temperatureC: null, weatherSummary: null, wornAt,
            outfit: { id: 'snapshot', name: '실제 입은 코디', style: 'casual', plannerOnly: true, items: [], generations: [] },
          }] } } } }
        } },
      } })
      t.after(() => {
        release()
        client.clear()
        usePlanStore.setState({ entries: originalEntries })
        Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
      })
      const pending = kind === 'saved'
        ? captureHook(client, useSetPlannerEntryMutation).mutateAsync({ weekStartsOn: date, date, outfitId: 'source', confirmWorn: true })
        : kind === 'direct'
          ? captureHook(client, useSetDirectPlannerEntryMutation).mutateAsync({ weekStartsOn: date, date, itemIds: ['shirt', 'pants'], confirmWorn: true })
          : captureHook(client, useSetPlannerEntryWornMutation).mutateAsync({ weekStartsOn: date, date, outfitId: 'snapshot', worn: true })
      await requested
      if (changeSession) accessToken = 'session-B'
      release()
      await pending
      if (changeSession) {
        assert.deepEqual(client.getQueryData(weekKey), empty)
        assert.deepEqual(client.getQueryData(dayKey), [empty[0]])
        assert.deepEqual(usePlanStore.getState().entries, empty)
        assert.equal(client.getQueryState(queryKeys.wardrobe.statistics)?.isInvalidated, false)
      } else {
        assert.equal(client.getQueryData<PlanEntry[]>(weekKey)?.[0].wornAt, wornAt)
        assert.equal(client.getQueryData<PlanEntry[]>(dayKey)?.[0].wornAt, wornAt)
        assert.equal(usePlanStore.getState().entries[0].wornAt, wornAt)
        assert.equal(client.getQueryState(queryKeys.wardrobe.statistics)?.isInvalidated, true)
      }
    })
  }
}
