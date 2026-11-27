import type { WearFeeling } from '@closet/types'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { SegmentedControl } from '../../../components/SegmentedControl'

const feelingOptions: Array<{ value: WearFeeling; label: string }> = [
  { value: 'cold', label: '추웠어요' },
  { value: 'comfortable', label: '적당했어요' },
  { value: 'hot', label: '더웠어요' },
]

/** 체감과 선택 기온을 두 단계로 받아 한 번에 저장한다. 저장 실패 시 입력값을 유지한다. */
export function PlannerWearFeelingDialog({
  isSaving,
  initialFeeling = null,
  manualTemperatureC = null,
  automaticTemperatureC = null,
  forecastTemperatureC = null,
  isEditing = false,
  onSave,
  onClose,
}: {
  isSaving: boolean
  initialFeeling?: WearFeeling | null
  manualTemperatureC?: number | null
  automaticTemperatureC?: number | null
  forecastTemperatureC?: number | null
  isEditing?: boolean
  onSave: (feeling: WearFeeling | null, manualTemperatureC: number | null) => Promise<void>
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const titleId = useId()
  const inputId = useId()
  const [step, setStep] = useState<1 | 2>(1)
  const [feeling, setFeeling] = useState(initialFeeling)
  const [temperatureInput, setTemperatureInput] = useState(String(manualTemperatureC ?? ''))
  const [error, setError] = useState<string | null>(null)
  const defaultTemperatureC = automaticTemperatureC ?? forecastTemperatureC

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => dialog.close()
  }, [])

  useLayoutEffect(() => { titleRef.current?.focus() }, [step])

  const save = async () => {
    const rawTemperature = temperatureInput.trim()
    const parsedTemperature = rawTemperature ? Number(rawTemperature.replace(',', '.')) : null
    if (parsedTemperature !== null && (!Number.isFinite(parsedTemperature) || parsedTemperature < -100 || parsedTemperature > 100)) {
      setError('기온은 -100℃부터 100℃까지 입력해주세요.')
      return
    }
    setError(null)
    try {
      await onSave(feeling, parsedTemperature)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '착용 체감을 저장하지 못했어요.')
    }
  }

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} aria-modal="true" aria-busy={isSaving}
      onKeyDown={(event) => { if (event.key === 'Escape') event.stopPropagation() }}
      onCancel={(event) => {
        event.preventDefault()
        if (!isSaving) onClose()
      }}
      className="option-picker-enter fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-3xl border border-line bg-surface p-5 text-ink shadow-2xl backdrop:bg-ink/40 sm:p-6">
      <p className="text-center text-xs font-semibold tabular-nums text-muted" aria-label={`2단계 중 ${step}단계`}>{step}/2</p>
      <div key={step} className={step === 1 ? 'plan-period-backward-enter' : 'plan-period-forward-enter'}>
        <h2 ref={titleRef} id={titleId} tabIndex={-1} className="mt-1 text-center text-xl font-semibold tracking-tight focus:outline-none">
          {step === 1 ? '입었을 때 어땠나요?' : '몇 도에 입었나요?'}
        </h2>
        {step === 1 ? <>
          <div className="mt-5 grid gap-2">
            {feelingOptions.map(({ value, label }) => (
              <button key={value} type="button" aria-pressed={feeling === value} onClick={() => { setFeeling(value); setStep(2) }}
                className="min-h-11 rounded-xl border border-line bg-canvas px-3 py-2 text-sm font-semibold hover:bg-sage focus-visible:outline-2 focus-visible:outline-accent aria-pressed:border-accent aria-pressed:bg-sage">
                {label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex justify-center gap-3 text-sm font-semibold">
            <button type="button" onClick={onClose} className="min-h-11 rounded-lg px-2 text-muted hover:text-ink">{isEditing ? '취소' : '건너뛰기'}</button>
            <button type="button" onClick={() => setStep(2)} className="min-h-11 rounded-lg px-2 text-accent hover:underline">{isEditing ? '기온만 수정' : '기온만 기록'}</button>
          </div>
        </> : <form onSubmit={(event) => { event.preventDefault(); if (!isSaving) void save() }}>
          <label htmlFor={inputId} className="mt-5 block text-sm font-semibold">착용 기온 (선택)</label>
          <div className="mt-2 flex items-center rounded-xl border border-line bg-canvas focus-within:border-accent">
            <input id={inputId} type="text" inputMode="decimal" value={temperatureInput} disabled={isSaving}
              onChange={(event) => setTemperatureInput(event.target.value)} placeholder={defaultTemperatureC === null ? undefined : String(defaultTemperatureC)}
              className="min-h-11 min-w-0 flex-1 bg-transparent px-3 text-base outline-none" />
            <span className="pr-3 text-sm text-muted" aria-hidden="true">℃</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">{defaultTemperatureC === null
            ? '비워두면 날씨 정보가 있는 착용일의 평균 기온을 확인한 뒤 자동으로 채워요.'
            : `비워두면 착용일의 ${automaticTemperatureC === null ? '예보 평균' : '실제 평균'} ${defaultTemperatureC}℃를 사용해요.`}</p>
          {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
          <div className="mt-5 grid grid-cols-[0.8fr_1.2fr] gap-2 text-sm font-semibold">
            <button type="button" disabled={isSaving} onClick={() => { setError(null); setStep(1) }} className="min-h-11 rounded-xl border border-line disabled:opacity-50">이전</button>
            <button type="submit" disabled={isSaving} className="min-h-11 rounded-xl bg-accent text-white disabled:opacity-50">{isSaving ? '저장 중…' : '저장'}</button>
          </div>
        </form>}
      </div>
    </dialog>
  )
}

interface PlannerWearFeelingProps {
  value: WearFeeling | null
  disabled: boolean
  onChange: (feeling: WearFeeling | null) => void
}

/** 착용을 확인한 코디의 온도 체감을 세 가지 중 하나로 표시한다. 선택·지우기는 부모의 저장 동작에 맡기고 저장 중에는 모든 조작을 막는다. */
export function PlannerWearFeeling({ value, disabled, onChange }: PlannerWearFeelingProps) {
  return (
    <div className="mt-2 border-t border-line/70 pt-2">
      <div className="mb-2 flex min-h-5 items-center justify-between gap-2">
        <p className="text-[11px] font-bold">착용 체감</p>
        {value && (
          <button type="button" disabled={disabled} onClick={() => onChange(null)} className="text-[10px] text-muted underline underline-offset-2 transition hover:text-ink disabled:cursor-wait disabled:opacity-50">
            체감 기록 지우기
          </button>
        )}
      </div>
      <fieldset disabled={disabled} className="min-w-0 disabled:opacity-60">
        <SegmentedControl<WearFeeling>
          ariaLabel="착용 체감"
          value={value}
          options={feelingOptions}
          onChange={onChange}
          className="[&>button]:min-h-8 [&>button]:px-2 [&>button]:py-2 [&>button]:text-[11px] [&>button:disabled]:cursor-wait"
        />
      </fieldset>
    </div>
  )
}
