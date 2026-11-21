/**
 * 진입 경로: 하단 설정 탭 → 설정 또는 스타일 프로필
 *
 * 용도:
 * 계정에서 관리할 수 있는 설정 메뉴를 보여주고 스타일 프로필을 편집한다.
 *
 * 구조:
 * 스타일 프로필 카드, 옷장·앱 설정 메뉴와 스타일 프로필 입력 화면으로 구성한다. 로그인 정보와 세션 관리는 계정 관리 화면에서 제공한다.
 */
import { useState } from 'react'
import {
  ChevronLeft,
  ChevronDown,
  Ruler,
  Weight,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { SettingsSaveFooter } from '../components/SettingsSaveFooter'
import { PageTitle } from '../../../components/PageTitle'
import { CollectionHeading } from '../../../components/CollectionHeading'
import { SegmentedControl } from '../../../components/SegmentedControl'
import { StyleProfileRouteSkeleton } from '../../../components/layout/TabRouteSkeleton'
import { useUiStore } from '../../../stores/useUiStore'
import {
  useMeQuery,
  useUpdateStyleProfileMutation,
  ViewerSessionChangedError,
} from '../api/profileQueries'
import { SettingsDrawerList } from '../components/SettingsDrawerList'
import {
  type BodyBuild,
  type Gender,
  type PreferredFit,
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
  { label: '여유롭게', description: '여유 있는 핏', value: 'wide' },
  { label: '기본', description: '기본 핏', value: 'regular' },
  { label: '슬림하게', description: '몸에 가까운 핏', value: 'skinny' },
]

type DetailedBodyKey =
  | 'chestCircumferenceCm'
  | 'waistCircumferenceCm'
  | 'hipCircumferenceCm'
  | 'thighCircumferenceCm'
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
  { key: 'thighCircumferenceCm', label: '허벅지둘레', placeholder: '70', min: 20, max: 150 },
  { key: 'shoulderWidthCm', label: '어깨너비', placeholder: '42', min: 20, max: 80 },
  { key: 'inseamCm', label: '인심', placeholder: '76', min: 40, max: 130 },
]

function measurementValue(value: string) {
  return value === '' ? null : Number(value)
}

interface StyleProfileFormProps {
  initialProfile: StyleProfile
}

/** 필수 성별·체형과 선택 치수를 구분한다. 접힌 치수도 유지해 저장하고, 유효하지 않은 치수는 펼쳐서 고치게 한다. */
function StyleProfileForm({ initialProfile }: StyleProfileFormProps) {
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
    thighCircumferenceCm: initialProfile.thighCircumferenceCm,
    shoulderWidthCm: initialProfile.shoulderWidthCm,
    inseamCm: initialProfile.inseamCm,
  })
  const [preferredFit, setPreferredFit] = useState(
    initialProfile.preferredFit,
  )
  const profileDraft: StyleProfile = { ...initialProfile, gender, bodyBuild, heightCm, weightKg, ...bodyMeasurements, preferredFit }
  const [savedProfile, setSavedProfile] = useState(initialProfile)
  const hasChanges = gender !== savedProfile.gender
    || bodyBuild !== savedProfile.bodyBuild
    || preferredFit !== savedProfile.preferredFit
    || measurementValue(heightCm) !== measurementValue(savedProfile.heightCm)
    || measurementValue(weightKg) !== measurementValue(savedProfile.weightKg)
    || detailedBodyFields.some(({ key }) => measurementValue(bodyMeasurements[key]) !== measurementValue(savedProfile[key]))

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!hasChanges || updateStyleProfile.isPending) return

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
        preferredStyles: [],
      })
      setSavedProfile(profileDraft)
      pushToast('스타일 프로필을 저장했어요.', 'success')
    } catch (error) {
      if (error instanceof ViewerSessionChangedError) return
      pushToast(
        error instanceof Error
          ? error.message
          : '스타일 프로필을 저장하지 못했어요.',
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
                <legend className="text-sm font-semibold">기본 정보</legend>
                <p className="mt-1 text-xs text-muted">
                  AI 룩북에서 체형과 옷의 착용감을 표현할 때 참고해요.
                </p>

                <div className="mt-4">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold">성별 <span className="text-accent">필수</span></p>
                  <SegmentedControl
                    ariaLabel="성별"
                    value={gender}
                    options={genderOptions}
                    onChange={setGender}
                  />
                </div>

                <div className="mt-4">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold">체형 <span className="text-accent">필수</span></p>
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
                      <Ruler size={14} /> 키 <span className="ml-auto font-normal">선택</span>
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
                      <Weight size={14} /> 몸무게 <span className="ml-auto font-normal">선택</span>
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

                <details className="group mt-5 border-t border-line pt-3" onInvalidCapture={(event) => { event.currentTarget.open = true }}>
                  <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                    <span className="flex-1"><span className="block text-sm font-semibold">상세 신체 치수 <span className="ml-1 text-xs font-normal text-muted">선택</span></span><span className="mt-1 block text-xs text-muted">{Object.values(bodyMeasurements).some(Boolean) ? `${Object.values(bodyMeasurements).filter(Boolean).length}개 치수 입력됨` : '필요할 때 입력해도 괜찮아요.'}</span></span>
                    <ChevronDown size={18} className="shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <p className="mt-2 text-xs leading-5 text-muted">모르는 항목은 비워두세요. 입력한 치수는 접어도 유지돼요.</p>
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
                </details>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-semibold">룩북에서 참고할 핏 <span className="ml-1 text-xs font-normal text-muted">선택</span></legend>
                <p className="mt-1 text-xs leading-5 text-muted">
                  옷 사진과 실측으로 핏을 알기 어려울 때만 참고해요. 코디 추천에는 사용하지 않아요.
                </p>

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


            </div>
          </div>
        </div>
      </div>

      <SettingsSaveFooter label="프로필 저장" isPending={updateStyleProfile.isPending} disabled={!hasChanges} />
    </form>
  )
}

export function StyleProfilePage() {
  const localProfile = useStyleProfileStore((state) => state.profile)
  const meQuery = useMeQuery()

  // 첫 조회가 끝난 뒤 폼을 만들고, 같은 사용자의 재조회에는 입력 중인 값을 유지한다.
  if (meQuery.isPending) {
    return <StyleProfileRouteSkeleton />
  }

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
        thighCircumferenceCm:
          meQuery.data.styleProfile.thighCircumferenceCm?.toString() ?? '',
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
            description="신체 정보와 선호하는 핏을 설정해요."
            compact
          />
        </div>
      </header>

      <StyleProfileForm
        key={meQuery.data?.id ?? 'local'}
        initialProfile={initialProfile}
      />
    </section>
  )
}

export function SettingsPage() {
  return (
    <section className="settings-page">
      <CollectionHeading title="설정" />

      <SettingsDrawerList />

    </section>
  )
}
