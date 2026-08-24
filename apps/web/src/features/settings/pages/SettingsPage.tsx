import { useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CloudSun,
  Info,
  LogOut,
  Ruler,
  Save,
  Sparkles,
  Weight,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { PageTitle } from '../../../components/PageTitle'
import { SegmentedControl } from '../../../components/SegmentedControl'
import { outfitStyleOptions } from '../../../constants/styleOptions'
import { useUiStore } from '../../../stores/useUiStore'
import {
  useMeQuery,
  useUpdateStyleProfileMutation,
} from '../api/profileQueries'
import { useLogoutMutation } from '../../auth/api/authQueries'
import {
  type BodyBuild,
  type Gender,
  type PreferredFit,
  type PreferredStyle,
  type StyleProfile,
  useStyleProfileStore,
} from '../stores/useStyleProfileStore'

const genderOptions: Array<{ label: string; value: Gender }> = [
  { label: '남성', value: 'male' },
  { label: '여성', value: 'female' },
]

const bodyBuildOptions: Array<{ label: string; value: BodyBuild }> = [
  { label: '슬림', value: 'slim' },
  { label: '보통', value: 'average' },
  { label: '근육형', value: 'athletic' },
  { label: '큰 체격', value: 'broad' },
]

const fitOptions: Array<{
  label: string
  description: string
  value: PreferredFit
}> = [
  { label: '여유롭게', description: '넓은 착용감', value: 'wide' },
  { label: '기본', description: '정사이즈 착용감', value: 'regular' },
  { label: '슬림하게', description: '몸에 맞는 착용감', value: 'skinny' },
]

type DetailedBodyKey =
  | 'chestCircumferenceCm'
  | 'waistCircumferenceCm'
  | 'hipCircumferenceCm'
  | 'shoulderWidthCm'
  | 'inseamCm'

const detailedBodyFields: Array<{
  key: DetailedBodyKey
  label: string
  placeholder: string
  min: number
  max: number
}> = [
  { key: 'chestCircumferenceCm', label: '가슴둘레', placeholder: '90', min: 40, max: 200 },
  { key: 'waistCircumferenceCm', label: '허리둘레', placeholder: '72', min: 40, max: 200 },
  { key: 'hipCircumferenceCm', label: '엉덩이둘레', placeholder: '94', min: 40, max: 200 },
  { key: 'shoulderWidthCm', label: '어깨너비', placeholder: '42', min: 20, max: 80 },
  { key: 'inseamCm', label: '인심', placeholder: '76', min: 40, max: 130 },
]

interface StyleProfileFormProps {
  initialProfile: StyleProfile
}

function StyleProfileForm({ initialProfile }: StyleProfileFormProps) {
  const updateProfile = useStyleProfileStore((state) => state.updateProfile)
  const pushToast = useUiStore((state) => state.pushToast)
  const updateStyleProfile = useUpdateStyleProfileMutation()
  const [gender, setGender] = useState(initialProfile.gender)
  const [bodyBuild, setBodyBuild] = useState(initialProfile.bodyBuild)
  const [heightCm, setHeightCm] = useState(initialProfile.heightCm)
  const [weightKg, setWeightKg] = useState(initialProfile.weightKg)
  const [bodyMeasurements, setBodyMeasurements] = useState<
    Record<DetailedBodyKey, string>
  >({
    chestCircumferenceCm: initialProfile.chestCircumferenceCm,
    waistCircumferenceCm: initialProfile.waistCircumferenceCm,
    hipCircumferenceCm: initialProfile.hipCircumferenceCm,
    shoulderWidthCm: initialProfile.shoulderWidthCm,
    inseamCm: initialProfile.inseamCm,
  })
  const [preferredFit, setPreferredFit] = useState(
    initialProfile.preferredFit,
  )
  const [preferredStyles, setPreferredStyles] = useState(
    initialProfile.preferredStyles,
  )

  const toggleStyle = (style: PreferredStyle) => {
    setPreferredStyles((currentStyles) =>
      currentStyles.includes(style)
        ? currentStyles.filter((item) => item !== style)
        : [...currentStyles, style],
    )
  }

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!gender) {
      pushToast('성별을 선택해주세요.', 'error')
      return
    }

    if (!bodyBuild) {
      pushToast('체형을 선택해주세요.', 'error')
      return
    }

    const height = Number(heightCm)
    const weight = Number(weightKg)

    if (heightCm && (height < 100 || height > 250)) {
      pushToast('키는 100cm에서 250cm 사이로 입력해주세요.', 'error')
      return
    }

    if (weightKg && (weight < 30 || weight > 250)) {
      pushToast('몸무게는 30kg에서 250kg 사이로 입력해주세요.', 'error')
      return
    }

    for (const field of detailedBodyFields) {
      const rawValue = bodyMeasurements[field.key]
      const value = Number(rawValue)
      if (rawValue && (value < field.min || value > field.max)) {
        pushToast(
          `${field.label}는 ${field.min}cm에서 ${field.max}cm 사이로 입력해주세요.`,
          'error',
        )
        return
      }
    }

    const detailedBodyInput = Object.fromEntries(
      detailedBodyFields.map((field) => [
        field.key,
        bodyMeasurements[field.key]
          ? Number(bodyMeasurements[field.key])
          : null,
      ]),
    ) as Record<DetailedBodyKey, number | null>

    try {
      await updateStyleProfile.mutateAsync({
        gender,
        bodyBuild,
        heightCm: heightCm ? height : null,
        weightKg: weightKg ? weight : null,
        ...detailedBodyInput,
        preferredFit,
        preferredStyles,
      })
      updateProfile({
        gender,
        bodyBuild,
        heightCm,
        weightKg,
        ...bodyMeasurements,
        preferredFit,
        preferredStyles,
      })
      pushToast('스타일 프로필을 저장했습니다.', 'success')
    } catch (error) {
      pushToast(
        error instanceof Error
          ? error.message
          : '스타일 프로필을 저장하지 못했습니다.',
        'error',
      )
    }
  }

  return (
    <form
      onSubmit={saveProfile}
      className="relative min-h-0 flex-1"
    >
      <div className="h-full overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-2xl px-5 pt-6 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-8 sm:pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
          <div className="overflow-hidden rounded-3xl border border-line bg-surface">
            <div className="space-y-8 p-5 sm:p-6">
              <fieldset>
                <legend className="text-sm font-black">신체 정보</legend>
                <p className="mt-1 text-xs text-muted">
                  AI 룩북에서 체형과 옷의 착용감을 표현할 때 참고해요.
                </p>

                <div className="mt-4">
                  <p className="mb-2 text-xs font-bold text-muted">성별</p>
                  <SegmentedControl
                    ariaLabel="성별"
                    value={gender}
                    options={genderOptions}
                    onChange={setGender}
                  />
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-xs font-bold text-muted">체형</p>
                  <SegmentedControl
                    ariaLabel="체형"
                    value={bodyBuild}
                    options={bodyBuildOptions}
                    onChange={setBodyBuild}
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted">
                      <Ruler size={14} /> 키
                    </span>
                    <span className="relative block">
                      <input
                        type="number"
                        inputMode="decimal"
                        min="100"
                        max="250"
                        step="0.1"
                        value={heightCm}
                        onChange={(event) => setHeightCm(event.target.value)}
                        placeholder="170"
                        className="w-full rounded-xl border border-line bg-canvas px-3 py-3 pr-10 text-sm font-bold outline-none transition focus:border-ink"
                      />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted">
                        cm
                      </span>
                    </span>
                  </label>

                  <label className="block">
                    <span className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted">
                      <Weight size={14} /> 몸무게
                    </span>
                    <span className="relative block">
                      <input
                        type="number"
                        inputMode="decimal"
                        min="30"
                        max="250"
                        step="0.1"
                        value={weightKg}
                        onChange={(event) => setWeightKg(event.target.value)}
                        placeholder="60"
                        className="w-full rounded-xl border border-line bg-canvas px-3 py-3 pr-10 text-sm font-bold outline-none transition focus:border-ink"
                      />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted">
                        kg
                      </span>
                    </span>
                  </label>
                </div>

                <div className="mt-5 border-t border-line pt-5">
                  <p className="text-xs font-black">상세 신체 치수</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {detailedBodyFields.map((field) => (
                      <label className="block" key={field.key}>
                        <span className="mb-2 block text-xs font-bold text-muted">
                          {field.label}
                        </span>
                        <span className="relative block">
                          <input
                            type="number"
                            inputMode="decimal"
                            min={field.min}
                            max={field.max}
                            step="0.1"
                            value={bodyMeasurements[field.key]}
                            onChange={(event) =>
                              setBodyMeasurements((current) => ({
                                ...current,
                                [field.key]: event.target.value,
                              }))
                            }
                            placeholder={field.placeholder}
                            className="w-full rounded-xl border border-line bg-canvas px-3 py-3 pr-9 text-sm font-bold outline-none transition focus:border-ink"
                          />
                          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted">
                            cm
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-black">선호하는 착용감</legend>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  {fitOptions.map((option) => {
                    const isSelected = preferredFit === option.value

                    return (
                      <button
                        type="button"
                        onClick={() => setPreferredFit(option.value)}
                        className={`rounded-2xl border px-2 py-3 text-center transition ${
                          isSelected
                            ? 'border-ink bg-ink text-white'
                            : 'border-line bg-canvas hover:border-ink'
                        }`}
                        aria-pressed={isSelected}
                        key={option.value}
                      >
                        <strong className="block text-xs">{option.label}</strong>
                        <span
                          className={`mt-1 hidden text-[10px] sm:block ${
                            isSelected ? 'text-white/70' : 'text-muted'
                          }`}
                        >
                          {option.description}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-black">선호하는 옷 스타일</legend>
                <p className="mt-1 text-xs text-muted">
                  여러 개 선택할 수 있어요.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {outfitStyleOptions.map((option) => {
                    const isSelected = preferredStyles.includes(option.value)

                    return (
                      <button
                        type="button"
                        onClick={() => toggleStyle(option.value)}
                        className={`rounded-full border px-3 py-2 text-xs font-bold transition outline-none focus-visible:ring-2 focus-visible:ring-accent/35 ${
                          isSelected
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-line bg-canvas text-muted hover:border-ink hover:text-ink'
                        }`}
                        aria-pressed={isSelected}
                        key={option.value}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(27,27,24,0.06)] backdrop-blur sm:px-6 sm:pt-4 sm:pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-2xl">
          <button
            type="submit"
            disabled={updateStyleProfile.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white"
          >
            <Save size={17} />
            {updateStyleProfile.isPending ? '저장 중...' : '프로필 저장'}
          </button>
        </div>
      </div>
    </form>
  )
}

export function StyleProfilePage() {
  const localProfile = useStyleProfileStore((state) => state.profile)
  const meQuery = useMeQuery()
  const initialProfile: StyleProfile = meQuery.data
    ? {
        gender: meQuery.data.styleProfile.gender,
        bodyBuild: meQuery.data.styleProfile.bodyBuild,
        heightCm: meQuery.data.styleProfile.heightCm?.toString() ?? '',
        weightKg: meQuery.data.styleProfile.weightKg?.toString() ?? '',
        chestCircumferenceCm:
          meQuery.data.styleProfile.chestCircumferenceCm?.toString() ?? '',
        waistCircumferenceCm:
          meQuery.data.styleProfile.waistCircumferenceCm?.toString() ?? '',
        hipCircumferenceCm:
          meQuery.data.styleProfile.hipCircumferenceCm?.toString() ?? '',
        shoulderWidthCm:
          meQuery.data.styleProfile.shoulderWidthCm?.toString() ?? '',
        inseamCm: meQuery.data.styleProfile.inseamCm?.toString() ?? '',
        preferredFit: meQuery.data.styleProfile.preferredFit,
        preferredStyles: meQuery.data.styleProfile.preferredStyles,
      }
    : localProfile

  return (
    <section
      className="classification-page-enter fixed inset-0 z-[80] flex h-dvh flex-col overflow-hidden bg-canvas"
      role="dialog"
      aria-modal="true"
      aria-label="스타일 프로필"
    >
      <header className="shrink-0 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-2xl items-center gap-2 px-3 py-2 sm:min-h-18 sm:px-5">
          <Link
            to="/settings"
            className="flex size-10 shrink-0 items-center justify-center rounded-full transition hover:bg-surface"
            aria-label="스타일 프로필 닫기"
            autoFocus
          >
            <ChevronLeft size={24} strokeWidth={2.2} />
          </Link>
          <PageTitle
            title="스타일 프로필"
            description="신체 정보와 취향을 관리해보세요."
            compact
          />
        </div>
      </header>

      <StyleProfileForm
        key={meQuery.dataUpdatedAt || 'local'}
        initialProfile={initialProfile}
      />
    </section>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const meQuery = useMeQuery()
  const logout = useLogoutMutation()

  return (
    <section className="mx-auto max-w-2xl">
      <PageTitle
        title="설정"
        description="프로필과 계정 정보를 관리해보세요."
      />

      <nav className="mt-6 overflow-hidden rounded-3xl border border-line bg-surface">
        <Link
          to="/settings/style-profile"
          className="flex items-center gap-4 p-5 transition hover:bg-canvas sm:p-6"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sage">
            <Sparkles size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-sm font-black">스타일 프로필</strong>
            <span className="mt-1 block text-xs leading-5 text-muted">
              성별·체형과 신체 치수, 선호 착용감 관리
            </span>
          </span>
          <ChevronRight className="shrink-0 text-muted" size={20} />
        </Link>
        <Link
          to="/settings/notifications-weather"
          className="flex items-center gap-4 border-t border-line p-5 transition hover:bg-canvas sm:p-6"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sage">
            <CloudSun size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-sm font-black">알림 및 날씨</strong>
            <span className="mt-1 block text-xs leading-5 text-muted">
              AI 작업 완료 알림과 위치 기반 날씨 설정
            </span>
          </span>
          <ChevronRight className="shrink-0 text-muted" size={20} />
        </Link>
        <Link
          to="/settings/app-info"
          className="flex items-center gap-4 border-t border-line p-5 transition hover:bg-canvas sm:p-6"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-canvas">
            <Info size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-sm font-black">앱 정보</strong>
            <span className="mt-1 block text-xs leading-5 text-muted">
              실행 환경과 앱·OS·웹 번들 버전 확인
            </span>
          </span>
          <ChevronRight className="shrink-0 text-muted" size={20} />
        </Link>
      </nav>

      <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-muted">로그인 계정</p>
          <p className="mt-0.5 truncate text-sm font-black">
            {meQuery.data?.displayName ?? '테스트 사용자'}
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            void logout.mutateAsync().finally(() => {
              navigate('/login', { replace: true })
            })
          }
          disabled={logout.isPending}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-bold text-muted hover:border-ink hover:text-ink"
        >
          <LogOut size={14} /> 로그아웃
        </button>
      </div>
    </section>
  )
}
