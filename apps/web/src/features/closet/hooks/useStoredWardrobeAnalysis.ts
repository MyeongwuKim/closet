import { useEffect, useRef, useState } from 'react'
import type { ClothingCategory, FashionItemAttributes, WardrobeItem } from '@closet/types'
import { getAccessToken } from '../../../lib/auth'
import { classifyClothing } from '../api/classifyClothing'
import { MAX_CLOTHING_IMAGE_SIZE, SUPPORTED_CLOTHING_IMAGE_TYPES } from '../constants'

type AnalysisKind = 'shape' | 'color'
type AnalysisState =
  | { status: 'idle' }
  | { status: 'analyzing' | 'ready'; kind: AnalysisKind }
  | { status: 'error'; kind: AnalysisKind; message: string }

const photoReadError = '기존 사진을 불러오지 못했어요. 다시 시도해주세요.'
const sessionChangedError = '로그인 상태가 바뀌었어요. 옷 정보를 다시 열어 주세요.'
const upperCategories: ClothingCategory[] = ['top', 'outer', 'midlayer', 'dress']

/** 현재 카테고리의 형태 비교에 사용하는 구조 단서가 하나라도 있는지 확인한다. */
function hasShapeEvidence(
  attributes: FashionItemAttributes | null | undefined,
  category: ClothingCategory,
) {
  if (!attributes) return false
  const evidence = category === 'bottom'
    ? [
        attributes.bottomLegShape,
        attributes.bottomWaistStyle,
        attributes.bottomFrontPleats,
        attributes.pocketStyle,
      ]
    : upperCategories.includes(category)
      ? [attributes.necklineStyle, attributes.frontOpeningStyle, attributes.pocketStyle]
      : [attributes.silhouette]
  return evidence.some((value) => value != null && value !== 'unknown')
}

/** 저장된 사진을 자격 증명 없이 읽고, 등록 분석과 같은 이미지 제한을 적용한다. */
async function readStoredPhoto(url: string, signal: AbortSignal) {
  const response = await fetch(url, { credentials: 'omit', signal })
  if (!response.ok) throw new Error(photoReadError)

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
  const mime = SUPPORTED_CLOTHING_IMAGE_TYPES.find((type) => type === contentType)
  if (!mime) throw new Error('JPG, PNG, WebP 사진만 분석할 수 있어요.')
  const sizeError = '10MB 이하의 사진만 분석할 수 있어요.'
  if (Number(response.headers.get('content-length')) > MAX_CLOTHING_IMAGE_SIZE) {
    throw new Error(sizeError)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error(photoReadError)
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_CLOTHING_IMAGE_SIZE) {
        void reader.cancel().catch(() => undefined)
        throw new Error(sizeError)
      }
      chunks.push(new Uint8Array(value))
    }
  } finally {
    reader.releaseLock()
  }
  if (!size) throw new Error(photoReadError)
  return new File(chunks, `wardrobe-photo.${mime.split('/')[1]}`, { type: mime })
}

/** 수동 편집으로 이미 아는 값을 우선하고, 빈 속성은 새 사진 분석 결과로 채운다. */
function mergeRecoveredAttributes(
  saved: FashionItemAttributes | null | undefined,
  recovered: FashionItemAttributes,
): FashionItemAttributes {
  if (!saved) return recovered
  const known = Object.entries(saved).filter(([key, value]) => {
    if (key === 'formality' || key === 'confidence') return saved.confidence > 0
    return value != null && value !== 'unknown'
  })
  return { ...recovered, ...Object.fromEntries(known) }
}

/** 옷 정보 수정에서 기존 사진으로 형태 또는 색상을 분석한다. 두 요청은 동시에 실행하지 않는다. */
export function useStoredWardrobeAnalysis(
  item: WardrobeItem,
  category: ClothingCategory | '',
) {
  const [state, setState] = useState<AnalysisState>({ status: 'idle' })
  const [recoveredAttributes, setRecoveredAttributes] = useState<FashionItemAttributes | null>(null)
  const [accessToken] = useState(getAccessToken)
  // 버튼의 비활성 상태가 화면에 반영되기 전에도 같은 사진의 중복 분석을 막는다.
  const activeRequest = useRef<AbortController | null>(null)
  const photoUrl = item.originalImageUrl || item.imageUrl
  const savedAttributes = category === item.category ? item.fashionAttributes : undefined
  const canAnalyzeShape = Boolean(photoUrl && category && !recoveredAttributes && !hasShapeEvidence(savedAttributes, category))

  useEffect(() => () => {
    activeRequest.current?.abort()
    activeRequest.current = null
    setRecoveredAttributes(null)
  }, [])

  /** 옷의 대표 카테고리를 바꾸면 이전 카테고리의 요청과 초안을 폐기한다. */
  const reset = () => {
    activeRequest.current?.abort()
    activeRequest.current = null
    setState({ status: 'idle' })
  }

  /** 수정 화면을 열었던 계정에서만 사진 전송과 저장을 허용한다. */
  const ensureCurrentSession = (kind: AnalysisKind = 'shape') => {
    if (accessToken && accessToken === getAccessToken()) return true
    setState({ status: 'error', kind, message: sessionChangedError })
    return false
  }

  /** 형태는 카테고리와 단서를 검증해 복구하고, 색상 요청은 카테고리를 수정하지 않고 색상 결과를 반환한다. */
  const analyze = async (kind: AnalysisKind) => {
    if (!photoUrl || activeRequest.current || (kind === 'shape' && (!canAnalyzeShape || !category))) return
    if (!ensureCurrentSession(kind) || !accessToken) return

    const controller = new AbortController()
    activeRequest.current = controller
    setState({ status: 'analyzing', kind })
    try {
      const photo = await readStoredPhoto(photoUrl, controller.signal)
      const result = await classifyClothing(photo, { accessToken, signal: controller.signal })
      if (controller.signal.aborted || !ensureCurrentSession(kind)) return
      if (kind === 'shape') {
        if (result.category !== category) throw new Error('사진에서 찾은 카테고리가 현재 옷의 카테고리와 달라요.')
        if (!category || !result.fashionAttributes || !hasShapeEvidence(result.fashionAttributes, category)) {
          throw new Error('사진에서 비교할 형태 정보를 찾지 못했어요.')
        }
        setRecoveredAttributes(mergeRecoveredAttributes(savedAttributes, result.fashionAttributes))
      } else if (!/^#[0-9a-f]{6}$/i.test(result.colorHex)) {
        throw new Error('사진에서 대표 색상값을 찾지 못했어요.')
      }
      setState({ status: 'ready', kind })
      return result
    } catch (error) {
      if (controller.signal.aborted || !ensureCurrentSession(kind)) return
      setState({
        status: 'error',
        kind,
        message: error instanceof Error && !(error instanceof TypeError)
          ? error.message
          : photoReadError,
      })
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null
    }
  }

  return { canAnalyzeShape, canAnalyzeColor: Boolean(photoUrl), recoveredAttributes, state, analyze, reset, ensureCurrentSession }
}
