import assert from 'node:assert/strict'
import test from 'node:test'
import { getClipboardImageFiles } from '../src/features/closet/utils/clipboardImages'

function clipboard(files: File[], items: Array<Partial<DataTransferItem>> = []) {
  return { files, items } as unknown as Pick<DataTransfer, 'files' | 'items'>
}

test('브라우저가 files와 items 양쪽에 제공한 이미지를 한 번만 추가한다', () => {
  const image = new File(['image'], 'copied.png', { type: 'image/png' })
  const data = clipboard([image], [{ kind: 'file', type: 'image/png', getAsFile: () => image }])
  assert.deepEqual(getClipboardImageFiles(data), [image])
})

test('files가 비어 있으면 items의 여러 이미지 파일을 읽고 읽을 수 없는 항목을 제외한다', () => {
  const first = new File(['first'], 'first.png', { type: 'image/png' })
  const second = new File(['second'], 'second.webp', { type: 'image/webp' })
  const data = clipboard([], [
    { kind: 'file', type: 'image/png', getAsFile: () => first },
    { kind: 'file', type: 'image/webp', getAsFile: () => second },
    { kind: 'file', type: 'image/png', getAsFile: () => null },
  ])
  assert.deepEqual(getClipboardImageFiles(data), [first, second])
})

test('일반 파일·주소·HTML만 복사된 경우 사진을 추가하지 않는다', () => {
  const text = new File(['https://example.com/photo.jpg'], 'link.txt', { type: 'text/plain' })
  const data = clipboard([text], [
    { kind: 'string', type: 'text/plain', getAsFile: () => null },
    { kind: 'string', type: 'text/html', getAsFile: () => null },
    { kind: 'file', type: 'text/plain', getAsFile: () => text },
  ])
  assert.deepEqual(getClipboardImageFiles(data), [])
})
