import assert from 'node:assert/strict'
import test from 'node:test'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { OutfitCompletionActions } from '../src/features/lookbook/components/OutfitCompletionActions'
import { OutfitPreviewDialogView } from '../src/features/lookbook/components/OutfitPreviewDialog'

const duplicateMessage = "같은 옷 조합이 이미 '출근 코디' 코디로 저장되어 있어요."
const noop = () => undefined

function renderWithCredits(content: ReactNode, remaining = 1) {
  const client = new QueryClient()
  client.setQueryData(['me'], { id: 'test-user' })
  client.setQueryData(['preview-credits', 'test-user', 'preview'], { totalRemaining: remaining, capacity: 5 })
  return renderToStaticMarkup(createElement(QueryClientProvider, { client }, content))
}

function renderActions(hasAvailableLookbook: boolean, message: string | null, remaining = 1) {
  return renderWithCredits(
    createElement(OutfitCompletionActions, {
      completionMessage: null,
      isEmpty: false,
      duplicateMessage: message,
      hasAvailableLookbook,
      onOpenLookbook: noop,
      onComplete: noop,
    }),
    remaining,
  )
}

test('저장된 중복 코디는 안내와 AI 룩 보기만 노출한다', () => {
  const markup = renderActions(true, duplicateMessage)

  assert.match(markup, /출근 코디/)
  assert.match(markup, /AI 룩 보기/)
  assert.doesNotMatch(markup, /Look 확인하기/)
})

test('AI 이미지가 없는 중복 코디도 미리보기는 허용한다', () => {
  const markup = renderActions(false, duplicateMessage)

  assert.match(markup, /AI 룩 만들기/)
  assert.doesNotMatch(markup, /Look 확인하기/)
})

test('새 코디는 AI 미리보기와 완성 동작을 함께 노출한다', () => {
  const markup = renderActions(false, null)

  assert.match(markup, /AI 룩 만들기/)
  assert.match(markup, /Look 확인하기/)
})

test('중복 코디에서 새로 만든 미리보기는 추가 대신 닫기만 노출한다', () => {
  const markup = renderWithCredits(
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


test('이미지 생성권이 없으면 만들기 전에 광고 동작을 표시한다', () => {
  assert.match(renderActions(false, null, 0), /광고 보고 사용권 얻기/)
})

test('이미지 생성권이 0회여도 저장된 AI 룩은 광고 없이 열 수 있다', () => {
  const markup = renderActions(true, duplicateMessage, 0)
  assert.match(markup, /AI 룩 보기/)
  assert.doesNotMatch(markup, /광고 보고 사용권 얻기/)
  assert.doesNotMatch(markup, / disabled=""/)
})
