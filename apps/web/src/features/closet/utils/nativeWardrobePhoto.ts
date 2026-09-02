import type { NativeWardrobePhotoAsset } from '../../../native-bridge'

const fileExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function normalizeMimeType(mimeType: string | undefined) {
  if (!mimeType) return 'image/jpeg'

  const normalizedMimeType = mimeType.toLowerCase()
  return normalizedMimeType === 'image/jpg'
    ? 'image/jpeg'
    : normalizedMimeType
}

function readBase64Payload(base64: string) {
  const dataUrlMatch = base64.match(/^data:([^;,]+);base64,/i)

  return {
    encodedValue: (dataUrlMatch
      ? base64.slice(dataUrlMatch[0].length)
      : base64
    ).replaceAll(/\s/g, ''),
    dataUrlMimeType: dataUrlMatch?.[1],
  }
}

export function createFileFromNativeWardrobePhoto(
  asset: NativeWardrobePhotoAsset,
) {
  const { encodedValue, dataUrlMimeType } = readBase64Payload(asset.base64)
  const mimeType = normalizeMimeType(asset.mimeType ?? dataUrlMimeType)

  if (!encodedValue) {
    throw new Error('촬영한 사진 데이터를 읽지 못했습니다.')
  }

  let binary: string
  try {
    binary = window.atob(encodedValue)
  } catch {
    throw new Error('촬영한 사진 데이터를 읽지 못했습니다.')
  }

  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  const nativeFilename = asset.fileName?.split(/[\\/]/).pop()?.trim()
  const extension = fileExtensions[mimeType] ?? 'jpg'
  const filename =
    nativeFilename || `wardrobe-photo-${Date.now()}.${extension}`

  return new File([bytes], filename, {
    type: mimeType,
    lastModified: Date.now(),
  })
}
