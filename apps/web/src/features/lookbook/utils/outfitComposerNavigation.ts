import type { OutfitComposerState } from '../contexts/OutfitComposerContext'
import type { OutfitLayer } from '../types'

/** 코디북 목록의 정렬·페이지와 관계없이 저장한 코디 상세를 여는 경로다. */
export function createLookbookOutfitPath(outfitId: string) {
  return `/lookbook?${new URLSearchParams({ outfit: outfitId })}`
}

export function createOutfitComposerPath(
  itemIds: readonly string[],
  fromPath: string,
) {
  const searchParams = new URLSearchParams({
    items: itemIds.join(','),
    from: fromPath,
  })
  return `/lookbook/new?${searchParams.toString()}`
}

/** 새로고침하거나 기존 조합을 불러와도 받쳐 입는 옷과 아우터의 위치가 유지되도록 초안을 URL에 기록한다. */
export function setOutfitComposerLayers(params: URLSearchParams, layers: OutfitLayer[]) {
  const values = {
    items: layers.map((layer) => layer.wardrobeItemId),
    baseLayers: layers.filter((layer) => layer.isBaseLayer).map((layer) => layer.wardrobeItemId),
    outerItems: layers.filter((layer) => layer.slot === 'outer').map((layer) => layer.wardrobeItemId),
    midlayerItems: layers.filter((layer) => layer.slot === 'midlayer').map((layer) => layer.wardrobeItemId),
  }
  for (const [key, ids] of Object.entries(values)) {
    if (ids.length) params.set(key, ids.join(','))
    else params.delete(key)
  }
}

/** 플래너에서 같은 코디 만들기 화면을 열고 저장할 날짜와 돌아갈 보기를 넘긴다. */
export function createPlannerComposerPath(date: string, fromPath: string) {
  return `/lookbook/new?${new URLSearchParams({ planDate: date, from: fromPath })}`
}

export function getOutfitComposerBackPath(fromPath: string | null) {
  if (!fromPath?.startsWith('/') || fromPath.startsWith('//')) return '/lookbook'

  try {
    const origin = 'https://closet.invalid'
    return new URL(fromPath, origin).origin === origin ? fromPath : '/lookbook'
  } catch {
    return '/lookbook'
  }
}

export function shouldExitOutfitComposer(
  state: Pick<
    OutfitComposerState,
    'step' | 'layers' | 'originItemIds' | 'preview'
  >,
) {
  if (state.preview.isOpen) return false
  if (state.step === 'start') return true
  if (state.step !== 'category' || state.originItemIds.length === 0) {
    return false
  }

  return state.layers.every((layer) =>
    state.originItemIds.includes(layer.wardrobeItemId),
  )
}
