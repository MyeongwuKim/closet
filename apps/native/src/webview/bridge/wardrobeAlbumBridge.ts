import { File } from 'expo-file-system'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { postNativeBridgeResponse } from './responses'
import type { NativeSelectWardrobePhotosRequest, WebViewRef } from './types'

const MAX_WARDROBE_IMAGE_BYTES = 10 * 1024 * 1024
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** 선택된 파일만 읽고, HEIC·HEIF는 웹 등록에서 읽을 수 있도록 JPEG로 변환한다. */
async function readAlbumPhoto(asset: ImagePicker.ImagePickerAsset) {
  let file = new File(asset.uri)
  let mimeType = (asset.mimeType || file.type).toLowerCase()
  let fileName = asset.fileName || file.name

  if (/^image\/hei[cf]$/.test(mimeType) || /\.hei[cf]$/i.test(file.name)) {
    const context = ImageManipulator.manipulate(asset.uri)
    const longestSide = Math.max(asset.width, asset.height)
    if (longestSide > 2048) {
      context.resize(asset.width >= asset.height ? { width: 2048 } : { height: 2048 })
    }
    const image = await context.renderAsync()
    const jpeg = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 })
    file = new File(jpeg.uri)
    mimeType = 'image/jpeg'
    fileName = `${fileName.replace(/\.[^.]+$/, '')}.jpg`
  }

  if (!SUPPORTED_IMAGE_TYPES.has(mimeType) || file.size <= 0 || file.size > MAX_WARDROBE_IMAGE_BYTES) {
    return null
  }

  return { base64: await file.base64(), fileName, mimeType }
}

/** 시스템 사진 보관함에서 고른 파일을 한 장씩 보내고, 마지막 응답으로 요청을 완료한다. */
export async function handleNativeSelectWardrobePhotos(
  request: NativeSelectWardrobePhotosRequest,
  webViewRef: WebViewRef,
) {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      orderedSelection: true,
      quality: 1,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    })
    if (result.canceled) {
      postNativeBridgeResponse(webViewRef, request.id, { ok: true, data: { status: 'cancelled' } })
      return
    }

    let skippedCount = 0
    for (const asset of result.assets) {
      const photo = await readAlbumPhoto(asset).catch(() => null)
      if (photo) {
        postNativeBridgeResponse(webViewRef, request.id, { ok: true, data: photo, partial: true })
      } else {
        skippedCount += 1
      }
    }
    postNativeBridgeResponse(webViewRef, request.id, { ok: true, data: { status: 'selected', skippedCount } })
  } catch {
    postNativeBridgeResponse(webViewRef, request.id, { ok: false, error: '앨범을 열지 못했어요. 다시 시도해주세요.' })
  }
}
