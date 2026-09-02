import type { OutfitComposerState } from '../contexts/OutfitComposerContext'

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
