import { useEffect, useRef, useState } from 'react'
import type { OutfitPreview, Season, WardrobeItem } from '@closet/types'
import { BookHeart } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { outfitStyleOptions, type OutfitStyle } from '../../../../constants/styleOptions'
import { getAccessToken } from '../../../../lib/auth'
import { GraphqlRequestError } from '../../../../lib/graphql'
import { useUiStore } from '../../../../stores/useUiStore'
import { useCreateOutfitMutation, useOutfitsQuery } from '../../../lookbook/api/lookbookQueries'
import { OutfitSaveDialogView } from '../../../lookbook/components/OutfitSaveDialog'
import { useLookbookStore } from '../../../lookbook/stores/useLookbookStore'
import { findDuplicateOutfit, getOutfitCompletionMessage } from '../../../lookbook/utils/outfitComposition'
import { createLookbookOutfitPath } from '../../../lookbook/utils/outfitComposerNavigation'
import { useRecentWearReminder } from '../../hooks/useRecentWearReminder'

interface RecommendationLookbookSaveProps {
  date: string
  name: string
  season: Season
  style?: OutfitStyle | null
  items: WardrobeItem[]
  preview?: OutfitPreview
  disabled?: boolean
  onOpenLookbook?: () => void
  /** 내일 추천처럼 일정에 담기가 주 행동이면 코디북 저장을 보조 버튼으로 표시한다. */
  secondary?: boolean
}

const sessionChangedMessage = '로그인 상태가 바뀌었어요. 추천을 다시 열어주세요.'

/** 추천 조합을 코디북에 저장한다. 이미 저장된 조합이면 기존 코디로 연결하고 추천·플래너의 조합은 그대로 둔다. */
export function RecommendationLookbookSave({
  date,
  name,
  season,
  style,
  items,
  preview,
  disabled,
  onOpenLookbook,
  secondary = false,
}: RecommendationLookbookSaveProps) {
  const saveActionClassName = `col-span-2 flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40 ${secondary ? 'border border-line bg-surface' : 'bg-accent text-white'}`
  const completionMessage = getOutfitCompletionMessage(items)
  const itemIds = items.map((item) => item.id)
  const outfitsQuery = useOutfitsQuery(!completionMessage)
  const outfits = outfitsQuery.data ?? []
  const duplicate = findDuplicateOutfit(outfits, itemIds)
  const createOutfit = useCreateOutfitMutation()
  const { confirmRecentWear, isCheckingRecentWear } = useRecentWearReminder()
  const pushToast = useUiStore((state) => state.pushToast)
  const addOutfit = useLookbookStore((state) => state.addOutfit)
  const [recommendationToken] = useState(getAccessToken)
  const [isSaveOpen, setIsSaveOpen] = useState(false)
  const [outfitName, setOutfitName] = useState('')
  const [outfitStyle, setOutfitStyle] = useState('')
  const [outfitSeasons, setOutfitSeasons] = useState<Season[]>([])
  /** 저장창을 열 때 이미 완료된 이미지다. 이후 완료된 생성 결과는 현재 저장에 붙이지 않는다. */
  const [draftPreview, setDraftPreview] = useState<OutfitPreview>()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const actionRef = useRef<HTMLElement | null>(null)
  const submittingRef = useRef(false)
  const isSaving = createOutfit.isPending || isCheckingRecentWear
  const isCurrentSession = () => Boolean(recommendationToken && recommendationToken === getAccessToken())
  const setActionRef = (action: HTMLElement | null) => {
    actionRef.current = action
  }

  useEffect(() => {
    if (!isSaveOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || submittingRef.current) return
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
      if (dialogs.item(dialogs.length - 1) === dialogRef.current) setIsSaveOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      actionRef.current?.focus()
    }
  }, [isSaveOpen])

  const openSave = () => {
    if (!isCurrentSession()) {
      pushToast(sessionChangedMessage, 'error')
      return
    }
    setOutfitName(name.slice(0, 40))
    setOutfitStyle(style ?? '옷장 추천')
    setOutfitSeasons([season])
    setDraftPreview(preview)
    setErrorMessage(null)
    setIsSaveOpen(true)
  }

  const saveOutfit = async () => {
    const trimmedName = outfitName.trim()
    if (submittingRef.current || completionMessage || !trimmedName || !outfitStyle || outfitSeasons.length === 0) return
    if (!isCurrentSession()) {
      setErrorMessage(sessionChangedMessage)
      return
    }
    submittingRef.current = true
    setErrorMessage(null)

    try {
      const confirmed = await confirmRecentWear({
        itemIds,
        targetDate: date,
        includeTargetDate: true,
        confirmLabel: '그래도 저장',
        cancelLabel: '저장 화면으로 돌아가기',
      })
      if (!confirmed) return
      if (!isCurrentSession()) {
        setErrorMessage(sessionChangedMessage)
        return
      }

      const savedOutfit = await createOutfit.mutateAsync({
        name: trimmedName,
        style: outfitStyle,
        seasons: outfitSeasons,
        items: itemIds.map((wardrobeItemId, layerOrder) => ({ wardrobeItemId, layerOrder })),
        previewImage: draftPreview,
      })
      if (!isCurrentSession()) return
      addOutfit(savedOutfit)
      setIsSaveOpen(false)
      pushToast('추천 코디를 코디북에 저장했어요.', 'success')
    } catch (error) {
      if (!isCurrentSession()) return
      // 다른 화면이나 기기에서 먼저 같은 조합을 저장한 경우 기존 코디를 다시 찾아 연결한다.
      if (error instanceof GraphqlRequestError && error.code === 'DUPLICATE_OUTFIT') {
        const refreshed = await outfitsQuery.refetch()
        if (!isCurrentSession()) return
        if (findDuplicateOutfit(refreshed.data ?? [], itemIds)) {
          setIsSaveOpen(false)
          pushToast(error.message)
          return
        }
      }
      setErrorMessage(error instanceof Error ? error.message : '코디북에 저장하지 못했어요. 다시 시도해주세요.')
    } finally {
      submittingRef.current = false
    }
  }

  const existingStyles = [...new Set(outfits.map((outfit) => outfit.style))]
    .filter((value) => !outfitStyleOptions.some((option) => option.value === value))
    .map((value) => ({ value, label: value }))

  return (
    <>
      {duplicate && !disabled ? (
        <Link
          ref={setActionRef}
          to={createLookbookOutfitPath(duplicate.id)}
          onClick={(event) => {
            if (isCurrentSession()) onOpenLookbook?.()
            else {
              event.preventDefault()
              pushToast(sessionChangedMessage, 'error')
            }
          }}
          className={saveActionClassName}
          title={duplicate.name}
        >
          <BookHeart size={16} aria-hidden="true" />
          코디북에서 보기
        </Link>
      ) : (
        <button ref={setActionRef} type="button" className={saveActionClassName} onClick={openSave} disabled={disabled || Boolean(completionMessage)}>
          <BookHeart size={16} aria-hidden="true" />
          {duplicate ? '코디북에서 보기' : '코디북에 저장'}
        </button>
      )}
      {isSaveOpen && createPortal(
        <OutfitSaveDialogView
          dialogRef={dialogRef}
          selectedItems={items}
          outfitName={outfitName}
          outfitStyle={outfitStyle}
          outfitSeasons={outfitSeasons}
          styleOptions={[...outfitStyleOptions, ...existingStyles]}
          includesPreview={Boolean(draftPreview)}
          isSaving={isSaving}
          isPersisting={createOutfit.isPending}
          setOutfitName={setOutfitName}
          setOutfitStyle={setOutfitStyle}
          setOutfitSeasons={setOutfitSeasons}
          saveOutfit={() => void saveOutfit()}
          closeSave={() => {
            if (!submittingRef.current) setIsSaveOpen(false)
          }}
          errorMessage={errorMessage}
          seasonDescription="추천을 받은 계절을 먼저 표시해요."
        />,
        document.body,
      )}
    </>
  )
}
