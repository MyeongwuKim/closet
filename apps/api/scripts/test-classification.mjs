import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

const imagePath = process.argv[2]

if (!imagePath) {
  console.error('사용법: pnpm --filter @closet/api test:classifier <이미지 경로>')
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
const response = await fetch('http://127.0.0.1:4000/graphql', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    query: `
      mutation TestClassification($input: ClassifyWardrobeImageInput!) {
        classifyWardrobeImage(input: $input) {
          category
          categoryLabel
          subcategory
          subcategoryLabel
          suggestedName
          colorName
          colorHex
          confidence
          model
          cutoutImageBase64
          cutoutMimeType
          candidates { category subcategory label score }
        }
      }
    `,
    variables: {
      input: {
        imageBase64: image.toString('base64'),
        mimeType,
        filename: imagePath,
      },
    },
  }),
})

const payload = await response.json()
const cutoutImageBase64 = payload.data?.classifyWardrobeImage?.cutoutImageBase64

if (cutoutImageBase64) {
  payload.data.classifyWardrobeImage.cutoutImageBase64 =
    `<${cutoutImageBase64.length} base64 characters>`
}

console.log(JSON.stringify(payload, null, 2))
