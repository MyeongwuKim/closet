/**
 * 용도:
 * 옷장에 저장된 소재와 표면 질감을 룩북 이미지 생성 프롬프트용 설명으로 바꾼다.
 *
 * 동작 방식:
 * 저장된 분석값을 우선 사용하고, 구버전 아이템은 이름과 세부 종류에서 질감을 보완한다.
 * 질감별로 반드시 보여야 하는 골·직조·광택·기모 표현을 함께 반환한다.
 */
import type {
  FashionItemAttributes,
  FashionMaterial,
  FashionPattern,
  FashionTexture,
} from '@closet/types'

export interface LookbookFabricItem {
  name: string
  subcategory: string | null
  fashionAttributes?: unknown
}

const materials = new Set<FashionMaterial>([
  'cotton',
  'denim',
  'knit',
  'wool',
  'leather',
  'linen',
  'synthetic',
  'other',
  'unknown',
])
const patterns = new Set<FashionPattern>([
  'solid',
  'stripe',
  'check',
  'graphic',
  'floral',
  'other',
  'unknown',
])
const textures = new Set<FashionTexture>([
  'smooth',
  'twill',
  'corduroy',
  'ribbed',
  'cableKnit',
  'fuzzy',
  'boucle',
  'quilted',
  'suede',
  'glossy',
  'distressed',
  'other',
  'unknown',
])

const textureRenderTargets: Record<FashionTexture, string> = {
  smooth:
    'copy the reference surface smoothness and its exact matte-to-sheen balance; do not flatten visible reflectance',
  twill:
    'show the subtle diagonal twill weave at a realistic scale across the garment',
  corduroy:
    'show continuous raised vertical corduroy wales with alternating narrow highlights and shadows; preserve the reference wale width and never turn it into plain cotton, denim, or a flat matte surface',
  ribbed:
    'show repeating raised knitted ribs across the full garment body at the same spacing as the reference',
  cableKnit:
    'show the reference raised cable-knit crossings, depth, and yarn definition across the garment',
  fuzzy:
    'preserve the visible soft nap, brushed fibers, and diffused edges without turning the fabric smooth',
  boucle:
    'preserve the irregular looped yarn surface and small dimensional shadows',
  quilted:
    'preserve every visible quilt line, padded cell, and loft pattern from the reference',
  suede:
    'preserve the short directional suede nap and soft low-sheen tonal variation',
  glossy:
    'preserve the reference highlight strength and smooth directional reflections without making it metallic or plastic',
  distressed:
    'preserve the exact visible wash, fading, abrasion, and worn tonal variation from the reference',
  other:
    'inspect and reproduce the reference surface structure, weave, nap, and reflectance instead of replacing it with generic fabric',
  unknown:
    'derive the surface only from the matching reference image and copy every visible weave, ridge, nap, and highlight; do not default to generic smooth matte cotton',
}

function readAttributes(value: unknown): Partial<FashionItemAttributes> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<FashionItemAttributes>
    : {}
}

function inferMaterial(text: string): FashionMaterial {
  if (/데님|청바지|denim/iu.test(text)) return 'denim'
  if (/니트|가디건|스웨터|knit/iu.test(text)) return 'knit'
  if (/레더|가죽|leather/iu.test(text)) return 'leather'
  if (/울|모직|wool/iu.test(text)) return 'wool'
  if (/린넨|마\b|linen/iu.test(text)) return 'linen'
  if (/코튼|면\b|cotton/iu.test(text)) return 'cotton'
  if (/나일론|폴리에스테르|synthetic|nylon|polyester/iu.test(text)) {
    return 'synthetic'
  }
  return 'unknown'
}

function inferTexture(text: string): FashionTexture {
  if (/코듀로이|골덴|corduroy/iu.test(text)) return 'corduroy'
  if (/트윌|능직|twill/iu.test(text)) return 'twill'
  if (/골지|ribbed/iu.test(text)) return 'ribbed'
  if (/케이블|꽈배기|cable/iu.test(text)) return 'cableKnit'
  if (/기모|플리스|보아|퍼\b|fleece|fuzzy/iu.test(text)) return 'fuzzy'
  if (/부클|뽀글|boucl[eé]/iu.test(text)) return 'boucle'
  if (/퀼팅|누빔|quilted/iu.test(text)) return 'quilted'
  if (/스웨이드|suede/iu.test(text)) return 'suede'
  if (/광택|새틴|satin|gloss/iu.test(text)) return 'glossy'
  if (/워싱|헤짐|디스트레스|washed|distressed/iu.test(text)) {
    return 'distressed'
  }
  return 'unknown'
}

function getMaterial(
  attributes: Partial<FashionItemAttributes>,
  fallback: FashionMaterial,
) {
  const material = attributes.material
  return material && materials.has(material) && material !== 'unknown'
    ? material
    : fallback
}

function getTexture(
  attributes: Partial<FashionItemAttributes>,
  fallback: FashionTexture,
) {
  const texture = attributes.texture
  return texture && textures.has(texture) && texture !== 'unknown'
    ? texture
    : fallback
}

function getPattern(attributes: Partial<FashionItemAttributes>) {
  const pattern = attributes.pattern
  return pattern && patterns.has(pattern) ? pattern : 'unknown'
}

export function describeLookbookFabric(item: LookbookFabricItem) {
  const attributes = readAttributes(item.fashionAttributes)
  const searchableText = `${item.name} ${item.subcategory ?? ''}`
    .normalize('NFKC')
    .toLocaleLowerCase()
  const material = getMaterial(attributes, inferMaterial(searchableText))
  const texture = getTexture(attributes, inferTexture(searchableText))

  return [
    `material=${material}`,
    `texture=${texture}`,
    `pattern=${getPattern(attributes)}`,
    `surfaceTarget=${textureRenderTargets[texture]}`,
  ].join(', ')
}

export const lookbookFabricPreservationGuide = [
  'Fabric texture and surface finish are hard garment-identity constraints with the same priority as color, cut, and closures; they are not optional styling cues.',
  'Study each garment only from its matching numbered reference and reproduce its visible weave, wale direction and spacing, knit relief, nap, loops, quilting, wash, and matte-to-sheen reflectance.',
  'Keep that surface continuously visible across the garment body, sleeves, and trouser legs wherever the reference shows it. Do not reduce texture to a small edge detail and do not homogenize different garments into generic smooth matte fabric.',
  'For corduroy in particular, the parallel raised vertical wales and the narrow light-and-shadow rhythm between them must remain clearly visible at normal lookbook viewing size.',
  'Use soft directional studio lighting that reveals surface depth without recoloring the garment or creating unsupported gloss. Let folds and drape follow the referenced fabric weight and stiffness.',
  'If a saved material or texture label conflicts with what is clearly visible, the matching reference image wins; never invent a different fabric merely to fit the selected outfit style.',
].join(' ')
