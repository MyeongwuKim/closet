import { useEffect, useRef, useState } from 'react'
import type { Season } from '@closet/types'
import { createPortal } from 'react-dom'
import { ConfirmDialog } from '../../../../components/ConfirmDialog'
import { outfitStyleOptions } from '../../../../constants/styleOptions'
import { getAccessToken } from '../../../../lib/auth'
import { GraphqlRequestError } from '../../../../lib/graphql'
import { useUiStore } from '../../../../stores/useUiStore'
import { useCreateOutfitMutation, useOutfitsQuery } from '../../../lookbook/api/lookbookQueries'
import { OutfitSaveDialogView } from '../../../lookbook/components/OutfitSaveDialog'
import { useLookbookStore } from '../../../lookbook/stores/useLookbookStore'
import type { RecommendationLookbookDraft } from '../../hooks/useRecommendationPlannerOffer'

/** 날짜에 저장한 추천 조합을 확인한 뒤 코디북에서 사용할 이름·스타일·계절을 입력받는다. */
export function RecommendationLookbookSave({
  draft,
  onFinish,
}: {
  draft: RecommendationLookbookDraft
  onFinish: () => void
}) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [outfitName, setOutfitName] = useState(() => draft.name.slice(0, 40))
  const [outfitStyle, setOutfitStyle] = useState(draft.style ?? '옷장 추천')
  const [outfitSeasons, setOutfitSeasons] = useState<Season[]>([draft.season])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const submittingRef = useRef(false)
  const outfits = useOutfitsQuery(false)
  const createOutfit = useCreateOutfitMutation()
  const pushToast = useUiStore((state) => state.pushToast)
  const addOutfit = useLookbookStore((state) => state.addOutfit)

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented || submittingRef.current) return
      const dialogs = document.querySelectorAll(':is([role="dialog"], [role="alertdialog"])[aria-modal="true"]')
      if (!wrapperRef.current?.contains(dialogs.item(dialogs.length - 1))) return
      event.preventDefault()
      onFinish()
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onFinish])

  async function saveOutfit() {
    const name = outfitName.trim()
    if (!name || !outfitStyle || outfitSeasons.length === 0 || submittingRef.current) return
    if (!draft.token || draft.token !== getAccessToken()) {
      setErrorMessage('로그인 상태가 바뀌었어요. 추천을 다시 열어주세요.')
      return
    }
    submittingRef.current = true
    setErrorMessage(null)

    try {
      const saved = await createOutfit.mutateAsync({
        name,
        style: outfitStyle,
        seasons: outfitSeasons,
        items: draft.items.map((item, layerOrder) => ({ wardrobeItemId: item.id, layerOrder })),
        previewImage: draft.preview,
      })
      if (draft.token !== getAccessToken()) return
      addOutfit(saved)
      pushToast('추천 코디를 코디북에 저장했어요.', 'success')
      onFinish()
    } catch (error) {
      if (draft.token !== getAccessToken()) return
      if (error instanceof GraphqlRequestError && error.code === 'DUPLICATE_OUTFIT') {
        pushToast('같은 조합이 코디북에 이미 있어요.')
        onFinish()
        return
      }
      setErrorMessage(error instanceof Error ? error.message : '코디북에 저장하지 못했어요. 다시 시도해주세요.')
    } finally {
      submittingRef.current = false
    }
  }

  const existingStyles = [...new Set(outfits.data?.map((outfit) => outfit.style))]
    .filter((value) => !outfitStyleOptions.some((option) => option.value === value))
    .map((value) => ({ value, label: value }))

  return createPortal(
    <div ref={wrapperRef}>
      {isFormOpen ? (
        <OutfitSaveDialogView
          selectedItems={draft.items}
          outfitName={outfitName}
          outfitStyle={outfitStyle}
          outfitSeasons={outfitSeasons}
          styleOptions={[...outfitStyleOptions, ...existingStyles]}
          includesPreview={Boolean(draft.preview)}
          isSaving={createOutfit.isPending}
          isPersisting={createOutfit.isPending}
          setOutfitName={setOutfitName}
          setOutfitStyle={setOutfitStyle}
          setOutfitSeasons={setOutfitSeasons}
          saveOutfit={() => void saveOutfit()}
          closeSave={() => {
            if (!submittingRef.current) onFinish()
          }}
          errorMessage={errorMessage}
          seasonDescription="추천을 받은 계절을 먼저 표시해요."
        />
      ) : (
        <ConfirmDialog
          title="코디북에도 추가할까요?"
          description="플래너에 저장했어요. 코디북에 추가하면 다른 날에도 바로 꺼내 쓸 수 있어요."
          confirmLabel="코디북에 추가"
          cancelLabel="나중에"
          tone="accent"
          onCancel={onFinish}
          onConfirm={() => setIsFormOpen(true)}
        />
      )}
    </div>,
    document.body,
  )
}
