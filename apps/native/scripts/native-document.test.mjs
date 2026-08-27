import assert from 'node:assert/strict'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { constrainNativeDocument } from './native-document.mjs'

test('앱 번들의 viewport만 교체하고 화면 너비와 safe area를 유지한다', () => {
  const source = '<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Closet</title></head><body><main>옷장</main></body></html>'
  const html = constrainNativeDocument(source)
  assert.equal(html.match(/name="viewport"/g).length, 1)
  assert.match(html, /width=device-width/)
  assert.match(html, /maximum-scale=1.0, user-scalable=no, viewport-fit=cover/)
  assert.match(html, /<title>Closet<\/title>/)
  assert.match(html, /<body><main>옷장<\/main><\/body>/)
  assert.doesNotMatch(source, /user-scalable/)
})

test('viewport가 없는 문서에도 추가하며 가로·세로 스크롤은 허용한다', () => {
  const html = constrainNativeDocument('<html><head></head><body></body></html>')
  assert.match(html, /name="viewport"/)
  assert.match(html, /touch-action: pan-x pan-y/)
  assert.match(html, /overscroll-behavior: none/)
})

function getInteractionListeners() {
  const html = constrainNativeDocument('<html><head></head><body></body></html>')
  const script = html.match(/<script data-closet-native-interactions>([\s\S]*?)<\/script>/)[1]
  const listeners = new Map()
  runInNewContext(script, {
    document: { addEventListener: (type, callback, options) => listeners.set(type, { callback, options }) },
  })
  return listeners
}

test('확대와 일반 UI 선택은 막고 터치 스크롤과 일반 클릭은 가로채지 않는다', () => {
  const listeners = getInteractionListeners()
  assert.deepEqual([...listeners.keys()], [
    'gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'contextmenu', 'selectstart', 'dragstart',
  ])
  for (const { callback, options } of listeners.values()) {
    let prevented = false
    callback({ preventDefault: () => { prevented = true } })
    assert.equal(prevented, true)
    assert.equal(options.passive, false)
  }
})

test('입력칸과 편집 영역은 글자 선택, 복사·붙여넣기 메뉴를 유지한다', () => {
  const listeners = getInteractionListeners()
  for (const target of [
    { tagName: 'INPUT' },
    { tagName: 'TEXTAREA' },
    { tagName: 'SPAN', isContentEditable: true },
    { nodeType: 3, parentElement: { isContentEditable: true } },
  ]) {
    for (const type of ['dblclick', 'contextmenu', 'selectstart', 'dragstart']) {
      let prevented = false
      listeners.get(type).callback({ target, preventDefault: () => { prevented = true } })
      assert.equal(prevented, false, `${type} in editable target`)
    }
  }
})
