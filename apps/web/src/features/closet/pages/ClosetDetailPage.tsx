import { useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, Palette, Sparkles } from 'lucide-react'
import {
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { formatSeasonLabels } from '../../../constants/seasons'
import { useUiStore } from '../../../stores/useUiStore'
import { ClosetDetailHeader } from '../components/ClosetDetailHeader'
import { ClosetItemEditModal } from '../components/ClosetItemEditModal'
import { ClosetItemVisual } from '../components/ClosetItemVisual'
import { MatchedOutfitsRail } from '../components/MatchedOutfitsRail'
import { closetCategoryLabels } from '../constants'
import { useClosetStore } from '../stores/useClosetStore'
import { OutfitDetailModal } from '../../lookbook/components/OutfitDetailModal'
import { useLookbookStore } from '../../lookbook/stores/useLookbookStore'
import {
  useArchiveWardrobeItemMutation,
  useUpdateWardrobeItemMutation,
} from '../api/wardrobeQueries'
import { colorHexToRgb, colorModeLabels } from '../utils/color'

export function ClosetDetailPage() {
  const navigate = useNavigate()
  const { date, itemId } = useParams()
  const [searchParams] = useSearchParams()
  const items = useClosetStore((state) => state.items)
  const outfits = useLookbookStore((state) => state.outfits)
  const pushToast = useUiStore((state) => state.pushToast)
  const updateWardrobeItem = useUpdateWardrobeItemMutation()
  const archiveWardrobeItem = useArchiveWardrobeItemMutation()
  const selectedItem = items.find((item) => item.id === itemId)
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [selectedOutfitId, setSelectedOutfitId] = useState<string | null>(null)
  const requestedBackPath = searchParams.get('from')
  const backPath =
    requestedBackPath?.startsWith('/') && !requestedBackPath.startsWith('//')
      ? requestedBackPath
      : date
        ? `/plan/${date}`
        : '/closet'
  const backLabel = date ? '플래너 코디로 돌아가기' : '내 옷장으로 돌아가기'

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return

      if (selectedOutfitId) {
        setSelectedOutfitId(null)
        return
      }

      if (isEditing || isDeleteConfirmOpen) return

      navigate(backPath)
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    backPath,
    isDeleteConfirmOpen,
    isEditing,
    navigate,
    selectedOutfitId,
  ])

  if (!selectedItem) return <Navigate to="/closet" replace />

  const relatedOutfits = outfits
    .filter((outfit) =>
      outfit.layers.some(
        (layer) => layer.wardrobeItemId === selectedItem.id,
      ),
    )
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    )
  const selectedOutfit = relatedOutfits.find(
    (outfit) => outfit.id === selectedOutfitId,
  )

  const itemDescription =
    selectedItem.classificationStatus === 'pending'
      ? 'AI가 옷 정보를 분석하고 있어요.'
      : `${selectedItem.subcategory ?? (selectedItem.category ? closetCategoryLabels[selectedItem.category] : '미분류')} · ${selectedItem.colorDetailName ?? selectedItem.colorName}`
  const colorRgb = colorHexToRgb(selectedItem.colorHex)
  const sizeDetails = [
    ['표기 사이즈', selectedItem.sizeLabel],
    ['어깨너비', selectedItem.shoulderWidthCm],
    ['가슴 단면', selectedItem.chestWidthCm],
    ['소매 길이', selectedItem.sleeveLengthCm],
    ['허리 단면', selectedItem.waistWidthCm],
    ['허벅지 단면', selectedItem.thighWidthCm],
    ['밑위', selectedItem.riseCm],
    ['밑단 단면', selectedItem.hemWidthCm],
    ['총장', selectedItem.totalLengthCm],
  ].filter((detail) => detail[1] !== undefined && detail[1] !== '')

  return (
    <section
      className="fixed inset-0 z-[60] overflow-y-auto bg-canvas"
      role="dialog"
      aria-modal="true"
      aria-label={`${selectedItem.name} 상세`}
    >
      <ClosetDetailHeader
        title={selectedItem.name}
        description={itemDescription}
        backLabel={backLabel}
        onBack={() => navigate(backPath)}
        onEdit={() => setIsEditing(true)}
        onDelete={() => setIsDeleteConfirmOpen(true)}
      />

      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)] lg:items-start">
          <div className="detail-image-enter flex aspect-square max-h-145 items-center justify-center overflow-hidden rounded-[2rem] bg-surface shadow-[inset_0_0_0_1px_#dedad1]">
            <ClosetItemVisual item={selectedItem} />
          </div>

          <div className="lg:pt-5">
            <h2 className="text-xl font-black tracking-[-0.03em] sm:text-2xl">
              아이템 정보
            </h2>
            <p className="mt-3 flex items-center gap-2 text-sm text-muted">
              <CalendarDays size={16} />
              {new Intl.DateTimeFormat('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }).format(new Date(selectedItem.createdAt))}{' '}
              등록
            </p>
            <p className="mt-2 text-sm text-muted">
              {selectedItem.wearCount > 0
                ? `최근 착용 ${selectedItem.lastWornAt} · 총 ${selectedItem.wearCount}회`
                : '아직 착용 기록이 없습니다.'}
            </p>

            <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-sage px-3 py-2 text-xs font-bold">
              <Sparkles size={14} />
              {selectedItem.classificationStatus === 'pending'
                ? 'AI 분류 대기'
                : `${selectedItem.subcategory ?? (selectedItem.category ? closetCategoryLabels[selectedItem.category] : '미분류')} · ${selectedItem.colorDetailName ?? selectedItem.colorName}`}
            </span>

            {selectedItem.seasons.length > 0 && (
              <span className="mt-2 ml-2 inline-flex rounded-full border border-line bg-surface px-3 py-2 text-xs font-bold text-muted">
                {formatSeasonLabels(selectedItem.seasons)}
              </span>
            )}

            {selectedItem.colorDetailName && colorRgb && (
              <div className="mt-5 rounded-2xl border border-line bg-surface p-4">
                <div className="flex items-center gap-3">
                  <span
                    className="size-12 shrink-0 rounded-xl border border-black/10"
                    style={{ backgroundColor: selectedItem.colorHex }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-muted">
                      <Palette size={14} /> AI 색상 분석
                    </p>
                    <p className="mt-1 truncate text-sm font-black">
                      {selectedItem.colorDetailName}
                    </p>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-muted">색상값</dt>
                    <dd className="mt-0.5 font-mono font-bold">
                      {selectedItem.colorHex.toUpperCase()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">RGB</dt>
                    <dd className="mt-0.5 font-mono font-bold">
                      {colorRgb.join(', ')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">넓은 분류</dt>
                    <dd className="mt-0.5 font-bold">{selectedItem.colorName}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">색상 구성</dt>
                    <dd className="mt-0.5 font-bold">
                      {selectedItem.colorMode
                        ? colorModeLabels[selectedItem.colorMode]
                        : '미분류'}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {sizeDetails.length > 0 && (
              <div className="mt-5 rounded-2xl border border-line bg-surface p-4">
                <p className="text-xs font-black">사이즈 정보</p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                  {sizeDetails.map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[11px] text-muted">{label}</dt>
                      <dd className="mt-0.5 text-sm font-bold">
                        {value}
                        {label !== '표기 사이즈' && ' cm'}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <div className="mt-7">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/lookbook/new?items=${selectedItem.id}&from=${encodeURIComponent(backPath)}`,
                  )
                }
                disabled={selectedItem.classificationStatus !== 'classified'}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-sm font-bold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Sparkles size={17} /> 이 옷으로 코디 맞추기
                <ArrowRight size={16} />
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-muted">
              이 옷을 먼저 펼쳐두고, 내 옷장에서 잘 어울리는 색과 아이템을
              하나씩 골라볼 수 있어요.
            </p>
          </div>
        </div>

        <MatchedOutfitsRail
          items={items}
          outfits={relatedOutfits.slice(0, 5)}
          onOutfitClick={(outfit) => setSelectedOutfitId(outfit.id)}
          onViewAll={() => navigate(`/lookbook?items=${selectedItem.id}`)}
        />
      </div>

      {selectedOutfit && (
        <OutfitDetailModal
          outfit={selectedOutfit}
          items={items}
          onClose={() => setSelectedOutfitId(null)}
        />
      )}

      {isEditing && (
        <ClosetItemEditModal
          item={selectedItem}
          onClose={() => setIsEditing(false)}
          onSave={async (updates) => {
            try {
              await updateWardrobeItem.mutateAsync({
                id: selectedItem.id,
                input: updates,
              })
              setIsEditing(false)
              pushToast('옷 정보를 수정했습니다.', 'success')
            } catch (error) {
              pushToast(
                error instanceof Error
                  ? error.message
                  : '옷 정보를 수정하지 못했습니다.',
                'error',
              )
              throw error
            }
          }}
        />
      )}

      {isDeleteConfirmOpen && (
        <ConfirmDialog
          title="옷장에서 삭제할까요?"
          description={`${selectedItem.name} 아이템이 옷장 목록에서 사라져요.`}
          confirmLabel="옷장에서 삭제"
          isPending={archiveWardrobeItem.isPending}
          onCancel={() => setIsDeleteConfirmOpen(false)}
          onConfirm={() => {
            void archiveWardrobeItem
              .mutateAsync(selectedItem.id)
              .then(() => {
                pushToast('옷장에서 삭제했습니다.', 'success')
                navigate('/closet', { replace: true })
              })
              .catch((error: unknown) => {
                pushToast(
                  error instanceof Error
                    ? error.message
                    : '옷장에서 삭제하지 못했습니다.',
                  'error',
                )
              })
          }}
        />
      )}
    </section>
  )
}
