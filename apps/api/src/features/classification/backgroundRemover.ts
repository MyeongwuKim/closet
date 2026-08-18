import {
  RawImage,
  env,
  pipeline,
  type BackgroundRemovalPipeline,
} from '@huggingface/transformers'

const DEFAULT_BACKGROUND_REMOVAL_MODEL = 'onnx-community/BEN2-ONNX'

function getBackgroundRemovalModelId() {
  return (
    process.env.BACKGROUND_REMOVAL_MODEL ?? DEFAULT_BACKGROUND_REMOVAL_MODEL
  )
}

async function loadBackgroundRemover(): Promise<BackgroundRemovalPipeline> {
  env.cacheDir = process.env.HF_CACHE_DIR ?? '.cache/huggingface'

  return pipeline('background-removal', getBackgroundRemovalModelId(), {
    dtype: 'fp16',
  })
}

let backgroundRemoverPromise: ReturnType<typeof loadBackgroundRemover> | null =
  null

function getBackgroundRemover() {
  if (!backgroundRemoverPromise) {
    backgroundRemoverPromise = loadBackgroundRemover()
  }

  return backgroundRemoverPromise
}

export async function removeImageBackground(
  imageBuffer: Buffer,
  mimeType: string,
) {
  const remover = await getBackgroundRemover()
  const bytes = Uint8Array.from(imageBuffer)
  const image = await RawImage.fromBlob(new Blob([bytes], { type: mimeType }))
  const cutout = await remover(image)
  const buffer = await cutout.toSharp().png().toBuffer()

  return {
    base64: buffer.toString('base64'),
    mimeType: 'image/png',
  }
}
