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
    backgroundRemoverPromise = loadBackgroundRemover().catch((error: unknown) => {
      // 모델 로드가 실패한 Promise를 재사용하면 이후 사진도 계속 실패한다.
      backgroundRemoverPromise = null
      throw error
    })
  }

  return backgroundRemoverPromise
}

/**
 * 로컬 모델로 사진 배경을 제거하고, 투명 영역과 남은 전경 영역이 모두 있을 때만 PNG base64를 반환한다.
 * 모델 로드가 실패하면 다음 호출에서 다시 로드할 수 있도록 캐시된 Promise를 초기화한다.
 */
export async function removeImageBackground(
  imageBuffer: Buffer,
  mimeType: string,
) {
  const remover = await getBackgroundRemover()
  const bytes = Uint8Array.from(imageBuffer)
  const image = await RawImage.fromBlob(new Blob([bytes], { type: mimeType }))
  const cutout = await remover(image)
  const alpha = (await cutout.toSharp().ensureAlpha().stats()).channels[3]
  if (!alpha || alpha.min > 8 || alpha.max < 64) {
    throw new Error('배경 제거 결과에 투명한 배경과 옷 영역이 모두 필요합니다.')
  }
  const buffer = await cutout.toSharp().png().toBuffer()

  return {
    base64: buffer.toString('base64'),
    mimeType: 'image/png',
  }
}
