/**
 * 진입 경로: 하단 설정 탭 → 최근 착용 리마인드
 *
 * 용도:
 * 최근에 사용한 코디 조합과 개별 옷을 다시 선택할 때 보여줄 리마인드 기준을 관리한다.
 *
 * 구조:
 * 전체 사용 여부, 알림 기간, 조합·개별 옷 기준과 저장 영역으로 구성되어 있다.
 */
import { useState } from 'react'
import { ChevronLeft, Save } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageTitle } from '../../../components/PageTitle'
import { useUiStore } from '../../../stores/useUiStore'
import {
  useMeQuery,
  useUpdateWearReminderPreferencesMutation,
  type WearReminderPreferences,
} from '../api/profileQueries'

const defaultPreferences: WearReminderPreferences = {
  enabled: false,
  intervalDays: 7,
  combinationReminderEnabled: true,
  itemReminderEnabled: true,
}
const quickIntervals = [3, 7, 14, 30] as const

interface ToggleRowProps {
  title: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}

function ToggleRow({
  title,
  description,
  checked,
  disabled = false,
  onChange,
}: ToggleRowProps) {
  return (
    <div className="flex items-start gap-4 px-4 py-4 sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`${title} ${checked ? '끄기' : '켜기'}`}
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${
          checked ? 'bg-ink' : 'bg-line'
        }`}
      >
        <span
          className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

interface WearReminderSettingsFormProps {
  initialPreferences: WearReminderPreferences
  isLoading: boolean
}

function WearReminderSettingsForm({
  initialPreferences,
  isLoading,
}: WearReminderSettingsFormProps) {
  const pushToast = useUiStore((state) => state.pushToast)
  const updatePreferences = useUpdateWearReminderPreferencesMutation()
  const [enabled, setEnabled] = useState(initialPreferences.enabled)
  const [intervalDays, setIntervalDays] = useState(
    initialPreferences.intervalDays.toString(),
  )
  const [combinationReminderEnabled, setCombinationReminderEnabled] = useState(
    initialPreferences.combinationReminderEnabled,
  )
  const [itemReminderEnabled, setItemReminderEnabled] = useState(
    initialPreferences.itemReminderEnabled,
  )
  const isPending = isLoading || updatePreferences.isPending
  const selectedInterval = Number(intervalDays)

  const savePreferences = async () => {
    const parsedIntervalDays = Number(intervalDays)
    if (
      !Number.isInteger(parsedIntervalDays) ||
      parsedIntervalDays < 1 ||
      parsedIntervalDays > 30
    ) {
      pushToast('알림 기간은 1일에서 30일 사이로 입력해주세요.', 'error')
      return
    }

    try {
      await updatePreferences.mutateAsync({
        enabled,
        intervalDays: parsedIntervalDays,
        combinationReminderEnabled,
        itemReminderEnabled,
      })
      pushToast('최근 착용 리마인드 설정을 저장했습니다.', 'success')
    } catch (error) {
      pushToast(
        error instanceof Error
          ? error.message
          : '최근 착용 리마인드 설정을 저장하지 못했습니다.',
        'error',
      )
    }
  }

  return (
    <form
      className="relative flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        void savePreferences()
      }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-2xl space-y-5 px-5 pt-6 pb-32 sm:px-6 sm:pt-8">
          <section className="overflow-hidden rounded-3xl border border-line bg-surface">
            <ToggleRow
              title="최근 착용 리마인드"
              description="설정한 기간 안에 입었던 조합이나 옷을 다시 고르면 한 번 더 확인해요."
              checked={enabled}
              disabled={isPending}
              onChange={setEnabled}
            />
          </section>

          <fieldset
            disabled={!enabled || isPending}
            className="disabled:opacity-50"
          >
            <legend className="px-1 text-sm font-black">알림 기간</legend>
            <p className="mt-1 px-1 text-xs leading-5 text-muted">
              최근 며칠 안에 사용한 코디와 옷을 알려줄지 정해요.
            </p>

            <div className="mt-3 rounded-3xl border border-line bg-surface p-4 transition disabled:opacity-40 sm:p-5">
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-muted">
                  직접 입력
                </span>
                <span className="relative block">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="30"
                    step="1"
                    value={intervalDays}
                    onChange={(event) => setIntervalDays(event.target.value)}
                    className="w-full rounded-xl border border-line bg-canvas px-4 py-3 pr-12 text-sm font-bold outline-none transition focus:border-ink disabled:cursor-not-allowed"
                    aria-label="최근 착용 알림 기간"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs font-bold text-muted">
                    일
                  </span>
                </span>
              </label>

              <div className="mt-3 grid grid-cols-4 gap-2">
                {quickIntervals.map((days) => (
                  <button
                    type="button"
                    onClick={() => setIntervalDays(days.toString())}
                    aria-pressed={selectedInterval === days}
                    className={`rounded-xl border px-2 py-2.5 text-xs font-bold transition ${
                      selectedInterval === days
                        ? 'border-ink bg-ink text-white'
                        : 'border-line bg-canvas text-muted hover:border-ink hover:text-ink'
                    }`}
                    key={days}
                  >
                    {days}일
                  </button>
                ))}
              </div>
            </div>
          </fieldset>

          <fieldset
            disabled={!enabled || isPending}
            className="disabled:opacity-50"
          >
            <legend className="px-1 text-sm font-black">확인할 기준</legend>
            <p className="mt-1 px-1 text-xs leading-5 text-muted">
              필요한 기준만 켜둘 수 있어요.
            </p>

            <div className="mt-3 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
              <ToggleRow
                title="같은 조합"
                description="최근에 함께 입었던 핵심 옷 조합이 겹치면 알려줘요."
                checked={combinationReminderEnabled}
                disabled={!enabled || isPending}
                onChange={setCombinationReminderEnabled}
              />
              <ToggleRow
                title="개별 옷"
                description="선택한 상의·하의·아우터 등 핵심 옷 중 최근에 입은 옷이 있으면 알려줘요."
                checked={itemReminderEnabled}
                disabled={!enabled || isPending}
                onChange={setItemReminderEnabled}
              />
            </div>
          </fieldset>

          {enabled &&
            !combinationReminderEnabled &&
            !itemReminderEnabled && (
              <p className="rounded-2xl bg-[#fff0ec] px-4 py-3.5 text-xs leading-5 text-accent">
                확인할 기준이 모두 꺼져 있어 리마인드가 나타나지 않아요.
              </p>
            )}

          {!enabled && (
            <p className="rounded-2xl bg-sage/70 px-4 py-3.5 text-xs leading-5 text-muted">
              리마인드를 다시 켜면 저장해둔 기간과 세부 기준을 그대로 사용해요.
            </p>
          )}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(27,27,24,0.06)] backdrop-blur sm:px-6 sm:pt-4 sm:pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-2xl">
          <button
            type="submit"
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
          >
            <Save size={17} />
            {isPending ? '저장 중...' : '리마인드 설정 저장'}
          </button>
        </div>
      </div>
    </form>
  )
}

export function WearReminderSettingsPage() {
  const meQuery = useMeQuery()
  const preferences =
    meQuery.data?.wearReminderPreferences ?? defaultPreferences

  return (
    <section
      className="classification-page-enter fixed inset-0 z-[80] flex h-dvh flex-col overflow-hidden bg-canvas"
      role="dialog"
      aria-modal="true"
      aria-label="최근 착용 리마인드"
    >
      <header className="shrink-0 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-2xl items-center gap-2 px-3 py-2 sm:min-h-18 sm:px-5">
          <Link
            to="/settings"
            className="flex size-10 shrink-0 items-center justify-center rounded-full transition hover:bg-surface"
            aria-label="최근 착용 리마인드 닫기"
            autoFocus
          >
            <ChevronLeft size={24} strokeWidth={2.2} />
          </Link>
          <PageTitle
            title="최근 착용 리마인드"
            description="반복 착용을 확인할 기준을 관리해보세요."
            compact
          />
        </div>
      </header>

      <WearReminderSettingsForm
        key={meQuery.dataUpdatedAt || 'wear-reminder-defaults'}
        initialPreferences={preferences}
        isLoading={meQuery.isLoading}
      />
    </section>
  )
}
