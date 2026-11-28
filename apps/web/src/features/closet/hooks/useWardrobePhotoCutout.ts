import { useEffect, useRef, useState } from 'react'
import { getAccessToken } from '../../../lib/auth'
import { readImageDataUrl } from '../../../lib/readImageDataUrl'
import { useUiStore, type ClassificationCandidate } from '../../../stores/useUiStore'

/** 명시적으로 누끼를 요청한 사진만 기기에 보내고, 취소하거나 실패하면 원본을 유지한다. */
export function useWardrobePhotoCutout(candidate: ClassificationCandidate) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const running = useRef<AbortController | null>(null)
  const setDisplayImage = useUiStore((state) => state.setClassificationDisplayImage)
  const { itemId, originalImageUrl } = candidate
  const canRemoveBackground = Boolean(originalImageUrl && window.ClosetNative?.removeWardrobePhotoBackground)
  const hasCutout = Boolean(originalImageUrl && candidate.imageUrl !== originalImageUrl)

  useEffect(() => () => { running.current?.abort() }, [itemId])

  const removeBackground = async () => {
    const bridge = window.ClosetNative
    if (!bridge?.removeWardrobePhotoBackground || !originalImageUrl || running.current) return
    const controller = new AbortController()
    const { signal } = controller
    const token = getAccessToken()
    running.current = controller
    setIsProcessing(true)
    setError(null)

    try {
      const original = await fetch(originalImageUrl, { signal })
      if (!original.ok) throw new Error('사진을 읽지 못했어요.')
      const dataUrl = await readImageDataUrl(await original.blob())
      signal.throwIfAborted()
      const { imageBase64 } = await bridge.removeWardrobePhotoBackground(dataUrl.split(',')[1], signal)
      signal.throwIfAborted()
      if (getAccessToken() !== token) return
      if (typeof imageBase64 !== 'string' || !imageBase64.startsWith('iVBORw0KGgo')) throw new Error('누끼 사진을 읽지 못했어요.')
      const png = await fetch(`data:image/png;base64,${imageBase64}`, { signal }).then((response) => response.blob())
      if (signal.aborted || getAccessToken() !== token) return
      const imageUrl = URL.createObjectURL(png)
      if (!setDisplayImage(itemId, imageUrl)) URL.revokeObjectURL(imageUrl)
    } catch {
      if (!signal.aborted && getAccessToken() === token) setError('배경을 제거하지 못했어요. 원본으로 등록할 수 있어요.')
    } finally {
      if (running.current === controller) running.current = null
      if (!signal.aborted) setIsProcessing(false)
    }
  }

  const useOriginal = () => {
    if (originalImageUrl) setDisplayImage(itemId, originalImageUrl)
    setError(null)
  }

  return { canRemoveBackground, error, hasCutout, isProcessing, removeBackground, useOriginal }
}
