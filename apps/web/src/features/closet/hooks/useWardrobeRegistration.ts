import { useEffect, useReducer, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Season } from '@closet/types'
import { getAccessToken } from '../../../lib/auth'
import { useUiStore, type ClassificationCandidate } from '../../../stores/useUiStore'
import { useClosetStore } from '../stores/useClosetStore'
import { invalidateSavedWardrobeQueries, useSaveWardrobeItemMutation } from '../api/saveWardrobeItem'
import { createWardrobeRegistrationDraft, toWardrobeRegistrationInput, validateWardrobeRegistrationDraft, type WardrobeRegistrationDraft } from '../utils/wardrobeRegistration'

interface State {
  /** 후보 ID별 사용자 편집 값. 분석 대기열과 사진 바이트를 복사하지 않는다. */
  drafts: Record<string, WardrobeRegistrationDraft>
  excluded: string[]
  errors: Record<string, string>
  commonSeasons: Season[]
  saving: boolean
  progress: { done: number; total: number }
}
type Action =
  | { type: 'edit'; id: string; draft: WardrobeRegistrationDraft }
  | { type: 'toggle'; id: string; draft: WardrobeRegistrationDraft }
  | { type: 'seasons'; drafts: Record<string, WardrobeRegistrationDraft>; seasons: Season[] }
  | { type: 'start'; ids: string[] }
  | { type: 'result'; id: string; error?: string }
  | { type: 'finish' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'edit': return { ...state, drafts: { ...state.drafts, [action.id]: action.draft }, errors: { ...state.errors, [action.id]: '' } }
    case 'toggle': return {
      ...state,
      // 선택을 바꾼 시점의 값을 확정해 이후 공통 계절이 제외한 기존 행에 스며들지 않게 한다.
      drafts: { ...state.drafts, [action.id]: action.draft },
      excluded: state.excluded.includes(action.id) ? state.excluded.filter((id) => id !== action.id) : [...state.excluded, action.id],
    }
    case 'seasons': return { ...state, commonSeasons: action.seasons, drafts: { ...state.drafts, ...action.drafts } }
    case 'start': return { ...state, saving: true, progress: { done: 0, total: action.ids.length }, errors: Object.fromEntries(Object.entries(state.errors).filter(([id]) => !action.ids.includes(id))) }
    case 'result': return { ...state, progress: { ...state.progress, done: state.progress.done + 1 }, errors: { ...state.errors, [action.id]: action.error ?? '' } }
    case 'finish': return { ...state, saving: false }
  }
}

/**
 * 묶음 등록의 초안·선택·공통 계절과 부분 실패를 관리한다.
 * 저장 클릭 시 대상을 고정해 한 벌씩 기존 API로 전송하며, 새로 분석된 사진은 다음 저장까지 대기한다.
 */
export function useWardrobeRegistration(candidates: ClassificationCandidate[]) {
  const [state, dispatch] = useReducer(reducer, { drafts: {}, excluded: [], errors: {}, commonSeasons: [], saving: false, progress: { done: 0, total: 0 } })
  const mutation = useSaveWardrobeItemMutation({ deferInvalidation: true })
  const client = useQueryClient()
  const running = useRef<AbortController | null>(null)
  useEffect(() => () => { running.current?.abort() }, [])
  const rows = candidates.map((candidate) => ({
    candidate,
    draft: state.drafts[candidate.itemId] ?? { ...createWardrobeRegistrationDraft(candidate), seasons: state.commonSeasons },
    selected: !state.excluded.includes(candidate.itemId),
    error: state.errors[candidate.itemId],
  }))
  const selected = rows.filter((row) => row.selected)

  /** 지정한 후보의 입력만 바꾸고 다른 행의 편집 값은 유지한다. */
  const edit = (id: string, draft: WardrobeRegistrationDraft) => dispatch({ type: 'edit', id, draft })
  const applySeasons = (seasons: Season[]) => dispatch({
    type: 'seasons', seasons,
    drafts: Object.fromEntries(selected.map((row) => [row.candidate.itemId, { ...row.draft, seasons }])),
  })

  /** 성공한 항목만 확인 대기열에서 제거하고, 실패한 항목은 같은 요청 키·업로드 자산으로 재시도한다. */
  const save = async () => {
    if (running.current || !selected.length || selected.some((row) => validateWardrobeRegistrationDraft(row.draft))) return
    const token = getAccessToken()
    const controller = new AbortController()
    running.current = controller
    const targets = selected.map((row) => ({ candidate: row.candidate, input: toWardrobeRegistrationInput(row.draft) }))
    dispatch({ type: 'start', ids: targets.map((row) => row.candidate.itemId) })
    let saved = 0
    let failed = 0
    try {
      for (const target of targets) {
        if (controller.signal.aborted || getAccessToken() !== token) break
        try {
          const item = await mutation.mutateAsync({ ...target, signal: controller.signal })
          if (controller.signal.aborted || getAccessToken() !== token) break
          useClosetStore.getState().mergeItems([item])
          useUiStore.getState().completeClassification(target.candidate.itemId)
          saved++
          dispatch({ type: 'result', id: target.candidate.itemId })
        } catch (error) {
          if (controller.signal.aborted || getAccessToken() !== token) break
          failed++
          dispatch({ type: 'result', id: target.candidate.itemId, error: error instanceof Error ? error.message : '저장하지 못했어요. 다시 시도해주세요.' })
        }
      }
      if (!controller.signal.aborted && getAccessToken() === token) {
        invalidateSavedWardrobeQueries(client)
        useUiStore.getState().pushToast(failed ? `${saved}벌을 저장했어요. 실패한 ${failed}벌은 다시 저장해주세요.` : `${saved}벌을 옷장에 추가했어요.`, failed ? 'info' : 'success')
      }
    } finally {
      if (running.current === controller) running.current = null
      if (!controller.signal.aborted) dispatch({ type: 'finish' })
    }
  }
  return { rows, saving: state.saving, progress: state.progress, commonSeasons: state.commonSeasons, selectedCount: selected.length,
    canSave: selected.length > 0 && !selected.some((row) => validateWardrobeRegistrationDraft(row.draft)),
    actions: { edit, applySeasons, toggle: (id: string) => {
      const row = rows.find((entry) => entry.candidate.itemId === id)
      if (row) dispatch({ type: 'toggle', id, draft: row.draft })
    }, save } }
}
