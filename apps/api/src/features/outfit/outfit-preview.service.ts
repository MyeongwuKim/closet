/**
 * 용도:
 * 옷장 아이템과 사용자 체형 정보를 바탕으로 착장형 룩북 이미지를 생성한다.
 *
 * 요청 흐름:
 * 아이템 참조 이미지와 분석 속성을 프롬프트로 정리해 이미지 편집 API에 전달한 뒤,
 * 저장 가능한 생성 이미지와 사용 모델 정보를 반환한다.
 */
import type {
  BodyBuild,
  ClothingCategory,
  Gender,
  OutfitStyle,
  PreferredFit,
} from '@prisma/client'
import type { FashionTrimPresence } from '@closet/types'
import { ServiceError } from '../../graphql/errors.js'
import { userRepository } from '../user/user.repository.js'
import { wardrobeRepository } from '../wardrobe/wardrobe.repository.js'
import { hasCompleteOutfitBase } from './outfit-composition.js'
import {
  describeLookbookFabric,
  lookbookFabricPreservationGuide,
} from './lookbook-fabric-guide.js'

const categoryLabels: Record<ClothingCategory, string> = {
  top: '상의',
  bottom: '하의',
  outer: '아우터',
  midlayer: '중간 아우터',
  dress: '원피스',
  shoes: '신발',
  accessory: '액세서리',
  other: '기타',
}

const fitLabels: Record<PreferredFit, string> = {
  wide: '여유로운 착용감',
  regular: '정사이즈에 가까운 기본 착용감',
  skinny: '몸에 맞는 슬림한 착용감',
}

const genderLabels: Record<Gender, string> = {
  male: '성인 남성 모델',
  female: '성인 여성 모델',
}

const bodyBuildLabels: Record<BodyBuild, string> = {
  slim: '마른 체형',
  average: '보통 체형',
  athletic: '운동으로 단련된 탄탄한 근육형 체형',
  broad: '골격과 체격이 큰 체형',
}

const previewStyleLabels: Record<OutfitStyle, string> = {
  minimal: '미니멀',
  casual: '캐주얼',
  street: '스트릿',
  classic: '클래식',
  vintage: '빈티지',
  sporty: '스포티',
}

const previewStyleGuides: Record<OutfitStyle, string> = {
  minimal:
    'Keep the silhouette clean and restrained with a clear, uncluttered waistline.',
  casual:
    'Keep the outfit relaxed and natural. Leave shirts, T-shirts, sweatshirts, and knits fully untucked.',
  street:
    'Keep relaxed or oversized layers untucked and preserve the intended volume of each garment.',
  classic:
    'Create a structured, polished silhouette while keeping every referenced top fully untucked and preserving its original hem length.',
  vintage:
    'Preserve the garments’ original period-inspired proportions and use a fully untucked silhouette.',
  sporty:
    'Keep athletic and casual layers untucked and preserve an easy, functional silhouette.',
}

const MAX_REFERENCE_IMAGE_BYTES = 12 * 1024 * 1024
const SUPPORTED_REFERENCE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

const ribbedTrimPreservationGuide = [
  'For each reference garment, ribbedCuffs describes separate ribbed bands at the sleeve ends, ribbedHem at the body hem or trouser hems, and ribbedNeckline around the neck opening. Read each region independently.',
  'A present signal means a separate ribbed band was visibly observed: preserve that region\'s reference band, including its width, color and texture.',
  'An absent signal means the visible edge was confirmed without a separate ribbed band: retain the exact plain, rolled, stitched, non-ribbed cuff or elastic finish, including any existing gathers. Do not add a new ribbed band or unsupported gathering or cinching to that region.',
  'An unknown signal means the edge was not reliably observed or the saved item has no trim analysis; it is neither present nor absent. Preserve any clearly visible finish from the reference, including visible ribbing, but do not invent ribbed bands in hidden, cropped or unclear regions. Continue the visible fabric and silhouette without adding unsupported details.',
  'Whole-garment ribbed texture is independent of separate cuffs, hem and neck bands. Never infer a trim from a knit or sweatshirt category, or transfer one region\'s signal to another. Keep the reference neckline shape, sleeve length and hem proportions unchanged.',
].join(' ')

export const lookbookGarmentLengthGuide = [
  'Treat each saved totalLengthCm as a mandatory garment proportion, not a loose styling suggestion.',
  'Interpret it from the normal measurement anchor for that garment category to its hem, and scale that length against the saved model heightCm while also following the reference image.',
  'Do not shorten, crop, raise, roll, fold, or hide a measured hem, and do not pull the front hem higher than the back hem.',
  'Keep every top fully untucked, including shirts, T-shirts, sweatshirts, and knits. Let the complete hem hang freely and naturally over the waistband at its measured length.',
  'Never use a full tuck, half tuck, French tuck, bloused tuck, or invisible waistband tuck.',
  'Do not invent a belt or use a belt-like cinch unless a belt is included in the reference garments.',
].join(' ')

interface OpenAiImageResponse {
  data?: Array<{ b64_json?: string }>
  error?: { message?: string }
}

function formatMeasurement(label: string, value?: number | null) {
  return value == null ? null : `${label} ${value}cm`
}

function getRibbedTrimPresence(value: unknown): FashionTrimPresence {
  return value === 'present' || value === 'absent' ? value : 'unknown'
}

function describeRibbedTrims(value: unknown) {
  const attributes = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

  return [
    `ribbedCuffs=${getRibbedTrimPresence(attributes.ribbedCuffs)}`,
    `ribbedHem=${getRibbedTrimPresence(attributes.ribbedHem)}`,
    `ribbedNeckline=${getRibbedTrimPresence(attributes.ribbedNeckline)}`,
  ].join(', ')
}

export function getLookbookHemTarget(
  category: ClothingCategory | null,
  totalLengthCm?: number | null,
  modelHeightCm?: number | null,
) {
  if (
    !category ||
    !['top', 'outer', 'midlayer'].includes(category) ||
    totalLengthCm == null ||
    modelHeightCm == null ||
    !Number.isFinite(totalLengthCm) ||
    !Number.isFinite(modelHeightCm) ||
    totalLengthCm <= 0 ||
    modelHeightCm <= 0
  ) {
    return null
  }

  const lengthRatio = totalLengthCm / modelHeightCm
  const targetLandmark = lengthRatio >= 0.4
    ? 'the lower-hip area, approaching the upper thigh'
    : lengthRatio >= 0.36
      ? 'the fullest part of the hip'
      : lengthRatio >= 0.32
        ? 'the mid-hip area'
        : lengthRatio >= 0.28
          ? 'the upper-hip area below the waistband'
          : 'the waist area, only if the reference itself is visibly cropped'

  return `computedUntuckedHemTarget=${targetLandmark}; garmentLengthToModelHeight=${(lengthRatio * 100).toFixed(1)}%; do not end this garment at the waistband unless that target explicitly says waist`
}

function describeGarment(
  item: Awaited<
    ReturnType<typeof wardrobeRepository.findManyOwnedWithImagesByIds>
  >[number],
  index: number,
  modelHeightCm?: number | null,
) {
  const measurements = [
    formatMeasurement('어깨너비', item.shoulderWidthCm),
    formatMeasurement('가슴 단면', item.chestWidthCm),
    formatMeasurement('소매 길이', item.sleeveLengthCm),
    formatMeasurement('총장', item.totalLengthCm),
    formatMeasurement('허리 단면', item.waistWidthCm),
    formatMeasurement('엉덩이 단면', item.hipWidthCm),
    formatMeasurement('인심', item.inseamCm),
    formatMeasurement('허벅지 단면', item.thighWidthCm),
    formatMeasurement('밑위', item.riseCm),
    formatMeasurement('밑단 단면', item.hemWidthCm),
  ].filter(Boolean)

  return [
    `참조 이미지 ${index + 1}`,
    categoryLabels[item.category!],
    item.subcategory,
    item.name,
    item.colorDetailName ?? item.colorName,
    describeLookbookFabric(item),
    describeRibbedTrims(item.fashionAttributes),
    getLookbookHemTarget(
      item.category,
      item.totalLengthCm,
      modelHeightCm,
    ),
    item.sizeLabel ? `표기 사이즈 ${item.sizeLabel}` : null,
    measurements.length > 0 ? measurements.join(', ') : null,
  ]
    .filter(Boolean)
    .join(' / ')
}

function describeBody(
  profile: Awaited<ReturnType<typeof userRepository.findViewerById>>,
) {
  const body = profile?.styleProfile
  if (!body) return '일반적인 성인 체형'

  const values = [
    body.gender ? genderLabels[body.gender] : null,
    body.bodyBuild === 'athletic' && body.gender === 'female'
      ? '운동으로 단련되어 근육이 선명하지만 과도하게 벌크업되지 않은 성인 여성의 탄탄한 체형'
      : body.bodyBuild
        ? bodyBuildLabels[body.bodyBuild]
        : null,
    formatMeasurement('키', body.heightCm),
    body.weightKg == null ? null : `몸무게 ${body.weightKg}kg`,
    formatMeasurement('어깨너비', body.shoulderWidthCm),
    formatMeasurement('가슴둘레', body.chestCircumferenceCm),
    formatMeasurement('허리둘레', body.waistCircumferenceCm),
    formatMeasurement('엉덩이둘레', body.hipCircumferenceCm),
    formatMeasurement('인심', body.inseamCm),
  ].filter(Boolean)

  return values.join(', ')
}

export function getLookbookGenderConstraint(
  gender?: Gender | null,
) {
  if (gender === 'female') {
    return 'Use one adult woman only, with clearly adult female anatomy and an adult female skeletal frame. For an athletic or broad build, show visible training and muscle definition on a woman without changing her into a male bodybuilder. If exact measurements are missing, use balanced adult female proportions: shoulders proportional to the hips, a naturally defined waist, natural female chest and hip contours, and proportionate neck, hands, and feet. Do not render a wide rectangular male torso, a male ribcage or shoulder frame, bodybuilder bulk, oversized masculine hands, or oversized masculine feet. Never reinterpret muscularity, unisex garments, oversized clothing, or missing body measurements as a reason to substitute an adult man or a male-presenting mannequin. Preserve the referenced garments and their intended volume around this female body; do not shrink or redesign the clothes to create the body shape.'
  }
  if (gender === 'male') {
    return 'Use one adult man only. A slim male build or feminine-coded garment must not be used as a reason to substitute an adult woman or a female-presenting mannequin.'
  }
  return 'No model gender was selected. Use one neutral adult fashion model without inferring a real person\'s identity.'
}

export function getLookbookHairGuide(gender?: Gender | null) {
  if (gender === 'female') {
    return 'Give the adult woman neat, natural, straight dark long hair with soft volume, matching the reference hairstyle length: it must extend clearly past the shoulders by about 15 to 25 cm and reach the upper chest and upper back. This is long hair, not a bob, lob, shoulder-length cut, or medium-length cut; the ends must never stop at the shoulders. Keep the long ends visibly inside the crop on both sides of the neck and along the upper chest and back. Most hair should fall behind the shoulders, with only narrow natural front sections allowed, and it must not obscure the neckline, collar, garment closures, sleeves, outerwear shape, or other important garment details.'
  }
  return 'Keep the hairstyle neat and unobtrusive. Do not let hair cover the neckline, collar, shoulders, chest, outerwear, or any garment detail.'
}

function describePreferredFit(
  profile: Awaited<ReturnType<typeof userRepository.findViewerById>>,
) {
  return fitLabels[profile?.styleProfile?.preferredFit ?? 'regular']
}

function describeOutfitStyle(style?: string | null) {
  const normalized = style?.trim().replaceAll(/\s+/g, ' ').slice(0, 20)
  if (!normalized) {
    return 'No explicit style was selected. Follow the garments’ visible design and natural proportions.'
  }

  if (Object.hasOwn(previewStyleGuides, normalized)) {
    const outfitStyle = normalized as OutfitStyle
    return `${previewStyleLabels[outfitStyle]} (${outfitStyle}): ${previewStyleGuides[outfitStyle]}`
  }

  return `User-selected style label: "${normalized}". Interpret it only as a visual styling direction without changing any referenced garment.`
}

interface LookbookLayerItem {
  name: string
  category: ClothingCategory | null
  subcategory: string | null
  fashionAttributes?: unknown
}

function hasKnitMaterial(item: LookbookLayerItem) {
  if (!item.fashionAttributes || typeof item.fashionAttributes !== 'object') {
    return false
  }

  return (item.fashionAttributes as { material?: unknown }).material === 'knit'
}

function isVNeckKnit(item: LookbookLayerItem) {
  const text = `${item.name} ${item.subcategory ?? ''}`
    .normalize('NFKC')
    .toLocaleLowerCase()
  const hasVNeck = /(?:브이\s*넥|v[\s-]*(?:neck|넥))/iu.test(text)
  const isKnit = text.includes('니트') || hasKnitMaterial(item)

  return item.category === 'top' && hasVNeck && isKnit
}

export function getLookbookBaseLayerGuide(items: LookbookLayerItem[]) {
  const vNeckKnits = items.filter(isVNeckKnit)
  const hasAnotherTop = items.some(
    (item) => item.category === 'top' && !vNeckKnits.includes(item),
  )
  if (vNeckKnits.length === 0 || hasAnotherTop) return null

  return 'Add one plain lightweight white crew-neck T-shirt as a supporting base layer under the referenced V-neck knit. Show a clean white crew neckline naturally inside the V opening. Keep its sleeves and hem hidden under the knit, with no logo, print, or visible extra styling. This T-shirt is a non-reference styling layer only; it must not replace, recolor, or obscure any referenced garment.'
}

function buildPrompt(
  items: Awaited<
    ReturnType<typeof wardrobeRepository.findManyOwnedWithImagesByIds>
  >,
  profile: Awaited<ReturnType<typeof userRepository.findViewerById>>,
  style?: string | null,
) {
  const garments = items
    .map((item, index) =>
      describeGarment(item, index, profile?.styleProfile?.heightCm),
    )
    .join('\n')
  const baseLayerGuide = getLookbookBaseLayerGuide(items)
  const extraGarmentRule = baseLayerGuide
    ? 'Do not add any other extra garments beyond the single white base T-shirt explicitly allowed above.'
    : 'Do not add any extra garments.'

  return `Create a photorealistic fashion lookbook image using every garment from the reference images exactly once.

Reference garment order, observed fabric attributes, ribbed trim signals and optional silhouette measurements:
${garments}

Garment construction preservation: ${ribbedTrimPreservationGuide}

Fabric surface preservation: ${lookbookFabricPreservationGuide}

Model gender constraint: ${getLookbookGenderConstraint(profile?.styleProfile?.gender)}

Model hair guide: ${getLookbookHairGuide(profile?.styleProfile?.gender)}

Model body guide: ${describeBody(profile)}. The gender constraint is mandatory and takes priority over body-build shorthand, garment styling cues, and any missing body measurements.

Preferred styling fit: ${describePreferredFit(profile)}. Use this preference only when the reference images and garment measurements leave the fit ambiguous. Garment measurements and visible garment proportions always take priority. Do not resize or redesign a garment to force the preferred fit.

Selected outfit style: ${describeOutfitStyle(style)}

Supporting base-layer rule: ${baseLayerGuide ?? 'Do not invent or add a supporting base layer that is not included in the reference images.'}

Garment length and natural hem rule: ${lookbookGarmentLengthGuide}

Preserve each referenced garment's visible color, material, pattern, length, proportions, and distinctive details. Body chest, waist, and hip values are full circumferences, while garment chest, waist, and hip widths are flat measurements. When both are provided, use their relationship to depict plausible ease without treating the result as exact virtual fitting. Dress a single adult fashion model matching the body guide in the complete coordinated outfit.

Show the model in a three-quarter front view like a clean apparel catalog photo. Keep the model centered, then rotate the torso, hips, knees, feet, neck, and implied gaze together about 20 to 30 degrees away from straight-on toward the left edge of the final image from the viewer's perspective (image-left). Keep this same image-left orientation in every generation. Never turn or mirror the pose toward image-right, and never alternate the pose direction. Do not use a full side profile. Keep the torso upright, shoulders level, legs uncrossed, and both feet flat with a small natural gap. Use a neutral standing-at-attention pose, not an editorial fashion pose. Both arms must hang straight and relaxed beside the torso, with both hands fully visible next to the thighs. Keep both hands completely outside every pocket and away from the garments. Do not cross or fold the arms, bend an arm across the torso, put a hand on the waist or hip, touch or hold a jacket, cover the waistline, lean, step forward, or create a dynamic pose. Arms and hands must not obscure the top, outerwear, waistband, pockets, or lower garment.

Frame the complete outfit from the neck to the feet, keeping the model's face entirely outside the image. Use a warm off-white studio background, soft natural light, realistic fabric folds, and a clean Korean fashion lookbook composition. ${extraGarmentRule} Do not add text, captions, logos, duplicate items, shopping UI, borders, or a collage. Do not infer or reproduce a real person's identity or face.`
}

async function downloadReferenceImage(url: string, index: number) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new ServiceError(
      `${index + 1}번째 옷 이미지를 불러오지 못했습니다.`,
      'OUTFIT_PREVIEW_IMAGE_FAILED',
    )
  }

  const mimeType = response.headers.get('content-type')?.split(';')[0] ?? ''
  const bytes = await response.arrayBuffer()
  if (
    !SUPPORTED_REFERENCE_TYPES.has(mimeType) ||
    bytes.byteLength === 0 ||
    bytes.byteLength > MAX_REFERENCE_IMAGE_BYTES
  ) {
    throw new ServiceError(
      '참조할 수 없는 옷 이미지가 포함되어 있습니다.',
      'OUTFIT_PREVIEW_IMAGE_FAILED',
    )
  }

  return { bytes, mimeType }
}

export const outfitPreviewService = {
  async generate(
    userId: string,
    selectedItemIds: string[],
    style?: string | null,
  ) {
    const uniqueItemIds = [...new Set(selectedItemIds)]
    if (uniqueItemIds.length < 2 || uniqueItemIds.length > 8) {
      throw new ServiceError(
        'AI 룩 미리보기는 2개에서 8개의 옷으로 만들 수 있습니다.',
        'INVALID_OUTFIT_PREVIEW_ITEMS',
      )
    }

    const [unorderedItems, profile] = await Promise.all([
      wardrobeRepository.findManyOwnedWithImagesByIds(userId, uniqueItemIds),
      userRepository.findViewerById(userId),
    ])
    if (
      unorderedItems.length !== uniqueItemIds.length ||
      unorderedItems.some(
        (item) => !item.category || !item.displayImageAsset?.deliveryUrl,
      )
    ) {
      throw new ServiceError(
        '이미지가 있는 내 옷장 아이템만 미리보기에 사용할 수 있습니다.',
        'INVALID_OUTFIT_PREVIEW_ITEMS',
      )
    }

    const itemById = new Map(unorderedItems.map((item) => [item.id, item]))
    const items = uniqueItemIds.map((itemId) => itemById.get(itemId)!)
    if (!hasCompleteOutfitBase(items.map((item) => item.category!))) {
      throw new ServiceError(
        'AI 룩을 만들려면 상의나 아우터와 하의를 함께 선택해주세요.',
        'INCOMPLETE_OUTFIT_PREVIEW_ITEMS',
      )
    }
    const references = await Promise.all(
      items.map((item, index) =>
        downloadReferenceImage(item.displayImageAsset!.deliveryUrl!, index),
      ),
    )
    const prompt = buildPrompt(items, profile, style)
    const apiKey = process.env.OPENAI_API_KEY?.trim()
    const model = process.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-2'
    if (!apiKey) {
      throw new ServiceError(
        'AI 이미지 생성 설정을 확인해주세요.',
        'AI_CONFIGURATION_ERROR',
      )
    }

    const form = new FormData()
    form.set('model', model)
    form.set('prompt', prompt)
    form.set('size', '1024x1536')
    form.set('quality', 'medium')
    form.set('output_format', 'png')
    references.forEach((reference, index) => {
      form.append(
        'image[]',
        new Blob([reference.bytes], { type: reference.mimeType }),
        `garment-${index + 1}.${reference.mimeType.split('/')[1]}`,
      )
    })

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
    const payload = (await response.json().catch(() => null)) as
      | OpenAiImageResponse
      | null
    const imageBase64 = payload?.data?.[0]?.b64_json

    if (!response.ok || !imageBase64) {
      console.error('[outfit-preview] OpenAI image generation failed', {
        status: response.status,
        message: payload?.error?.message,
      })
      throw new ServiceError(
        'AI 룩 이미지를 만들지 못했습니다. 잠시 후 다시 시도해주세요.',
        'OUTFIT_PREVIEW_GENERATION_FAILED',
      )
    }

    return {
      imageBase64,
      mimeType: 'image/png' as const,
      model,
    }
  },
}
