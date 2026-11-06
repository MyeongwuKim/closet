import { ImagePlus, Images, Shirt } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useWardrobeItemsQuery } from '../../closet/api/wardrobeQueries'
import { useOutfitsQuery } from '../../lookbook/api/lookbookQueries'
import { PlanTodayEmptyIllustration } from './PlanTodayEmptyIllustration'

interface PlanTodayEmptyStateProps {
  isToday: boolean
  editPath: string
  onChooseOutfit: () => void
}

const primaryActionClass = 'plan-today-empty-action mt-5 inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-surface focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2'
const secondaryActionClass = 'inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-xs font-medium text-accent underline decoration-line underline-offset-4 hover:decoration-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2'

/** 비어 있는 날짜에서는 옷장·코디북 조회 결과에 따라 사진 추가, 직접 구성, 코디북 배정 중 다음 행동을 안내한다. */
export function PlanTodayEmptyState({ isToday, editPath, onChooseOutfit }: PlanTodayEmptyStateProps) {
  const wardrobe = useWardrobeItemsQuery()
  const lookbook = useOutfitsQuery()
  const isLoading = wardrobe.isPending || lookbook.isPending
  const isError = wardrobe.isError || lookbook.isError
  const hasClothes = wardrobe.data?.some((item) => !item.archivedAt) ?? false
  const hasSavedOutfits = Boolean(lookbook.data?.length)
  const description = isError
    ? '옷장과 코디북을 확인하지 못했어요.'
    : isLoading
      ? '옷장과 코디북을 확인하고 있어요.'
      : !hasClothes
        ? '옷 사진을 추가하면 내 옷으로 코디를 만들 수 있어요.'
        : hasSavedOutfits
          ? '코디북에서 고르거나 내 옷을 직접 조합해 보세요.'
          : '옷장에 등록한 옷을 골라 이날의 코디를 만들어 보세요.'

  return (
    <div className="plan-today-empty flex min-h-0 flex-1 flex-col items-center justify-center-safe overflow-y-auto px-5 py-6 text-center">
      <PlanTodayEmptyIllustration />
      <strong className="shrink-0 text-base font-medium tracking-[-.04em]">{isToday ? '오늘 입을 옷을 골라보세요' : '이날 입을 옷을 골라보세요'}</strong>
      <p role="status" className="plan-today-empty-description mt-2 shrink-0 text-xs leading-5 text-muted">{description}</p>
      {isError ? (
        <button
          type="button"
          onClick={() => {
            if (wardrobe.isError) void wardrobe.refetch()
            if (lookbook.isError) void lookbook.refetch()
          }}
          className={primaryActionClass}
          disabled={wardrobe.isFetching || lookbook.isFetching}
        >
          다시 불러오기
        </button>
      ) : !isLoading && (
        <>
          {!hasClothes && (
            <Link to="/closet" state={{ openWardrobePhotoPicker: true }} className={primaryActionClass}>
              <ImagePlus size={16} aria-hidden="true" />첫 옷 사진 추가
            </Link>
          )}
          {hasSavedOutfits && (
            <button
              type="button"
              onClick={onChooseOutfit}
              className={hasClothes ? primaryActionClass : secondaryActionClass}
            >
              {hasClothes && <Images size={16} aria-hidden="true" />}코디북에서 고르기
            </button>
          )}
          {hasClothes && (
            <Link to={editPath} className={hasSavedOutfits ? secondaryActionClass : primaryActionClass}>
              {!hasSavedOutfits && <Shirt size={16} aria-hidden="true" />}
              {hasSavedOutfits ? '옷 직접 고르기' : '내 옷으로 코디 만들기'}
            </Link>
          )}
        </>
      )}
    </div>
  )
}
