import {
  RawImage,
  env,
  pipeline,
  type ObjectDetectionPipeline,
} from '@huggingface/transformers'

const DEFAULT_PERSON_DETECTION_MODEL = 'Xenova/yolos-tiny'
const DEFAULT_PERSON_DETECTION_BLOCK_THRESHOLD = 0.9

function getPersonDetectionModelId() {
  return process.env.PERSON_DETECTION_MODEL ?? DEFAULT_PERSON_DETECTION_MODEL
}

function getPersonDetectionBlockThreshold() {
  const configuredThreshold = Number(
    process.env.PERSON_DETECTION_BLOCK_THRESHOLD ??
      DEFAULT_PERSON_DETECTION_BLOCK_THRESHOLD,
  )

  return Number.isFinite(configuredThreshold)
    ? configuredThreshold
    : DEFAULT_PERSON_DETECTION_BLOCK_THRESHOLD
}

async function loadPersonDetector(): Promise<ObjectDetectionPipeline> {
  env.cacheDir = process.env.HF_CACHE_DIR ?? '.cache/huggingface'

  return pipeline('object-detection', getPersonDetectionModelId(), {
    dtype: 'q8',
  })
}

let personDetectorPromise: ReturnType<typeof loadPersonDetector> | null = null

function getPersonDetector() {
  if (!personDetectorPromise) {
    personDetectorPromise = loadPersonDetector()
  }

  return personDetectorPromise
}

export async function containsPerson(imageBuffer: Buffer, mimeType: string) {
  const detector = await getPersonDetector()
  const bytes = Uint8Array.from(imageBuffer)
  const image = await RawImage.fromBlob(new Blob([bytes], { type: mimeType }))
  const detections = await detector(image, {
    threshold: getPersonDetectionBlockThreshold(),
  })

  return detections.some(
    (detection) => detection.label.toLowerCase() === 'person',
  )
}
