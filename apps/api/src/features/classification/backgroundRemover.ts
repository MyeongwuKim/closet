import { ServiceError } from '../../graphql/errors.js'
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

let removalTail: Promise<unknown> = Promise.resolve()
let queuedRemovals = 0

/**
 * 로컬 모델로 사진 배경을 제거하고, 투명 영역과 남은 전경 영역이 모두 있을 때만 PNG base64를 반환한다.
 * 공유 모델은 한 번에 하나의 사진을 처리하고 대기 작업이 8개면 새 요청을 거절한다.
 * 모델 로드가 실패하면 다음 호출에서 다시 로드할 수 있도록 캐시된 Promise를 초기화한다.
 */
export async function removeImageBackground(
  imageBuffer: Buffer,
  mimeType: string,
) {
  if (queuedRemovals >= 8) {
    throw new ServiceError('사진 분석이 진행 중이에요. 잠시 후 다시 시도해주세요.', 'AI_BUSY')
  }
  queuedRemovals += 1
  const work = removalTail.then(() => performBackgroundRemoval(imageBuffer, mimeType))
  removalTail = work.then(() => undefined, () => undefined)
  try {
    return await work
  } finally {
    queuedRemovals -= 1
  }
}

/** 이미지 디코딩부터 PNG 인코딩까지 실행하고, 실패한 단계는 서버 로그에 남긴다. */
async function performBackgroundRemoval(imageBuffer: Buffer, mimeType: string) {
  let stage = 'decode-image'
  try {
    const bytes = Uint8Array.from(imageBuffer)
    const image = await RawImage.fromBlob(new Blob([bytes], { type: mimeType }))

    stage = 'load-model'
    const remover = await getBackgroundRemover()
    stage = 'run-model'
    const cutout = await remover(image)

    stage = 'validate-alpha'
    const alpha = (await cutout.toSharp().ensureAlpha().stats()).channels[3]
    if (!alpha || alpha.min > 8 || alpha.max < 64) {
      throw new Error('배경 제거 결과에 투명한 배경과 옷 영역이 모두 필요합니다.')
    }

    stage = 'encode-png'
    const buffer = await cutout.toSharp().png().toBuffer()
    return {
      base64: buffer.toString('base64'),
      mimeType: 'image/png',
    }
  } catch (error) {
    // 사진 내용, 파일명, 오류 원문은 로그에 포함하지 않는다.
    console.warn('[wardrobe-cutout] background removal failed', {
      stage,
      errorType: error instanceof Error ? error.name : 'unknown',
    })
    throw error
  }
}
