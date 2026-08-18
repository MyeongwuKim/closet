import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { removeImageBackground } from '../dist/features/classification/backgroundRemover.js'

const imagePath = process.argv[2]

if (!imagePath) {
  console.error('사용법: pnpm --filter @closet/api test:background <이미지 경로>')
  process.exit(1)
}

const mimeTypes = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}
const mimeType = mimeTypes[extname(imagePath).toLowerCase()]

if (!mimeType) {
  console.error('JPEG, PNG, WEBP 파일만 테스트할 수 있습니다.')
  process.exit(1)
}

const image = await readFile(imagePath)
const result = await removeImageBackground(image, mimeType)

console.log(
  JSON.stringify(
    {
      mimeType: result.mimeType,
      base64Length: result.base64.length,
    },
    null,
    2,
  ),
)
