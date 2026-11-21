/**
 * 진입 경로: 하단 설정 탭 → 최근 착용 리마인드
 *
 * 용도:
 * 최근에 사용한 코디 조합과 개별 옷을 다시 선택할 때 보여줄 리마인드 기준을 관리한다.
 *
 * 구조:
 * 스위치와 기간 선택을 바꾸는 즉시 저장한다.
 */
import { ChevronLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageTitle } from '../../../components/PageTitle'
import { ToggleSwitch } from '../../../components/ToggleSwitch'
import { useUiStore } from '../../../stores/useUiStore'
import {
  useMeQuery,
  useUpdateWearReminderPreferencesMutation,
  ViewerSessionChangedError,
  type WearReminderPreferences,
} from '../api/profileQueries'

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
      <ToggleSwitch
        checked={checked}
        disabled={disabled}
        ariaLabel={`${title} ${checked ? '끄기' : '켜기'}`}
        onChange={onChange}
      />
    </div>
  )
}

interface WearReminderSettingsFormProps {
  preferences: WearReminderPreferences
}

function WearReminderSettingsForm({ preferences }: WearReminderSettingsFormProps) {
  const pushToast = useUiStore((state) => state.pushToast)
  const updatePreferences = useUpdateWearReminderPreferencesMutation()
  const { enabled, combinationReminderEnabled, itemReminderEnabled, intervalDays } = preferences
  const { isPending } = updatePreferences
  const presetSelected = quickIntervals.some((days) => days === intervalDays)

  /** 한 설정씩 저장하고, 서버 응답이 도착하면 Viewer 캐시에서 값을 갱신한다. */
  const savePreferences = async (input: Partial<WearReminderPreferences>) => {
    if (isPending) return
    try {
      await updatePreferences.mutateAsync({ ...preferences, ...input })
    } catch (error) {
      if (error instanceof ViewerSessionChangedError) return
      pushToast(
        error instanceof Error
          ? error.message
          : '최근 착용 리마인드 설정을 저장하지 못했어요.',
        'error',
      )
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-2xl space-y-5 px-5 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-8">
          <section className="overflow-hidden rounded-3xl border border-line bg-surface">
            <ToggleRow
              title="최근 착용 확인"
              description="코디를 고를 때 최근에 입은 옷이 겹치면 알려드려요."
              checked={enabled}
              disabled={isPending}
              onChange={(checked) => void savePreferences({ enabled: checked })}
            />
          </section>

          <fieldset
            disabled={!enabled || isPending}
            className="disabled:opacity-50"
          >
            <legend className="px-1 text-sm font-semibold">최근 며칠까지 확인할까요?</legend>
            <div className="mt-3 rounded-3xl border border-line bg-surface p-4 sm:p-5">
              <div className="grid grid-cols-4 gap-2">
                {quickIntervals.map((days) => (
                  <button
                    type="button"
                    onClick={() => {
                      if (days !== intervalDays) void savePreferences({ intervalDays: days })
                    }}
                    aria-pressed={intervalDays === days}
                    className={`rounded-xl border px-2 py-2.5 text-xs font-bold transition ${
                      intervalDays === days
                        ? 'border-ink bg-ink text-white'
                        : 'border-line bg-canvas text-muted hover:border-ink hover:text-ink'
                    }`}
                    key={days}
                  >
                    {days}일
                  </button>
                ))}
              </div>
              {!presetSelected && <p className="mt-2 text-xs text-muted">현재 설정 · {intervalDays}일</p>}
            </div>
          </fieldset>

          <fieldset
            disabled={!enabled || isPending}
            className="disabled:opacity-50"
          >
            <legend className="px-1 text-sm font-semibold">확인할 기준</legend>

            <div className="mt-3 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
              <ToggleRow
                title="같은 코디 조합"
                description="같은 코디를 다시 고르거나, 최근에 함께 입은 주요 옷이 두 벌 이상 겹치면 알려줘요."
                checked={combinationReminderEnabled}
                disabled={!enabled || isPending}
                onChange={(checked) => void savePreferences({ combinationReminderEnabled: checked })}
              />
              <ToggleRow
                title="최근에 입은 옷"
                description="최근에 입은 주요 옷이 한 벌만 겹쳐도 알려줘요."
                checked={itemReminderEnabled}
                disabled={!enabled || isPending}
                onChange={(checked) => void savePreferences({ itemReminderEnabled: checked })}
              />
            </div>
          </fieldset>

          {enabled &&
            !combinationReminderEnabled &&
            !itemReminderEnabled && (
              <p className="rounded-2xl bg-danger-soft px-4 py-3.5 text-xs leading-5 text-danger">
                확인할 기준이 모두 꺼져 있어 리마인드가 나타나지 않아요.
              </p>
            )}

        </div>
      </div>
    </div>
  )
}

export function WearReminderSettingsPage() {
  const meQuery = useMeQuery()
  const viewer = meQuery.data

  return (
    <section
      className="classification-page-enter fixed inset-0 z-[80] flex h-dvh flex-col overflow-hidden bg-canvas"
      role="dialog"
      aria-modal="true"
      aria-label="최근 착용 알림"
    >
      <header className="shrink-0 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-2xl items-center gap-2 px-3 py-2 sm:min-h-18 sm:px-5">
          <Link
            to="/settings"
            className="flex size-10 shrink-0 items-center justify-center rounded-full transition hover:bg-surface"
            aria-label="최근 착용 알림 닫기"
            autoFocus
          >
            <ChevronLeft size={24} strokeWidth={2.2} />
          </Link>
          <PageTitle
            title="최근 착용 알림"
            description="코디를 고를 때 적용할 확인 기준"
            compact
          />
        </div>
      </header>

      {viewer ? (
        <WearReminderSettingsForm key={viewer.id} preferences={viewer.wearReminderPreferences} />
      ) : meQuery.isError ? (
        <div className="px-5 py-16 text-center">
          <p role="alert" className="text-sm text-muted">리마인드 설정을 불러오지 못했어요.</p>
          <button
            type="button"
            onClick={() => void meQuery.refetch()}
            disabled={meQuery.isFetching}
            className="mt-4 rounded-full bg-ink px-5 py-2 text-sm font-bold text-white"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <p role="status" className="px-5 py-16 text-center text-sm text-muted">
          리마인드 설정을 불러오는 중…
        </p>
      )}
    </section>
  )
}
