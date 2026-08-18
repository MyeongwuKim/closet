import type {
  ClothingClassificationResult,
  ClothingClassificationSuggestion,
} from '@closet/types'
import {
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
  dot,
  env,
  softmax,
} from '@huggingface/transformers'
import {
  categoryLabels,
  fashionColorLabels,
  fashionTypeLabels,
  getFashionClipModelId,
} from './taxonomy.js'
import { colorHexToRgb, normalizeColorHex } from './color.js'

interface ClassificationScore {
  label: string
  score: number
}

async function loadFashionClip() {
  const modelId = getFashionClipModelId()

  return Promise.all([
    AutoTokenizer.from_pretrained(modelId),
    CLIPTextModelWithProjection.from_pretrained(modelId, { dtype: 'q8' }),
    AutoProcessor.from_pretrained(modelId),
    CLIPVisionModelWithProjection.from_pretrained(modelId, { dtype: 'q8' }),
  ])
}

let fashionClipPromise: ReturnType<typeof loadFashionClip> | null = null

function getFashionClip() {
  if (!fashionClipPromise) {
    env.cacheDir = process.env.HF_CACHE_DIR ?? '.cache/huggingface'
    fashionClipPromise = loadFashionClip()
  }

  return fashionClipPromise
}

async function calculateScores(
  labels: string[],
  imageEmbedding: number[],
  tokenizer: Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>>,
  textModel: Awaited<
    ReturnType<typeof CLIPTextModelWithProjection.from_pretrained>
  >,
): Promise<ClassificationScore[]> {
  const textInputs = tokenizer(labels, {
    padding: 'max_length',
    truncation: true,
  })
  const { text_embeds: textEmbeddings } = await textModel(textInputs)
  const normalizedTextEmbeddings = textEmbeddings.normalize().tolist() as number[][]
  const probabilities = softmax(
    normalizedTextEmbeddings.map(
      (textEmbedding) => 100 * dot(imageEmbedding, textEmbedding),
    ),
  )

  return labels
    .map((label, index) => ({ label, score: probabilities[index] }))
    .sort((a, b) => b.score - a.score)
}

export async function classifyWardrobeImage(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<ClothingClassificationResult> {
  const [tokenizer, textModel, processor, visionModel] =
    await getFashionClip()
  const bytes = Uint8Array.from(imageBuffer)
  const image = await RawImage.fromBlob(new Blob([bytes], { type: mimeType }))
  const imageInputs = await processor(image)
  const { image_embeds: imageEmbeddings } = await visionModel(imageInputs)
  const imageEmbedding = imageEmbeddings.normalize().tolist()[0] as number[]

  const typeScores = await calculateScores(
    fashionTypeLabels.map(
      (item) => `This is a product photo of ${item.prompt}.`,
    ),
    imageEmbedding,
    tokenizer,
    textModel,
  )
  const colorScores = await calculateScores(
    fashionColorLabels.map(
      (item) => `The main item is ${item.prompt}.`,
    ),
    imageEmbedding,
    tokenizer,
    textModel,
  )

  const topTypeScore = typeScores[0]
  const topColorScore = colorScores[0]
  const topType = fashionTypeLabels.find(
    (item) => `This is a product photo of ${item.prompt}.` === topTypeScore?.label,
  )
  const topColor = fashionColorLabels.find(
    (item) => `The main item is ${item.prompt}.` === topColorScore?.label,
  )

  if (!topType || !topColor) {
    throw new Error('FashionCLIP returned an unmapped label.')
  }

  const colorHex = normalizeColorHex(topColor.hex)
  const colorRgb = colorHexToRgb(colorHex)
  if (!colorRgb) {
    throw new Error('FashionCLIP returned an invalid color.')
  }

  const candidates = typeScores.slice(0, 3).flatMap((score) => {
    const item = fashionTypeLabels.find(
      (label) =>
        `This is a product photo of ${label.prompt}.` === score.label,
    )

    if (!item) return []

    return [
      {
        category: item.category,
        subcategory: item.subcategory,
        label: item.label,
        score: score.score,
      } satisfies ClothingClassificationSuggestion,
    ]
  })

  return {
    category: topType.category,
    categoryLabel: categoryLabels[topType.category],
    subcategory: topType.subcategory,
    subcategoryLabel: topType.label,
    suggestedName: `${topColor.name} ${topType.label}`,
    colorName: topColor.name,
    colorDetailName: topColor.name,
    colorHex,
    colorRgb,
    colorMode: topColor.name === '다색' ? 'multicolor' : 'solid',
    confidence: topTypeScore.score,
    model: getFashionClipModelId(),
    candidates,
  }
}
