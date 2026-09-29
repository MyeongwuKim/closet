import type {
  ClothingCategory,
  FashionItemAttributes,
  FashionMaterial,
  FashionWarmth,
} from '@closet/types'

export interface EditableFashionAttributes {
  material: FashionMaterial
  warmth: FashionWarmth
}

export const fashionMaterialLabels: Record<FashionMaterial, string> = {
  cotton: '면',
  denim: '데님',
  knit: '니트',
  wool: '울',
  leather: '가죽',
  linen: '리넨',
  synthetic: '합성 소재',
  other: '기타 소재',
  unknown: '잘 모르겠음',
}

export const fashionWarmthLabels: Record<FashionWarmth, string> = {
  light: '얇고 가벼움',
  medium: '보통',
  heavy: '두껍고 따뜻함',
  unknown: '잘 모르겠음',
}

/** AI 분석값에서 사용자가 직접 확인할 소재와 보온감만 꺼내 입력 폼의 초기값으로 만든다. */
export function fashionAttributesFromItem(
  attributes: FashionItemAttributes | null | undefined,
): EditableFashionAttributes {
  return {
    material: attributes?.material ?? 'unknown',
    warmth: attributes?.warmth ?? 'unknown',
  }
}

function getDefaultLayerRole(
  category: ClothingCategory,
): FashionItemAttributes['layerRole'] {
  if (category === 'outer') return 'outer'
  if (category === 'midlayer') return 'mid'
  if (category === 'top') return 'base'
  return 'single'
}

/**
 * 사용자가 고친 소재와 보온감을 기존 AI 패션 속성에 반영한다.
 * 분석값이 없는 수동 등록 항목은 추천 로직이 읽을 수 있도록 나머지 속성을 unknown으로 채운다.
 */
export function mergeEditableFashionAttributes(
  attributes: FashionItemAttributes | null | undefined,
  edits: EditableFashionAttributes,
  category: ClothingCategory,
): FashionItemAttributes {
  return {
    layerRole: attributes?.layerRole ?? getDefaultLayerRole(category),
    silhouette: attributes?.silhouette ?? 'unknown',
    pattern: attributes?.pattern ?? 'unknown',
    material: edits.material,
    texture: attributes?.texture ?? 'unknown',
    ribbedCuffs: attributes?.ribbedCuffs ?? 'unknown',
    ribbedHem: attributes?.ribbedHem ?? 'unknown',
    ribbedNeckline: attributes?.ribbedNeckline ?? 'unknown',
    necklineStyle: attributes?.necklineStyle ?? 'unknown',
    frontOpeningStyle: attributes?.frontOpeningStyle ?? 'unknown',
    pocketStyle: attributes?.pocketStyle ?? 'unknown',
    bottomLegShape: attributes?.bottomLegShape,
    bottomWaistStyle: attributes?.bottomWaistStyle,
    bottomFrontPleats: attributes?.bottomFrontPleats,
    warmth: edits.warmth,
    formality: attributes?.formality ?? 0.5,
    confidence: attributes?.confidence ?? 0,
  }
}
