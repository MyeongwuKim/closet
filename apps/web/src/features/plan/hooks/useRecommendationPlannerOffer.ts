import { useRef, useState } from 'react'
import type { OutfitPreview, Season, WardrobeItem } from '@closet/types'
import { getAccessToken } from '../../../lib/auth'
import { useUiStore } from '../../../stores/useUiStore'
import { useOutfitsQuery } from '../../lookbook/api/lookbookQueries'
import { findDuplicateOutfit } from '../../lookbook/utils/outfitComposition'

export type ApplyRecommendedOutfit = (
  items: WardrobeItem[],
  preview?: OutfitPreview,
) => Promise<false | { previewImageAssetId?: string; successMessage: string }>

export interface RecommendationLookbookDraft {
  name: string
  style?: string | null
  season: Season
  items: WardrobeItem[]
  preview?: OutfitPreview
  token: string | null
}

/** 날짜 저장이 끝나면 코디북을 확인하고, 없는 조합의 실제 저장 내용만 후속 입력창에 전달한다. */
export function useRecommendationPlannerOffer(onApply: ApplyRecommendedOutfit, onFinish: () => void) {
  const outfits = useOutfitsQuery(false)
  const pushToast = useUiStore((state) => state.pushToast)
  const applyingRef = useRef(false)
  const [isApplying, setIsApplying] = useState(false)
  const [draft, setDraft] = useState<RecommendationLookbookDraft | null>(null)

  async function apply({ name, style, season, items, preview }: Omit<RecommendationLookbookDraft, 'token'>) {
    if (applyingRef.current || draft) return false
    const token = getAccessToken()
    applyingRef.current = true
    setIsApplying(true)
    try {
      const result = await onApply(items, preview)
      if (!result || token !== getAccessToken()) return false
      const lookbook = await outfits.refetch()
      if (token !== getAccessToken()) return false

      if (lookbook.isSuccess && !findDuplicateOutfit(lookbook.data, items.map((item) => item.id))) {
        const storedPreview = preview && result.previewImageAssetId
          ? { ...preview, assetId: result.previewImageAssetId }
          : preview
        setDraft({ name, style, season, items, preview: storedPreview, token })
      } else {
        pushToast(result.successMessage, 'success')
        onFinish()
      }
      return true
    } finally {
      applyingRef.current = false
      setIsApplying(false)
    }
  }

  function finish() {
    setDraft(null)
    onFinish()
  }

  return { apply, draft, isApplying, finish }
}
