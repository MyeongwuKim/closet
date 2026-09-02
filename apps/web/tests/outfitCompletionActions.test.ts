import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { OutfitCompletionActions } from '../src/features/lookbook/components/OutfitCompletionActions'
import { OutfitPreviewDialogView } from '../src/features/lookbook/components/OutfitPreviewDialog'

const duplicateMessage = "같은 옷 조합이 이미 '출근 코디' 코디로 저장되어 있어요."
const noop = () => undefined

function renderActions(hasAvailableLookbook: boolean, message: string | null) {
  return renderToStaticMarkup(
    createElement(OutfitCompletionActions, {
      duplicateMessage: message,
      hasAvailableLookbook,
      onOpenLookbook: noop,
      onComplete: noop,
    }),
  )
}

test('저장된 중복 코디는 안내와 AI 룩북 보기만 노출한다', () => {
  const markup = renderActions(true, duplicateMessage)

  assert.match(markup, /출근 코디/)
  assert.match(markup, /AI 룩북 보기/)
  assert.doesNotMatch(markup, /이대로 완성/)
})

test('AI 이미지가 없는 중복 코디도 미리보기는 허용한다', () => {
  const markup = renderActions(false, duplicateMessage)

  assert.match(markup, /AI 룩 미리보기/)
  assert.doesNotMatch(markup, /이대로 완성/)
})

test('새 코디는 AI 미리보기와 완성 동작을 함께 노출한다', () => {
  const markup = renderActions(false, null)

  assert.match(markup, /AI 룩 미리보기/)
  assert.match(markup, /이대로 완성/)
})

test('중복 코디에서 새로 만든 미리보기는 추가 대신 닫기만 노출한다', () => {
  const markup = renderToStaticMarkup(
    createElement(OutfitPreviewDialogView, {
      selectedItems: [],
      preview: {
        isOpen: true,
        status: 'success',
        imageUrl: 'data:image/jpeg;base64,preview',
        imageBase64: 'preview',
        mimeType: 'image/jpeg',
        model: 'test-model',
        errorMessage: null,
      },
      generatePreview: noop,
      closePreview: noop,
      onPrimary: noop,
      primaryLabel: '닫기',
      primaryAction: 'close',
    }),
  )

  assert.match(markup, />닫기</)
  assert.doesNotMatch(markup, /코디북에 추가/)
})
